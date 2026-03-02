import { GoogleGenAI } from "@google/genai";
import type { ActionMetadataResult, Equipment, Ingredient } from "../types";
import { createApiCacheKey, readApiCache, safeJsonParse, writeApiCache } from "./shared";

const MODEL_NAME = "gemini-3-flash-preview";

export async function extractActionMetadata(
  ai: GoogleGenAI,
  pageText: string,
  ingredients: Ingredient[],
  equipment: Equipment[],
): Promise<ActionMetadataResult> {
  const prompt = [
    "Extract recipe action metadata as ordered steps.",
    "Example action: whisk all dry ingredients in large bowl.",
    "Return JSON only, no markdown.",
    "Schema:",
    "{",
    '  "actions": [',
    '    { "id": "a1", "action": "string", "description": "string", "equipment": ["string"], "ingredients": ["string"], "dependsOn": ["a0?"] }',
    "  ],",
    '  "warnings": ["string"]',
    "}",
    "Requirements:",
    "- Keep actions in recipe order.",
    "- `id` must be unique and short (a1, a2, ...).",
    "- `ingredients` must use names from provided ingredient list.",
    "- `equipment` must use names from provided equipment list.",
    "ingredients:",
    JSON.stringify(ingredients),
    "equipment:",
    JSON.stringify(equipment),
    "text:",
    pageText.slice(0, 40_000),
  ].join("\n");

  const cacheKey = createApiCacheKey("extractActionMetadata", `${MODEL_NAME}\n${prompt}`);
  const cachedText = await readApiCache(cacheKey);
  const text = cachedText ?? (await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
  })).text ?? "";

  if (!cachedText) {
    await writeApiCache(cacheKey, text);
  }

  const parsed = safeJsonParse<ActionMetadataResult>(text);

  return {
    actions: parsed.actions ?? [],
    warnings: parsed.warnings,
  };
}
