const express = require("express");
const pool = require("../db");
const { authenticate } = require("../middleware/auth");
const { createPossibleMatchesForFound } = require("../utils/matching");

const router = express.Router();

const categories = new Set([
  "Electronics",
  "Bags & wallets",
  "Clothing",
  "Keys",
  "Books & stationery",
  "Accessories",
  "Other"
]);

function validText(value, max = 1000) {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= max;
}

function validDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function validImage(value) {
  return value == null || (typeof value === "string" && value.length <= 500);
}

// Public browse endpoint. Does not return private identifying details or user contact data.
router.get("/", async (req, res, next) => {
  try {
    const type = req.query.type;
    const category = req.query.category;
    const location = req.query.location;
    const date = req.query.date;
    const search = req.query.search;

    if (type && !["lost", "found"].includes(type)) {
      return res.status(400).json({ error: "type must be lost or found." });
    }

    const clauses = [];
    const values = [];

    if (!type || type === "lost") {
      const lostClauses = ["li.status IN ('LOST', 'MATCHED', 'RECOVERY_REQUESTED')"];
      const lostValues = [];

      if (category) { lostClauses.push("li.category = ?"); lostValues.push(category); }
      if (location) { lostClauses.push("li.location_lost LIKE ?"); lostValues.push(`%${location}%`); }
      if (date) { lostClauses.push("li.date_lost = ?"); lostValues.push(date); }
      if (search) {
        lostClauses.push("(li.title LIKE ? OR li.description LIKE ?)");
        lostValues.push(`%${search}%`, `%${search}%`);
      }

      clauses.push({
        sql: `SELECT li.id, 'lost' AS type, li.title, li.category, li.description,
                     li.date_lost AS item_date, li.location_lost AS item_location,
                     li.image, li.status, li.created_at
                FROM lost_items li
               WHERE ${lostClauses.join(" AND ")}`,
        values: lostValues
      });
    }

    if (!type || type === "found") {
      const foundClauses = ["fi.status IN ('RECEIVED', 'MATCHED')"];
      const foundValues = [];

      if (category) { foundClauses.push("fi.category = ?"); foundValues.push(category); }
      if (location) { foundClauses.push("fi.location_found LIKE ?"); foundValues.push(`%${location}%`); }
      if (date) { foundClauses.push("fi.date_found = ?"); foundValues.push(date); }
      if (search) {
        foundClauses.push("(fi.title LIKE ? OR fi.description LIKE ?)");
        foundValues.push(`%${search}%`, `%${search}%`);
      }

      clauses.push({
        sql: `SELECT fi.id, 'found' AS type, fi.title, fi.category, fi.description,
                     fi.date_found AS item_date, fi.location_found AS item_location,
                     fi.image, fi.status, fi.created_at
                FROM found_items fi
               WHERE ${foundClauses.join(" AND ")}`,
        values: foundValues
      });
    }

    const combinedSql = clauses.map(part => part.sql).join(" UNION ALL ");
    const combinedValues = clauses.flatMap(part => part.values);
    const [rows] = await pool.execute(
      `SELECT * FROM (${combinedSql}) AS items ORDER BY created_at DESC LIMIT 200`,
      combinedValues
    );

    res.json({ items: rows });
  } catch (error) {
    next(error);
  }
});

