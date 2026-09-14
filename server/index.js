import "dotenv/config";
import express from "express";
import cors from "cors";
import { GoogleGenAI } from "@google/genai";
import { fetchTranscript } from "youtube-transcript";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

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

    console.log(embeddings[0]);

    res.json({
      numberOfChunks: chunks.length,
      firstEmbedding: embeddings[0],
    });
  } catch (error) {
    console.error("VIDEO ERROR:", error);

    res.status(500).json({
      error: error.message,
    });
  }
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});