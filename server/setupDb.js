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

    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS videos (
        video_id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        chunk_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    console.log("Documents table created!");
    console.log("Videos table created!");
  } catch (error) {
    console.error("DATABASE SETUP ERROR:", error);
  } finally {
    await pool.end();
  }
};

createTable();