import "dotenv/config";
import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import { processRecipeUrl, UrlValidationError } from "./pipeline/processRecipeUrl";

const app = express();
const port = process.env.PORT || 3000;
const geminiApiKey = process.env.GEMINI_API_KEY;

if (!geminiApiKey) {
  throw new Error("Missing GEMINI_API_KEY. Add it to your .env file.");
}

// The client gets the API key from the environment variable `GEMINI_API_KEY`.
const ai = new GoogleGenAI({apiKey: geminiApiKey});

app.use(express.json());

const publicDir = path.join(__dirname, "..", "public");
app.use(express.static(publicDir));

app.post("/api/submit-url", async (req, res) => {
  const { url } = req.body as { url?: string };

  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "Please provide a valid URL string." });
  }

  try {
    const result = await processRecipeUrl(ai, url);
    return res.json(result);
  } catch (error) {
    if (error instanceof UrlValidationError) {
      return res.status(400).json({ error: error.message });
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(400).json({ error: `Unable to process URL: ${message}` });
  }
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});