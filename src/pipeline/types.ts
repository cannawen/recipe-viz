export interface Ingredient {
  name: string;
  quantity?: string;
  unit?: string;
  notes?: string;
}

export interface Equipment {
  name: string;
  notes?: string;
}

export interface IngredientEquipmentLink {
  ingredientName: string;
  equipmentName: string;
  action?: string;
  stepText?: string;
}

export interface ActionMetadata {
  id: string;
  action: string;
  description: string;
  equipment: string[];
  ingredients: string[];
  dependsOn?: string[];
}

export type RecipeGraphNodeType = "ingredient" | "equipment" | "action";

export interface RecipeGraphNode {
  id: string;
  label: string;
  type: RecipeGraphNodeType;
}

export interface RecipeGraphEdge {
  from: string;
  to: string;
  label?: string;
}

export interface RecipeGraph {
  nodes: RecipeGraphNode[];
  edges: RecipeGraphEdge[];
}

export interface IngredientExtractionResult {
  sourceUrl: string;
  title?: string;
  ingredients: Ingredient[];
  warnings?: string[];
}

export interface EquipmentExtractionResult {
  equipment: Equipment[];
  warnings?: string[];
}

export interface IngredientEquipmentLinkResult {
  links: IngredientEquipmentLink[];
  warnings?: string[];
}

export interface ActionMetadataResult {
  actions: ActionMetadata[];
  warnings?: string[];
}

export interface RecipeGraphData {
  sourceUrl: string;
  title?: string;
  ingredients: Ingredient[];
  equipment: Equipment[];
  ingredientEquipmentLinks: IngredientEquipmentLink[];
  actions: ActionMetadata[];
  graph: RecipeGraph;
  flowchartMermaid: string;
  warnings?: string[];
}
