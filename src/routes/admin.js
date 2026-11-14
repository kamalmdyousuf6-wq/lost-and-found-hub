const express = require("express");
const pool = require("../db");
const { authenticate } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate(["admin"]));

const allowedStatuses = {
  lost: new Set(["LOST", "MATCHED", "RECOVERY_REQUESTED", "RECOVERED", "CLOSED"]),
  found: new Set(["RECEIVED", "MATCHED", "RETURNED", "CLOSED"]),
  match: new Set(["POSSIBLE", "CONFIRMED", "REJECTED"]),
  contact: new Set(["PENDING", "IN_REVIEW", "RESOLVED"]),
  recovery: new Set(["PENDING", "VERIFIED", "HANDED_OVER"])
};

// Dashboard counts.
router.get("/dashboard", async (req, res, next) => {
  try {
    const [[lost]] = await pool.execute(
      "SELECT COUNT(*) AS count FROM lost_items WHERE status NOT IN ('RECOVERED', 'CLOSED')"
    );
    const [[found]] = await pool.execute(
      "SELECT COUNT(*) AS count FROM found_items WHERE status IN ('RECEIVED', 'MATCHED')"
    );
    const [[matches]] = await pool.execute(
      "SELECT COUNT(*) AS count FROM matches WHERE status = 'POSSIBLE'"
    );
    const [[requests]] = await pool.execute(
      "SELECT COUNT(*) AS count FROM recovery_records WHERE status IN ('PENDING', 'VERIFIED')"
    );
    const [[contacts]] = await pool.execute(
      "SELECT COUNT(*) AS count FROM admin_contact_requests WHERE status <> 'RESOLVED'"
    );
    const [[recovered]] = await pool.execute(
      "SELECT COUNT(*) AS count FROM recovery_records WHERE status = 'HANDED_OVER'"
    );

    res.json({
      lost_reports: lost.count,
      found_items_in_custody: found.count,
      possible_matches: matches.count,
      recovery_requests: requests.count,
      contact_requests: contacts.count,
      recovered_items: recovered.count
    });
  } catch (error) {
    next(error);
  }
});

// Admin views a selected management list. Only whitelisted SQL fragments are used.
router.get("/:resource", async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    let sql;

    switch (req.params.resource) {
      case "lost-items":
        sql = `SELECT li.id, li.user_id, u.name AS reporter_name, li.title, li.category,
                      li.description, li.date_lost, li.location_lost, li.image,
                      li.status, li.created_at
                 FROM lost_items li JOIN users u ON u.id = li.user_id
                ORDER BY li.created_at DESC LIMIT ? OFFSET ?`;
        break;
      case "found-items":
        sql = `SELECT fi.id, fi.admin_id, a.name AS recorded_by, fi.title, fi.category,
                      fi.description, fi.date_found, fi.location_found, fi.image,
                      fi.received_date, fi.status, fi.created_at
                 FROM found_items fi JOIN admin_users a ON a.id = fi.admin_id
                ORDER BY fi.created_at DESC LIMIT ? OFFSET ?`;
        break;
      case "matches":
        sql = `SELECT m.*, li.title AS lost_title, fi.title AS found_title
                 FROM matches m
                 JOIN lost_items li ON li.id = m.lost_item_id
                 JOIN found_items fi ON fi.id = m.found_item_id
                ORDER BY m.created_at DESC LIMIT ? OFFSET ?`;
        break;
      case "contact-requests":
        sql = `SELECT cr.*, u.name AS user_name, u.email AS user_email
                 FROM admin_contact_requests cr
                 JOIN users u ON u.id = cr.user_id
                ORDER BY cr.created_at DESC LIMIT ? OFFSET ?`;
        break;
      case "recovery-records":
        sql = `SELECT rr.*, u.name AS user_name, li.title AS lost_title, fi.title AS found_title
                 FROM recovery_records rr
                 JOIN users u ON u.id = rr.user_id
                 JOIN lost_items li ON li.id = rr.lost_item_id
                 JOIN found_items fi ON fi.id = rr.found_item_id
                ORDER BY rr.created_at DESC LIMIT ? OFFSET ?`;
        break;
      case "users":
        sql = `SELECT id, name, email, created_at
                 FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?`;
        break;
      default:
        return res.status(404).json({ error: "Unknown admin resource." });
    }

    const [rows] = await pool.execute(sql, [limit, offset]);
    res.json({ records: rows, limit, offset });
  } catch (error) {
    next(error);
  }
});

// Update status for a managed record.
router.patch("/:resource/:id/status", async (req, res, next) => {
  try {
    const { resource, id } = req.params;
    const { status } = req.body || {};

    if (!/^\d+$/.test(id)) return res.status(400).json({ error: "Invalid record ID." });

    const config = {
      "lost-items": { table: "lost_items", states: allowedStatuses.lost },
      "found-items": { table: "found_items", states: allowedStatuses.found },
      matches: { table: "matches", states: allowedStatuses.match },
      "contact-requests": { table: "admin_contact_requests", states: allowedStatuses.contact },
      "recovery-records": { table: "recovery_records", states: allowedStatuses.recovery }
    }[resource];

    if (!config) return res.status(404).json({ error: "Unknown admin resource." });
    if (!config.states.has(status)) return res.status(400).json({ error: "Invalid status for this resource." });

    // Table name comes only from the hard-coded whitelist above.
    const [result] = await pool.execute(
      `UPDATE ${config.table} SET status = ? WHERE id = ?`,
      [status, Number(id)]
    );

    if (!result.affectedRows) return res.status(404).json({ error: "Record not found." });

    if (resource === "matches" && status === "CONFIRMED") {
      await pool.execute(
        "UPDATE lost_items SET status = 'MATCHED' WHERE id = (SELECT lost_item_id FROM matches WHERE id = ?)",
        [Number(id)]
      );
      await pool.execute(
        "UPDATE found_items SET status = 'MATCHED' WHERE id = (SELECT found_item_id FROM matches WHERE id = ?)",
        [Number(id)]
      );
    }

    res.json({ success: true, status });
  } catch (error) {
    next(error);
  }
});

// Verify a claimant, then mark the physical handover as complete.
router.post("/recovery-records/:id/handover", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { verification_notes } = req.body || {};

    if (!/^\d+$/.test(id) || typeof verification_notes !== "string"
        || verification_notes.trim().length < 3 || verification_notes.length > 5000) {
      return res.status(400).json({ error: "Provide verification notes." });
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [rows] = await connection.execute(
        `SELECT lost_item_id, found_item_id, user_id
           FROM recovery_records
          WHERE id = ? AND status IN ('PENDING', 'VERIFIED')
          FOR UPDATE`,
        [Number(id)]
      );

      if (!rows.length) {
        await connection.rollback();
        return res.status(404).json({ error: "Pending recovery record not found." });
      }

      const record = rows[0];

      await connection.execute(
        `UPDATE recovery_records
            SET verification_notes = ?, status = 'HANDED_OVER', handover_date = CURRENT_TIMESTAMP
          WHERE id = ?`,
        [verification_notes.trim(), Number(id)]
      );

      await connection.execute(
        "UPDATE lost_items SET status = 'RECOVERED' WHERE id = ?",
        [record.lost_item_id]
      );

      await connection.execute(
        "UPDATE found_items SET status = 'RETURNED' WHERE id = ?",
        [record.found_item_id]
      );

      await connection.execute(
        "INSERT INTO notifications (user_id, message) VALUES (?, ?)",
        [record.user_id, "Administration has recorded your item as handed over."]
      );

      await connection.commit();
      res.json({ success: true, status: "HANDED_OVER" });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
});

module.exports = router;