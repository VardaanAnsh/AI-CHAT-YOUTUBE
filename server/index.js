import "dotenv/config";
import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();

app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.get("/", (req, res) => {
  res.send("Hello from the server!");
});


app.post("/api/chat", async (req, res) => {
  try {
    const { question } = req.body;

    const response = await openai.responses.create({
      model: "gpt-5.6-luna",
      input: question
    });

    res.json({
      answer: response.output_text
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Something went wrong"
    });
  }
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});