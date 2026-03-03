import "dotenv/config";
import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import fs from "node:fs";
import { isMap, isScalar, isSeq, parseDocument } from "yaml";

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

const normalizeId = (value: string): string => value.trim().replace(/:+$/, "");

const toNodeId = (prefix: string, value: string): string => {
  const slug = normalizeId(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return `${prefix}_${slug || "item"}`;
};

const escapeMermaidLabel = (value: string): string => value.replace(/"/g, '\\"');

function buildMermaidFromRecipeYaml(rawYaml: string): string {
  const normalizedRaw = rawYaml.replace(
    /^(\s*id:\s*)([^"'#\n][^#\n]*?):\s*$/gm,
    (_match: string, prefix: string, value: string) => `${prefix}${value.trim()}`,
  );

  const doc = parseDocument(normalizedRaw, { uniqueKeys: false });
  if (doc.errors.length > 0) {
    throw new Error(doc.errors.map((error) => error.message).join("; "));
  }

  const parsed = doc.toJS() as {
    ingredients?: Array<{ id?: unknown; amount?: unknown; units?: unknown }>;
  };

  const lines: string[] = ["flowchart LR"];
  const ingredientNodeByName = new Map<string, string>();
  const stepNodeByName = new Map<string, string>();
  const ingredientNodeDefinitions: string[] = [];

  const ingredients = Array.isArray(parsed.ingredients) ? parsed.ingredients : [];
  for (const ingredient of ingredients) {
    if (!ingredient || typeof ingredient.id !== "string" || ingredient.id.trim().length === 0) {
      continue;
    }

    const ingredientName = normalizeId(ingredient.id);
    const nodeId = toNodeId("ing", ingredientName);
    const amountText = typeof ingredient.amount === "number" ? `${ingredient.amount}` : "";
    const unitsText = typeof ingredient.units === "string" && ingredient.units.trim().length > 0
      ? ingredient.units.trim()
      : "";
    const label = [amountText, unitsText, ingredientName].filter(Boolean).join(" ");

    ingredientNodeByName.set(ingredientName, nodeId);
    ingredientNodeDefinitions.push(`    ${nodeId}["${escapeMermaidLabel(label)}"]`);
  }

  if (ingredientNodeDefinitions.length > 0) {
    lines.push("  subgraph ingredients[Ingredients]");
    lines.push("    direction TB");
    lines.push(...ingredientNodeDefinitions);
    lines.push("  end");
  }

  const rootNode = doc.contents;
  const stepsNode = isMap(rootNode) && rootNode.get("steps", true) ? rootNode.get("steps", true) : null;

  if (!stepsNode || !isMap(stepsNode)) {
    return lines.join("\n");
  }

  type ParsedStep = { id: string; action: string; dependencies: string[] };
  const parsedSteps: ParsedStep[] = [];

  for (let index = 0; index + 1 < stepsNode.items.length; index += 2) {
    const idPair = stepsNode.items[index];
    const actionPair = stepsNode.items[index + 1];

    const idKey = isScalar(idPair.key) ? String(idPair.key.value ?? "") : "";
    if (idKey !== "id") {
      continue;
    }

    const rawStepId = isScalar(idPair.value) ? String(idPair.value.value ?? "") : "";
    const stepId = normalizeId(rawStepId);
    if (!stepId) {
      continue;
    }

    const action = isScalar(actionPair.key) ? String(actionPair.key.value ?? "") : "";
    if (!action || action === "id") {
      continue;
    }

    const valueNode = actionPair.value;
    if (!isSeq(valueNode)) {
      continue;
    }

    const dependencies = valueNode.items
      .filter((item) => isScalar(item) && typeof item.value === "string" && item.value.trim().length > 0)
      .map((item) => normalizeId(String((item as { value: string }).value)));

    parsedSteps.push({ id: stepId, action, dependencies });
  }

  for (const step of parsedSteps) {
    const nodeId = toNodeId("step", step.id);
    stepNodeByName.set(step.id, nodeId);
    lines.push(`  ${nodeId}["${escapeMermaidLabel(`${step.id} (${step.action})`)}"]`);
  }

  for (const step of parsedSteps) {
    const stepNodeId = stepNodeByName.get(step.id);
    if (!stepNodeId) {
      continue;
    }

    for (const dep of step.dependencies) {
      const sourceId = ingredientNodeByName.get(dep) || stepNodeByName.get(dep);
      if (!sourceId) {
        continue;
      }

      lines.push(`  ${sourceId} --> ${stepNodeId}`);
    }
  }

  return lines.join("\n");
}

app.get("/recipe.mmd", (_req, res) => {
  try {
    const rawYaml = fs.readFileSync(recipePath, "utf8");
    const graph = buildMermaidFromRecipeYaml(rawYaml);
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