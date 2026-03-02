import { GoogleGenAI } from "@google/genai";
import { fetchHtml } from "./steps/01-fetchHtml";
import { htmlToText } from "./steps/02-htmlToText";
import { extractIngredients } from "./steps/03-extractIngredients";
import { extractEquipment } from "./steps/04-extractEquipment";
import { linkIngredientsToEquipment } from "./steps/05-linkIngredientsToEquipment";
import { extractActionMetadata } from "./steps/06-extractActionMetadata";
import { combineRecipeJson } from "./steps/07-combineRecipeJson";
import { buildFlowchart } from "./steps/08-buildFlowchart";
import type { RecipeGraphData } from "./types";

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

export async function processRecipeUrl(ai: GoogleGenAI, url: string): Promise<RecipeGraphData> {
  const parsedUrl = validateRecipeUrl(url);
  const html = await fetchHtml(parsedUrl);
  const text = htmlToText(html);
  const ingredientResult = await extractIngredients(ai, parsedUrl.toString(), text);
  const equipmentResult = await extractEquipment(ai, text, ingredientResult.ingredients);
  const ingredientEquipmentResult = await linkIngredientsToEquipment(
    ai,
    text,
    ingredientResult.ingredients,
    equipmentResult.equipment,
  );
  const actionResult = await extractActionMetadata(
    ai,
    text,
    ingredientResult.ingredients,
    equipmentResult.equipment,
  );

  const combined = combineRecipeJson({
    sourceUrl: parsedUrl.toString(),
    title: ingredientResult.title,
    ingredients: ingredientResult.ingredients,
    equipment: equipmentResult.equipment,
    links: ingredientEquipmentResult.links,
    actions: actionResult.actions,
    warnings: [
      ...(ingredientResult.warnings ?? []),
      ...(equipmentResult.warnings ?? []),
      ...(ingredientEquipmentResult.warnings ?? []),
      ...(actionResult.warnings ?? []),
    ],
  });

  return buildFlowchart(combined);
}
