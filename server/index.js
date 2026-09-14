import "dotenv/config";
import express from "express";
import cors from "cors";
import { GoogleGenAI } from "@google/genai";
import { fetchTranscript } from "youtube-transcript";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import pool from "./db.js";

const app = express();

app.use(cors());
app.use(express.json());

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

app.get("/", (req, res) => {
  res.send("Hello from the server!");
});

app.post("/api/chat", async (req, res) => {
  try {
    const { question } = req.body;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: question,
    });

    res.json({
      answer: response.text,
    });
  } catch (error) {
  console.error("GEMINI ERROR:", error);

  res.status(500).json({
    error: error.message,
  });
}
});

app.post("/api/video", async (req, res) => {
  try {
    const { youtubeUrl } = req.body;

    const videoId = new URL(youtubeUrl).searchParams.get("v");

    if (!videoId) {
      return res.status(400).json({
        error: "Invalid YouTube URL",
      });
    }

    const transcript = await fetchTranscript(videoId);

    const text = transcript
      .map((item) => item.text)
      .join(" ");

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const chunks = await splitter.createDocuments([text]);

    const embeddingResponse = await ai.models.embedContent({
      model: "gemini-embedding-001",
      contents: chunks.map((chunk) => chunk.pageContent),
    });

    const embeddings = embeddingResponse.embeddings;

    for (let i = 0; i < chunks.length; i++) {
      await pool.query(
        `
        INSERT INTO documents (video_id, content, embedding)
        VALUES ($1, $2, $3)
        `,
        [
          videoId,
          chunks[i].pageContent,
          JSON.stringify(embeddings[i].values),
        ]
      );
    }

    res.json({
      message: "Video processed and stored successfully",
      numberOfChunks: chunks.length,
    });
  } catch (error) {
    console.error("VIDEO ERROR:", error);

    res.status(500).json({
      error: error.message,
    });
  }
});

app.get("/api/db-test", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");

    res.json({
      message: "Database connected!",
      time: result.rows[0],
    });
  } catch (error) {
    console.error("DATABASE ERROR:", error);

    res.status(500).json({
      error: error.message,
    });
  }
});


//NOW COMES THE MOST IMPORTANT PART ->

// Question
//    ↓
// Gemini embedding
//    ↓
// question vector
//    ↓
// compare against vectors in PostgreSQL
//    ↓
// find closest chunks
//    ↓
// return top 3/5 chunks
//    ↓
// Gemini receives those chunks
//    ↓
// answer

// This is the retrieval part of RAG (Retrieval-Augmented Generation)

app.post("/api/search", async (req, res) => {
  try {
    const { question, videoId } = req.body;

    const embeddingResponse = await ai.models.embedContent({
      model: "gemini-embedding-001",
      contents: question,
    });

    const questionEmbedding =
      embeddingResponse.embeddings[0].values;

    const result = await pool.query(
      `
      SELECT
        id,
        content,
        embedding <=> $1 AS distance
      FROM documents
      WHERE video_id = $2
      ORDER BY embedding <=> $1
      LIMIT 5
      `,
      [
        JSON.stringify(questionEmbedding),
        videoId,
      ]
    );

    res.json({
      results: result.rows,
    });
  } catch (error) {
    console.error("SEARCH ERROR:", error);

    res.status(500).json({
      error: error.message,
    });
  }
});


app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});

