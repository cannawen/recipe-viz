import { GoogleGenAI } from "@google/genai";
import type { IngredientExtractionResult } from "../types";
import { createApiCacheKey, readApiCache, safeJsonParse, writeApiCache } from "./shared";

const MODEL_NAME = "gemini-3-flash-preview";

export async function extractIngredients(
  ai: GoogleGenAI,
  sourceUrl: string,
  pageText: string,
): Promise<IngredientExtractionResult> {
  const prompt = [
    "Extract recipe ingredients from the text below.",
    "Return JSON only, no markdown.",
    "Schema:",
    "{",
    '  "sourceUrl": "string",',
    '  "title": "string (optional)",',
    '  "ingredients": [{ "name": "string", "quantity": "string?", "unit": "string?", "notes": "string?" }],',
    '  "warnings": ["string"]',
    "}",
    `sourceUrl: ${sourceUrl}`,
    "text:",
    pageText.slice(0, 40_000),
  ].join("\n");

  const cacheKey = createApiCacheKey("extractIngredients", `${MODEL_NAME}\n${prompt}`);
  const cachedText = await readApiCache(cacheKey);
  const text = cachedText ?? (await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
  })).text ?? "";

  if (!cachedText) {
    await writeApiCache(cacheKey, text);
  }

  const parsed = safeJsonParse<IngredientExtractionResult>(text);

  return {
    sourceUrl,
    ingredients: parsed.ingredients ?? [],
    title: parsed.title,
    warnings: parsed.warnings,
  };
}
