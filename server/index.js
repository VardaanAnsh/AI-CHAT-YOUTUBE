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

//endpoint to get the title of video from youtube url for storing in the database

async function fetchVideoTitle(youtubeUrl) {
  const oEmbedUrl = new URL(
    "https://www.youtube.com/oembed"
  );

  oEmbedUrl.searchParams.set("url", youtubeUrl);
  oEmbedUrl.searchParams.set("format", "json");

  const response = await fetch(oEmbedUrl);

  if (!response.ok) {
    throw new Error("Unable to fetch YouTube video metadata.");
  }

  const data = await response.json();

  return data.title;
}

//api-endpoints
// I separated video-level metadata from transcript chunks.
// The videos table stores one record per YouTube video,
// while documents stores multiple transcript chunks and their vector embeddings.
// The video ID acts as the primary key for metadata, 
// and I use an upsert to update an existing video's metadata
// rather than creating duplicate metadata records.
app.post("/api/video", async (req, res) => {
  try {
    
    const { youtubeUrl } = req.body;

    if (!youtubeUrl) {
      return res.status(400).json({
        error: "YouTube URL is required",
      });
    }

    const parsedUrl = new URL(youtubeUrl);
    const videoId = parsedUrl.searchParams.get("v");

    if (!videoId) {
      return res.status(400).json({
        error: "Invalid YouTube URL",
      });
    }
    
    const existingVideo = await pool.query(
      "SELECT video_id FROM videos WHERE video_id = $1",
      [videoId]
    );

    if (existingVideo.rows.length > 0) {
      return res.status(200).json({
        message: "Video already processed",
        alreadyProcessed: true,
        videoId
      });
    }
    const title = await fetchVideoTitle(youtubeUrl);

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

    
    const client = await pool.connect();

    try {
      // Start a database transaction
      await client.query("BEGIN");

      // Insert all transcript chunks
      for (let i = 0; i < chunks.length; i++) {
        await client.query(
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

      // Insert or update video metadata
      await client.query(
        `
        INSERT INTO videos (video_id, title, chunk_count)
        VALUES ($1, $2, $3)
        ON CONFLICT (video_id)
        DO UPDATE SET
          title = EXCLUDED.title,
          chunk_count = EXCLUDED.chunk_count
        `,
        [videoId, title, chunks.length]
      );

      // Save all database changes together
      await client.query("COMMIT");

    } catch (error) {
      // Undo database changes if anything failed
      await client.query("ROLLBACK");
      throw error;

    } finally {
      // Always release the database connection
      client.release();
    }
    
    res.json({
      message: "Video processed and stored successfully",
      videoId,
      title,
      numberOfChunks: chunks.length,
    });

  } catch (error) {
    console.error("VIDEO ERROR:", error);

    res.status(500).json({
      error: error.message,
    });
  }
});

// app.get("/api/db-test", async (req, res) => {
//   try {
//     const result = await pool.query("SELECT NOW()");

//     res.json({
//       message: "Database connected!",
//       time: result.rows[0],
//     });
//   } catch (error) {
//     console.error("DATABASE ERROR:", error);

//     res.status(500).json({
//       error: error.message,
//     });
//   }
// });


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

//  COMPLETE FLOW OF OUR RAG (RETRIEVAL-AUGMENTED GENERATION) APPLICATION:
// YouTube URL
//      ↓
// Transcript
//      ↓
// Split into chunks
//      ↓
// Gemini Embeddings
//      ↓
// PostgreSQL + pgvector
//      ↓
//         USER QUESTION
//              ↓
//       Gemini embedding
//              ↓
//       pgvector similarity
//              ↓
//        Top 5 chunks
//              ↓
//        Context + Question
//              ↓
//           Gemini
//              ↓
//            Answer

app.post("/api/chat", async (req, res) => {
  try {
    const { question, videoId } = req.body;

    // 1. Embed the question
    const embeddingResponse = await ai.models.embedContent({
      model: "gemini-embedding-001",
      contents: question,
    });

    const questionEmbedding =
      embeddingResponse.embeddings[0].values;

    // 2. Retrieve relevant chunks
    const result = await pool.query(
      `
      SELECT content, embedding <=> $1::vector AS distance
      FROM documents
      WHERE video_id = $2
      ORDER BY embedding <=> $1::vector
      LIMIT 5
      `,
      [
        JSON.stringify(questionEmbedding),
        videoId,
      ]
    );

    const context = result.rows
      .map((row) => row.content)
      .join("\n\n");

    // 3. Ask Gemini using retrieved context
    const prompt = `
You are an assistant that answers questions about a YouTube video.

Use ONLY the transcript context provided below.

If the answer is not present in the context, say:
"I couldn't find that information in the video."

Transcript context:
${context}

Question:
${question}
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
    });

    res.json({
      answer: response.text,
    });

  } catch (error) {
    console.error("RAG ERROR:", error);

    res.status(500).json({
      error: error.message,
    });
  }
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});

