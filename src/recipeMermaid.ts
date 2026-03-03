import fs from "node:fs";
import { isMap, isScalar, isSeq, parseDocument } from "yaml";

const normalizeId = (value: string): string => value.trim().replace(/:+$/, "");

const toNodeId = (prefix: string, value: string): string => {
  const slug = normalizeId(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return `${prefix}_${slug || "item"}`;
};

const escapeMermaidLabel = (value: string): string => value.replace(/"/g, '\\"');

export function buildMermaidFromRecipeYaml(rawYaml: string): string {
  const normalizedRaw = rawYaml.replace(
    /^(\s*id:\s*)([^"'#\n][^#\n]*?):\s*$/gm,
    (_match: string, prefix: string, value: string) => `${prefix}${value.trim()}`,
  );

  const doc = parseDocument(normalizedRaw, { uniqueKeys: false });
  if (doc.errors.length > 0) {
    throw new Error(doc.errors.map((error) => error.message).join("; "));
  }

  const parsed = doc.toJS() as {
    ingredients?: Array<{ id?: unknown; amount?: unknown; units?: unknown }>;
  };

  const lines: string[] = ["flowchart LR"];
  const ingredientNodeByName = new Map<string, string>();
  const stepNodeByName = new Map<string, string>();
  const ingredientNodeDefinitions: string[] = [];

  const ingredients = Array.isArray(parsed.ingredients) ? parsed.ingredients : [];
  for (const ingredient of ingredients) {
    if (!ingredient || typeof ingredient.id !== "string" || ingredient.id.trim().length === 0) {
      continue;
    }

    const ingredientName = normalizeId(ingredient.id);
    const nodeId = toNodeId("ing", ingredientName);
    const amountText = typeof ingredient.amount === "number" ? `${ingredient.amount}` : "";
    const unitsText = typeof ingredient.units === "string" && ingredient.units.trim().length > 0
      ? ingredient.units.trim()
      : "";
    const label = [amountText, unitsText, ingredientName].filter(Boolean).join(" ");

    ingredientNodeByName.set(ingredientName, nodeId);
    ingredientNodeDefinitions.push(`    ${nodeId}["${escapeMermaidLabel(label)}"]`);
  }

  if (ingredientNodeDefinitions.length > 0) {
    lines.push("  subgraph ingredients[Ingredients]");
    lines.push("    direction TB");
    lines.push(...ingredientNodeDefinitions);
    lines.push("  end");
  }

  const rootNode = doc.contents;
  const stepsNode = isMap(rootNode) && rootNode.get("steps", true) ? rootNode.get("steps", true) : null;

  if (!stepsNode || !isMap(stepsNode)) {
    return lines.join("\n");
  }

  type ParsedStep = { id: string; action: string; dependencies: string[] };
  const parsedSteps: ParsedStep[] = [];

  for (let index = 0; index + 1 < stepsNode.items.length; index += 2) {
    const idPair = stepsNode.items[index];
    const actionPair = stepsNode.items[index + 1];

    const idKey = isScalar(idPair.key) ? String(idPair.key.value ?? "") : "";
    if (idKey !== "id") {
      continue;
    }

    const rawStepId = isScalar(idPair.value) ? String(idPair.value.value ?? "") : "";
    const stepId = normalizeId(rawStepId);
    if (!stepId) {
      continue;
    }

    const action = isScalar(actionPair.key) ? String(actionPair.key.value ?? "") : "";
    if (!action || action === "id") {
      continue;
    }

    const valueNode = actionPair.value;
    if (!isSeq(valueNode)) {
      continue;
    }

    const dependencies = valueNode.items
      .filter((item) => isScalar(item) && typeof item.value === "string" && item.value.trim().length > 0)
      .map((item) => normalizeId(String((item as { value: string }).value)));

    parsedSteps.push({ id: stepId, action, dependencies });
  }

  for (const step of parsedSteps) {
    const nodeId = toNodeId("step", step.id);
    stepNodeByName.set(step.id, nodeId);
    lines.push(`  ${nodeId}["${escapeMermaidLabel(`${step.id} (${step.action})`)}"]`);
  }

  for (const step of parsedSteps) {
    const stepNodeId = stepNodeByName.get(step.id);
    if (!stepNodeId) {
      continue;
    }

    for (const dep of step.dependencies) {
      const sourceId = ingredientNodeByName.get(dep) || stepNodeByName.get(dep);
      if (!sourceId) {
        continue;
      }

      lines.push(`  ${sourceId} --> ${stepNodeId}`);
    }
  }

  return lines.join("\n");
}

export function buildMermaidFromRecipeFile(recipePath: string): string {
  const rawYaml = fs.readFileSync(recipePath, "utf8");
  return buildMermaidFromRecipeYaml(rawYaml);
}
