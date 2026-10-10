const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
});

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
  }

  try {
    const result = await pool.query(
      "SELECT NOW() AS server_time, current_database() AS database_name",
    );

    return res.status(200).json({
      success: true,
      message: "Neon database connected",
      database: result.rows[0].database_name,
      time: result.rows[0].server_time,
    });
  } catch (error) {
    console.error("Database error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Database connection failed",
    });
  }
};
