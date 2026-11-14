const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const authRoutes = require("./routes/auth");
const itemRoutes = require("./routes/items");
const adminRoutes = require("./routes/admin");

const app = express();

const allowedOrigins = (process.env.CLIENT_ORIGINS || "")
  .split(",")
  .map(origin => origin.trim())
  .filter(Boolean);

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    // Permit non-browser tools such as curl when Origin is not present.
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Origin is not allowed by CORS."));
  },
  methods: ["GET", "POST", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});
app.use("/api/auth", authRoutes);
app.use("/api/items", itemRoutes);
app.use("/api/admin", adminRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found." });
});

app.use((error, req, res, next) => {
  console.error(error);

  if (error.code === "ER_DUP_ENTRY") {
    return res.status(409).json({ error: "A record with those details already exists." });
  }

  if (error.statusCode) {
    return res.status(error.statusCode).json({ error: error.message });
  }

  if (error.message === "Origin is not allowed by CORS.") {
    return res.status(403).json({ error: "This website origin is not allowed." });
  }

  return res.status(500).json({ error: "An unexpected server error occurred." });
});

module.exports = app;