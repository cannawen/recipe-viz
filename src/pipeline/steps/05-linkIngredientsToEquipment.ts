import { GoogleGenAI } from "@google/genai";
import type { Equipment, Ingredient, IngredientEquipmentLinkResult } from "../types";
import { createApiCacheKey, readApiCache, safeJsonParse, writeApiCache } from "./shared";

const MODEL_NAME = "gemini-3-flash-preview";

export async function linkIngredientsToEquipment(
  ai: GoogleGenAI,
  pageText: string,
  ingredients: Ingredient[],
  equipment: Equipment[],
): Promise<IngredientEquipmentLinkResult> {
  const prompt = [
    "Map ingredients to equipment based on recipe actions.",
    "Example: place flour, salt, and baking soda into large bowl.",
    "Return JSON only, no markdown.",
    "Schema:",
    "{",
    '  "links": [{ "ingredientName": "string", "equipmentName": "string", "action": "string?", "stepText": "string?" }],',
    '  "warnings": ["string"]',
    "}",
    "ingredientName must match one ingredient from the list.",
    "equipmentName must match one equipment name from the list.",
    "ingredients:",
    JSON.stringify(ingredients),
    "equipment:",
    JSON.stringify(equipment),
    "text:",
    pageText.slice(0, 40_000),
  ].join("\n");

  const cacheKey = createApiCacheKey("linkIngredientsToEquipment", `${MODEL_NAME}\n${prompt}`);
  const cachedText = await readApiCache(cacheKey);
  const text = cachedText ?? (await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
  })).text ?? "";

  if (!cachedText) {
    await writeApiCache(cacheKey, text);
  }

  const parsed = safeJsonParse<IngredientEquipmentLinkResult>(text);

  return {
    links: parsed.links ?? [],
    warnings: parsed.warnings,
  };
}
