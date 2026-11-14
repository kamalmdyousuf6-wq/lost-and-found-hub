const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const pool = require("../db");

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many sign-in attempts. Try again later." }
});

function validEmail(email) {
  return typeof email === "string"
    && email.length <= 254
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function createToken(account, role) {
  return jwt.sign(
    { role },
    process.env.JWT_SECRET,
    {
      subject: String(account.id),
      expiresIn: process.env.JWT_EXPIRES_IN || "2h",
      algorithm: "HS256"
    }
  );
}

// Create a regular user account.
router.post("/register", async (req, res, next) => {
  try {
    const { name, email, password } = req.body || {};

    if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 120) {
      return res.status(400).json({ error: "Name must be between 2 and 120 characters." });
    }
    if (!validEmail(email)) {
      return res.status(400).json({ error: "Enter a valid email address." });
    }
    if (typeof password !== "string" || password.length < 8 || password.length > 72) {
      return res.status(400).json({ error: "Password must be between 8 and 72 characters." });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const [result] = await pool.execute(
      "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
      [name.trim(), email.trim().toLowerCase(), passwordHash]
    );

    const user = {
      id: result.insertId,
      name: name.trim(),
      email: email.trim().toLowerCase()
    };

    return res.status(201).json({
      user,
      token: createToken(user, "user")
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "An account with that email already exists." });
    }
    next(error);
  }
});

// Regular user sign-in.
router.post("/login", loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!validEmail(email) || typeof password !== "string") {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const [rows] = await pool.execute(
      "SELECT id, name, email, password FROM users WHERE email = ? LIMIT 1",
      [email.trim().toLowerCase()]
    );

    const account = rows[0];
    if (!account || !(await bcrypt.compare(password, account.password))) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    return res.json({
      user: { id: account.id, name: account.name, email: account.email },
      token: createToken(account, "user")
    });
  } catch (error) {
    next(error);
  }
});

// Admin sign-in. Admin accounts must be provisioned securely by the project owner.
router.post("/admin/login", loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!validEmail(email) || typeof password !== "string") {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const [rows] = await pool.execute(
      "SELECT id, name, email, password FROM admin_users WHERE email = ? LIMIT 1",
      [email.trim().toLowerCase()]
    );

    const account = rows[0];
    if (!account || !(await bcrypt.compare(password, account.password))) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    return res.json({
      user: { id: account.id, name: account.name, email: account.email },
      token: createToken(account, "admin")
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;