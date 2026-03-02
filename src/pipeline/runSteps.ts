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
  console.log(`[pipeline] Step 00 done: validated URL (${parsedUrl.toString()})`);

  const html = await fetchHtml(parsedUrl);
  console.log("[pipeline] Step 01 done: fetched HTML");

  const text = htmlToText(html);
  console.log("[pipeline] Step 02 done: converted HTML to text");

  const ingredientResult = await extractIngredients(ai, parsedUrl.toString(), text);
  console.log(
    `[pipeline] Step 03 done: extracted ingredients (${ingredientResult.ingredients.length})`,
  );

  const equipmentResult = await extractEquipment(ai, text, ingredientResult.ingredients);
  console.log(`[pipeline] Step 04 done: extracted equipment (${equipmentResult.equipment.length})`);

  const ingredientEquipmentResult = await linkIngredientsToEquipment(
    ai,
    text,
    ingredientResult.ingredients,
    equipmentResult.equipment,
  );
  console.log(
    `[pipeline] Step 05 done: linked ingredients to equipment (${ingredientEquipmentResult.links.length})`,
  );

  const actionResult = await extractActionMetadata(
    ai,
    text,
    ingredientResult.ingredients,
    equipmentResult.equipment,
  );
  console.log(`[pipeline] Step 06 done: extracted action metadata (${actionResult.actions.length})`);

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
  console.log("[pipeline] Step 07 done: combined recipe JSON");

  const flowchart = buildFlowchart(combined);
  console.log("[pipeline] Step 08 done: built flowchart");

  return flowchart;
}
