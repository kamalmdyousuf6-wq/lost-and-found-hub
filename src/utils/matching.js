const pool = require("../db");

/**
 * Simple rule-based demo matcher.
 * Category and location comparisons are exact after normalization.
 * This suggestion does not verify ownership.
 */
async function createPossibleMatchesForFound(foundItem) {
  const [lostItems] = await pool.execute(
    `SELECT id, title, category, description, location_lost
       FROM lost_items
      WHERE status IN ('LOST', 'MATCHED')
      ORDER BY created_at DESC
      LIMIT 500`
  );

  for (const lost of lostItems) {
    const reasons = [];
    let score = 0;

    if (lost.category.trim().toLowerCase() === foundItem.category.trim().toLowerCase()) {
      score += 55;
      reasons.push("Same category");
    }

    if (lost.location_lost.trim().toLowerCase() === foundItem.location_found.trim().toLowerCase()) {
      score += 30;
      reasons.push("Same reported location");
    }

    const lostWords = new Set(
      `${lost.title} ${lost.description}`.toLowerCase().match(/[a-z0-9]+/g) || []
    );
    const foundWords = new Set(
      `${foundItem.title} ${foundItem.description}`.toLowerCase().match(/[a-z0-9]+/g) || []
    );

    const sharedWords = [...lostWords].filter(word => word.length > 3 && foundWords.has(word));
    if (sharedWords.length) {
      score += Math.min(15, sharedWords.length * 5);
      reasons.push(`Shared description words: ${sharedWords.slice(0, 5).join(", ")}`);
    }

    if (score < 30) continue;

    const reason = reasons.join("; ");

    await pool.execute(
      `INSERT INTO matches
         (lost_item_id, found_item_id, match_score, match_reason, status)
       VALUES (?, ?, ?, ?, 'POSSIBLE')
       ON DUPLICATE KEY UPDATE
         match_score = VALUES(match_score),
         match_reason = VALUES(match_reason)`,
      [lost.id, foundItem.id, Math.min(score, 100), reason]
    );

    await pool.execute(
      "UPDATE lost_items SET status = 'MATCHED' WHERE id = ? AND status = 'LOST'",
      [lost.id]
    );

    // Notify the lost report's owner. Never expose either party's contact information.
    await pool.execute(
      "INSERT INTO notifications (user_id, message) SELECT user_id, ? FROM lost_items WHERE id = ?",
      [`A possible match was identified for your lost item report #${lost.id}. Contact administration to ask about it.`, lost.id]
    );
  }
}

module.exports = { createPossibleMatchesForFound };