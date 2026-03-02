import { GoogleGenAI } from "@google/genai";
import { fetchHtml } from "./fetchHtml";
import { htmlToText } from "./htmlToText";
import { extractIngredients } from "./extractIngredients";
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
  console.log(parsedUrl);
  const html = await fetchHtml(parsedUrl);
  console.log(html);
  const text = htmlToText(html);
  console.log(text);
  const ingredients = await extractIngredients(ai, parsedUrl.toString(), text);
  console.log(ingredients)
  return ingredients
}
