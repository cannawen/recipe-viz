export interface Ingredient {
  name: string;
  quantity?: string;
  unit?: string;
  notes?: string;
}

export interface IngredientExtractionResult {
  sourceUrl: string;
  title?: string;
  ingredients: Ingredient[];
  warnings?: string[];
}
