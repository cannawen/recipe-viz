import { GoogleGenAI } from "@google/genai";
import type { EquipmentExtractionResult, Ingredient } from "../types";
import { safeJsonParse } from "./shared";

const MODEL_NAME = "gemini-3-flash-preview";

export async function extractEquipment(
  ai: GoogleGenAI,
  pageText: string,
  ingredients: Ingredient[],
): Promise<EquipmentExtractionResult> {
  const prompt = [
    "Extract each distinct piece of kitchen equipment needed by the recipe text.",
    "Examples include large bowl, medium bowl, oven, whisk, baking sheet, etc.",
    "Return JSON only, no markdown.",
    "Schema:",
    "{",
    '  "equipment": [{ "name": "string", "notes": "string?" }],',
    '  "warnings": ["string"]',
    "}",
    "Only include equipment that is actually used in recipe steps.",
    "ingredients:",
    JSON.stringify(ingredients),
    "text:",
    pageText.slice(0, 40_000),
  ].join("\n");

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
  });

  const text = response.text ?? "";
  const parsed = safeJsonParse<EquipmentExtractionResult>(text);

  return {
    equipment: parsed.equipment ?? [],
    warnings: parsed.warnings,
  };
}
