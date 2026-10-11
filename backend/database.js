const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL;
const databaseHost = connectionString
  ? new URL(connectionString).hostname.replace(/^\[|\]$/g, "").toLowerCase()
  : "";
const isLocalDatabase = ["localhost", "127.0.0.1", "::1"].includes(databaseHost);

const pool = new Pool({
  ...(connectionString ? { connectionString } : {}),
  ssl: connectionString && !isLocalDatabase
    ? { rejectUnauthorized: false }
    : false,
  max: 5,
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error:", error.message);
});

module.exports = pool;
