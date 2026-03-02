import { GoogleGenAI } from "@google/genai";
import { fetchHtml } from "./steps/01-fetchHtml";
import { htmlToText } from "./steps/02-htmlToText";
import { extractIngredients } from "./steps/03-extractIngredients";
import type { IngredientExtractionResult } from "./types";

export class UrlValidationError extends Error {}

export function validateRecipeUrl(url: string): URL {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);
  } catch {
    throw new UrlValidationError("Please provide a valid absolute URL.");
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new UrlValidationError("Only http and https URLs are supported.");
  }

  return parsedUrl;
}

export async function processRecipeUrl(ai: GoogleGenAI, url: string): Promise<IngredientExtractionResult> {
  const parsedUrl = validateRecipeUrl(url);
  const html = await fetchHtml(parsedUrl);
  const text = htmlToText(html);
  const ingredients = await extractIngredients(ai, parsedUrl.toString(), text);
  return ingredients;
}
