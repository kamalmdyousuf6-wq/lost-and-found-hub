require("dotenv").config();

const app = require("./src/app");
const pool = require("./src/db");

const port = Number(process.env.PORT || 3000);

async function start() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET must be set to a random string of at least 32 characters.");
  }

  // Check database connectivity before accepting requests.
  await pool.query("SELECT 1");

app.listen(port, "0.0.0.0", () => {
      console.log(`Lost & Found Hub API listening on port ${port}`);
  });
}

start().catch(error => {
  console.error("Failed to start API:", error.message);
  process.exit(1);
});

process.on("SIGINT", async () => {
  await pool.end();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await pool.end();
  process.exit(0);
});