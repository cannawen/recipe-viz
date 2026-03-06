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

const recipeFileByKey: Record<string, string> = {
  cookie: "cookie.yml",
  kimchi: "kimchi.yml",
};

app.get("/recipe.mmd", (req, res) => {
  try {
    const recipeKeyRaw = typeof req.query.recipe === "string" ? req.query.recipe : "";
    const recipeKey = recipeKeyRaw.trim().toLowerCase();
    if (!recipeKey) {
      return res.status(400).type("text/plain").send("Missing recipe query parameter. Use one of: cookie, kimchi");
    }

    const recipeFile = recipeFileByKey[recipeKey];
    if (!recipeFile) {
      return res.status(400).type("text/plain").send(`Unknown recipe '${recipeKeyRaw}'. Use one of: ${Object.keys(recipeFileByKey).join(", ")}`);
    }

    const recipePath = path.join(__dirname, "..", recipeFile);
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

app.get("/viz", (_req, res) => {
  res
    .type("text/html")
    .send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Recipe Visualizations</title>
    <style>
      body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 48px auto; max-width: 640px; padding: 0 16px; }
      h1 { margin-bottom: 8px; }
      ul { padding-left: 20px; }
      li { margin: 8px 0; }
    </style>
  </head>
  <body>
    <h1>Choose a Visualization</h1>
    <ul>
      <li><a href="/viz.html?recipe=cookie">Cookie</a></li>
      <li><a href="/viz.html?recipe=kimchi">Kimchi</a></li>
    </ul>
  </body>
</html>`);
});

app.get(["/cookie", "/kimchi"], (req, res) => {
  res.sendFile(path.join(publicDir, "viz.html"));
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});