// Get a public item detail and related match suggestions. No personal contact details.
router.get("/:type/:id", async (req, res, next) => {
  try {
    const { type, id } = req.params;
    if (!["lost", "found"].includes(type) || !/^\d+$/.test(id)) {
      return res.status(400).json({ error: "Invalid item reference." });
    }

    const isLost = type === "lost";
    const query = isLost
      ? `SELECT id, 'lost' AS type, title, category, description,
                date_lost AS item_date, location_lost AS item_location,
                image, status, created_at
           FROM lost_items WHERE id = ?`
      : `SELECT id, 'found' AS type, title, category, description,
                date_found AS item_date, location_found AS item_location,
                image, status, created_at
           FROM found_items WHERE id = ?`;

    const [items] = await pool.execute(query, [Number(id)]);
    if (!items.length) return res.status(404).json({ error: "Item not found." });

    const matchQuery = isLost
      ? `SELECT m.id, m.match_score, m.match_reason, m.status,
                fi.id AS found_item_id, fi.title AS found_title,
                fi.category AS found_category, fi.date_found,
                fi.location_found, fi.status AS found_status
           FROM matches m
           JOIN found_items fi ON fi.id = m.found_item_id
          WHERE m.lost_item_id = ? AND m.status <> 'REJECTED'
          ORDER BY m.match_score DESC`
      : `SELECT m.id, m.match_score, m.match_reason, m.status,
                li.id AS lost_item_id, li.title AS lost_title,
                li.category AS lost_category, li.date_lost,
                li.location_lost, li.status AS lost_status
           FROM matches m
           JOIN lost_items li ON li.id = m.lost_item_id
          WHERE m.found_item_id = ? AND m.status <> 'REJECTED'
          ORDER BY m.match_score DESC`;

    const [matches] = await pool.execute(matchQuery, [Number(id)]);
    res.json({ item: items[0], possible_matches: matches });
  } catch (error) {
    next(error);
  }
});

