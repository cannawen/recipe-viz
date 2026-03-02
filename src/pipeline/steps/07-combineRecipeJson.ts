import type {
  ActionMetadata,
  Equipment,
  Ingredient,
  IngredientEquipmentLink,
  RecipeGraph,
  RecipeGraphData,
  RecipeGraphEdge,
  RecipeGraphNode,
} from "../types";

interface BuildRecipeGraphInput {
  sourceUrl: string;
  title?: string;
  ingredients: Ingredient[];
  equipment: Equipment[];
  links: IngredientEquipmentLink[];
  actions: ActionMetadata[];
  warnings?: string[];
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function dedupeWarnings(warnings: string[]): string[] {
  return [...new Set(warnings.map((warning) => warning.trim()).filter(Boolean))];
}

function createNodeId(prefix: string, name: string, used: Set<string>): string {
  const raw = `${prefix}_${name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")}`;
  let candidate = raw || `${prefix}_item`;
  let counter = 2;

  while (used.has(candidate)) {
    candidate = `${raw}_${counter}`;
    counter += 1;
  }

  used.add(candidate);
  return candidate;
}

function pushEdge(edges: RecipeGraphEdge[], seen: Set<string>, from: string, to: string, label?: string): void {
  const key = `${from}|${to}|${label ?? ""}`;
  if (seen.has(key)) {
    return;
  }
  seen.add(key);
  edges.push({ from, to, label });
}

export function combineRecipeJson(input: BuildRecipeGraphInput): RecipeGraphData {
  const nodes: RecipeGraphNode[] = [];
  const edges: RecipeGraphEdge[] = [];
  const edgeKeys = new Set<string>();
  const nodeIds = new Set<string>();

  const ingredientNodeByName = new Map<string, string>();
  const equipmentNodeByName = new Map<string, string>();
  const actionNodeByActionId = new Map<string, string>();

  for (const ingredient of input.ingredients) {
    const id = createNodeId("ingredient", ingredient.name, nodeIds);
    ingredientNodeByName.set(normalizeKey(ingredient.name), id);
    nodes.push({ id, label: ingredient.name, type: "ingredient" });
  }

  for (const item of input.equipment) {
    const id = createNodeId("equipment", item.name, nodeIds);
    equipmentNodeByName.set(normalizeKey(item.name), id);
    nodes.push({ id, label: item.name, type: "equipment" });
  }

  for (const action of input.actions) {
    const label = `${action.id}: ${action.action}`;
    const id = createNodeId("action", action.id, nodeIds);
    actionNodeByActionId.set(action.id, id);
    nodes.push({ id, label, type: "action" });
  }

  for (const link of input.links) {
    const ingredientId = ingredientNodeByName.get(normalizeKey(link.ingredientName));
    const equipmentId = equipmentNodeByName.get(normalizeKey(link.equipmentName));
    if (!ingredientId || !equipmentId) {
      continue;
    }

    pushEdge(edges, edgeKeys, ingredientId, equipmentId, link.action || "uses");
  }

  for (const action of input.actions) {
    const actionNodeId = actionNodeByActionId.get(action.id);
    if (!actionNodeId) {
      continue;
    }

    for (const ingredientName of action.ingredients) {
      const ingredientNodeId = ingredientNodeByName.get(normalizeKey(ingredientName));
      if (ingredientNodeId) {
        pushEdge(edges, edgeKeys, ingredientNodeId, actionNodeId, "input");
      }
    }

    for (const equipmentName of action.equipment) {
      const equipmentNodeId = equipmentNodeByName.get(normalizeKey(equipmentName));
      if (equipmentNodeId) {
        pushEdge(edges, edgeKeys, equipmentNodeId, actionNodeId, "tool");
      }
    }

    for (const dependency of action.dependsOn ?? []) {
      const dependencyNodeId = actionNodeByActionId.get(dependency);
      if (dependencyNodeId) {
        pushEdge(edges, edgeKeys, dependencyNodeId, actionNodeId, "next");
      }
    }
  }

  const graph: RecipeGraph = { nodes, edges };

  return {
    sourceUrl: input.sourceUrl,
    title: input.title,
    ingredients: input.ingredients,
    equipment: input.equipment,
    ingredientEquipmentLinks: input.links,
    actions: input.actions,
    graph,
    flowchartMermaid: "",
    warnings: dedupeWarnings(input.warnings ?? []),
  };
}
