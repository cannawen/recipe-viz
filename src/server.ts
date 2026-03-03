import "dotenv/config";
import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import { buildMermaidFromRecipeFile } from "./recipeMermaid";

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

const recipePath = path.join(__dirname, "..", "recipe.yml");

app.get("/recipe.mmd", (_req, res) => {
  try {
    const graph = buildMermaidFromRecipeFile(recipePath);
    res.type("text/plain").send(graph);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).type("text/plain").send(`Failed to build Mermaid graph: ${message}`);
  }
});

app.post("/api/submit-url", async (req, res) => {
  const { url } = req.body as { url?: string };

  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "Please provide a valid URL string." });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return res.status(400).json({ error: "Please provide a valid absolute URL." });
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return res.status(400).json({ error: "Only http and https URLs are supported." });
  }

  let html: string;
  try {
    const pageResponse = await fetch(parsedUrl.toString(), {
      headers: {
        "User-Agent": "recipe-viz/1.0",
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!pageResponse.ok) {
      return res.status(400).json({ error: `Failed to fetch URL: ${pageResponse.status} ${pageResponse.statusText}` });
    }

    html = await pageResponse.text();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(400).json({ error: `Unable to fetch URL content: ${message}` });
  }

  console.log(html)

  const textRecipe = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      "Given the following HTML, extract only the information required to make the recipe",
       html
      ].join("\n"),
  });

  console.log(textRecipe.text);

  return res.json({ message: textRecipe.text });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});