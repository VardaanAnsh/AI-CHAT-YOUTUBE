import pool from "./db.js";

const createTable = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        video_id TEXT NOT NULL,
        content TEXT NOT NULL,
        embedding VECTOR(3072) NOT NULL
      );
    `);

    console.log("Documents table created!");
  } catch (error) {
    console.error("DATABASE SETUP ERROR:", error);
  } finally {
    await pool.end();
  }
};

createTable();