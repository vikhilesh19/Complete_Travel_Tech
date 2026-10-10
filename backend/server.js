
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
const port = 5000;

app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173"
}));

app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.get("/api/health", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT NOW() AS server_time, current_database() AS database_name"
    );

    res.json({
      success: true,
      message: "Neon database connected",
      database: result.rows[0].database_name,
      time: result.rows[0].server_time
    });
  } catch (error) {
    console.error("Database error:", error.message);
    res.status(500).json({
      success: false,
      error: "Database connection failed"
    });
  }
});

app.listen(port, () => {
  console.log(`Backend running at http://localhost:${port}`);
});