// Authenticated user submits a lost report.
router.post("/lost", authenticate(["user"]), async (req, res, next) => {
  try {
    const {
      title, category, description, date_lost, location_lost,
      identifying_details, image
    } = req.body || {};

    if (!validText(title, 180) || !categories.has(category)
        || !validText(description, 10000) || !validDate(date_lost)
        || !validText(location_lost, 180) || !validImage(image)
        || (identifying_details != null && typeof identifying_details !== "string")) {
      return res.status(400).json({ error: "Please provide valid lost item fields." });
    }

    const [result] = await pool.execute(
      `INSERT INTO lost_items
        (user_id, title, category, description, date_lost, location_lost,
         identifying_details, image)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.auth.id, title.trim(), category, description.trim(), date_lost,
        location_lost.trim(), identifying_details || null, image || null
      ]
    );

    res.status(201).json({ id: result.insertId, status: "LOST" });
  } catch (error) {
    next(error);
  }
});

// Admin records an item that has physically been handed to administration.
// The new record's default status is RECEIVED.
router.post("/found", authenticate(["admin"]), async (req, res, next) => {
  try {
    const {
      title, category, description, date_found, location_found,
      identifying_details, image, received_date
    } = req.body || {};

    const receivedDate = received_date || new Date().toISOString().slice(0, 10);

    if (!validText(title, 180) || !categories.has(category)
        || !validText(description, 10000) || !validDate(date_found)
        || !validText(location_found, 180) || !validDate(receivedDate)
        || !validImage(image)
        || (identifying_details != null && typeof identifying_details !== "string")) {
      return res.status(400).json({ error: "Please provide valid found item fields." });
    }

    const connection = await pool.getConnection();
    let itemId;

    try {
      await connection.beginTransaction();

      const [result] = await connection.execute(
        `INSERT INTO found_items
          (admin_id, title, category, description, date_found, location_found,
           identifying_details, image, received_date, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'RECEIVED')`,
        [
          req.auth.id, title.trim(), category, description.trim(), date_found,
          location_found.trim(), identifying_details || null, image || null, receivedDate
        ]
      );

      itemId = result.insertId;
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    await createPossibleMatchesForFound({
      id: itemId,
      title: title.trim(),
      category,
      description: description.trim(),
      location_found: location_found.trim()
    });

    res.status(201).json({
      id: itemId,
      status: "RECEIVED",
      message: "Found item recorded as received by administration."
    });
  } catch (error) {
    next(error);
  }
});

// User asks administration about a lost/found item or possible match.
router.post("/contact-requests", authenticate(["user"]), async (req, res, next) => {
  try {
    const { lost_item_id, found_item_id, message } = req.body || {};

    const lostId = lost_item_id == null ? null : Number(lost_item_id);
    const foundId = found_item_id == null ? null : Number(found_item_id);

    if ((!lostId && !foundId) || (lostId && !Number.isSafeInteger(lostId))
        || (foundId && !Number.isSafeInteger(foundId))
        || !validText(message, 5000)) {
      return res.status(400).json({ error: "Provide an item reference and a message." });
    }

    if (lostId) {
      const [owned] = await pool.execute(
        "SELECT id FROM lost_items WHERE id = ? AND user_id = ?",
        [lostId, req.auth.id]
      );
      if (!owned.length) return res.status(404).json({ error: "Lost report not found." });
    }

    if (foundId) {
      const [found] = await pool.execute(
        "SELECT id FROM found_items WHERE id = ? AND status IN ('RECEIVED', 'MATCHED')",
        [foundId]
      );
      if (!found.length) return res.status(404).json({ error: "Found item not found." });
    }

    const [result] = await pool.execute(
      `INSERT INTO admin_contact_requests
        (user_id, lost_item_id, found_item_id, message)
       VALUES (?, ?, ?, ?)`,
      [req.auth.id, lostId, foundId, message.trim()]
    );

    res.status(201).json({ id: result.insertId, status: "PENDING" });
  } catch (error) {
    next(error);
  }
});

// User requests recovery of a found item. Administration still verifies ownership.
router.post("/recovery-requests", authenticate(["user"]), async (req, res, next) => {
  try {
    const { lost_item_id, found_item_id, message } = req.body || {};
    const lostId = Number(lost_item_id);
    const foundId = Number(found_item_id);

    if (!Number.isSafeInteger(lostId) || !Number.isSafeInteger(foundId)
        || !validText(message, 5000)) {
      return res.status(400).json({ error: "Lost item, found item, and message are required." });
    }

    const [lostRows] = await pool.execute(
      "SELECT id FROM lost_items WHERE id = ? AND user_id = ?",
      [lostId, req.auth.id]
    );
    if (!lostRows.length) return res.status(404).json({ error: "Lost report not found." });

    const [matchRows] = await pool.execute(
      `SELECT id FROM matches
        WHERE lost_item_id = ? AND found_item_id = ? AND status <> 'REJECTED'`,
      [lostId, foundId]
    );
    if (!matchRows.length) return res.status(400).json({ error: "No possible match exists for these items." });

    const connection = await pool.getConnection();
    let recordId;

    try {
      await connection.beginTransaction();

      const [record] = await connection.execute(
        `INSERT INTO recovery_records
          (lost_item_id, found_item_id, user_id, admin_id, verification_notes, status)
         SELECT ?, ?, ?, fi.admin_id, ?, 'PENDING'
           FROM found_items fi
          WHERE fi.id = ? AND fi.status IN ('RECEIVED', 'MATCHED')`,
        [lostId, foundId, req.auth.id, message.trim(), foundId]
      );

      if (!record.affectedRows) {
        throw Object.assign(new Error("Found item is not available for recovery."), { statusCode: 400 });
      }

      recordId = record.insertId;

      await connection.execute(
        "UPDATE lost_items SET status = 'RECOVERY_REQUESTED' WHERE id = ?",
        [lostId]
      );

      await connection.execute(
        `INSERT INTO admin_contact_requests
          (user_id, lost_item_id, found_item_id, message, status)
         VALUES (?, ?, ?, ?, 'PENDING')`,
        [req.auth.id, lostId, foundId, message.trim()]
      );

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    res.status(201).json({ id: recordId, status: "PENDING", message: "Request submitted to administration for verification." });
  } catch (error) {
    next(error);
  }
});

// User views their notifications.
router.get("/notifications", authenticate(["user"]), async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, message, is_read, created_at
         FROM notifications
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 100`,
      [req.auth.id]
    );
    res.json({ notifications: rows });
  } catch (error) {
    next(error);
  }
});

// Mark one of the signed-in user's notifications as read.
router.patch("/notifications/:id/read", authenticate(["user"]), async (req, res, next) => {
  try {
    if (!/^\d+$/.test(req.params.id)) {
      return res.status(400).json({ error: "Invalid notification reference." });
    }
    const [result] = await pool.execute(
      "UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?",
      [Number(req.params.id), req.auth.id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: "Notification not found." });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;