import fs from "node:fs";
import path from "node:path";
import { isMap, isScalar, isSeq, parseDocument } from "yaml";

const recipePath = path.join(__dirname, "..", "recipe.yml");
const raw = fs.readFileSync(recipePath, "utf8");

const normalizedRaw = raw.replace(
  /^(\s*id:\s*)([^"'#\n][^#\n]*?):\s*$/gm,
  (_match: string, prefix: string, value: string) => `${prefix}${value.trim()}`,
);

const doc = parseDocument(normalizedRaw, {
  uniqueKeys: false,
});

const errors: string[] = [];

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const normalizeId = (value: string): string => value.trim().replace(/:+$/, "");

const asObject = (value: unknown): Record<string, unknown> | null => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return null;
};

if (doc.errors.length > 0) {
  for (const error of doc.errors) {
    errors.push(`YAML parse error: ${error.message}`);
  }

  console.error("Recipe validation failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

const parsed = doc.toJS() as unknown;

const recipeObj = asObject(parsed);
if (!recipeObj) {
  errors.push("Recipe root must be an object.");
}

const ingredientsValue = recipeObj?.ingredients;

const rootNode = doc.contents;
const stepsNode =
  isMap(rootNode) && rootNode.get("steps", true) ? rootNode.get("steps", true) : null;

const ingredientNames = new Set<string>();
const stepNames = new Set<string>();

type ParsedStep = {
  id: string;
  action: string;
  dependencies: string[];
};

const parsedSteps: ParsedStep[] = [];

if (!Array.isArray(ingredientsValue) || ingredientsValue.length === 0) {
  errors.push("ingredients must be a non-empty array.");
} else {
  for (let index = 0; index < ingredientsValue.length; index += 1) {
    const ingredient = asObject(ingredientsValue[index]);

    if (!ingredient) {
      errors.push(`ingredients[${index}] must be an object.`);
      continue;
    }

    if (!isNonEmptyString(ingredient.id)) {
      errors.push(`ingredients[${index}].id must be a non-empty string.`);
      continue;
    }

    ingredientNames.add(normalizeId(ingredient.id));

    if (
      Object.prototype.hasOwnProperty.call(ingredient, "amount") &&
      typeof ingredient.amount !== "number"
    ) {
      errors.push(`ingredients[${index}].amount must be a number when present.`);
    }

    if (
      Object.prototype.hasOwnProperty.call(ingredient, "units") &&
      !isNonEmptyString(ingredient.units)
    ) {
      errors.push(`ingredients[${index}].units must be a non-empty string when present.`);
    }
  }
}

if (!stepsNode || !isMap(stepsNode) || stepsNode.items.length === 0) {
  errors.push("steps must be a non-empty map of repeated id + action entries.");
} else {
  if (stepsNode.items.length % 2 !== 0) {
    errors.push("steps entries must come in pairs: `id:` followed by one action key.");
  }

  for (let index = 0; index + 1 < stepsNode.items.length; index += 2) {
    const idPair = stepsNode.items[index];
    const actionPair = stepsNode.items[index + 1];

    const idKey = isScalar(idPair.key) ? String(idPair.key.value) : "";
    if (idKey !== "id") {
      errors.push(
        `steps pair starting at index ${index} must begin with key \`id\` (found \`${idKey || "<non-scalar>"}\`).`,
      );
      continue;
    }

    const rawStepId = isScalar(idPair.value) ? String(idPair.value.value ?? "") : "";
    const stepId = normalizeId(rawStepId);
    if (!isNonEmptyString(stepId)) {
      errors.push(`steps id at pair index ${index} must be a non-empty string.`);
      continue;
    }

    if (stepNames.has(stepId)) {
      errors.push(`Duplicate step id: \`${stepId}\`.`);
    }
    stepNames.add(stepId);

    const action = isScalar(actionPair.key) ? String(actionPair.key.value) : "";
    if (!isNonEmptyString(action) || action === "id") {
      errors.push(`steps action for \`${stepId}\` must be a non-empty key other than \`id\`.`);
      continue;
    }

    const valueNode = actionPair.value;
    if (!isSeq(valueNode) || valueNode.items.length === 0) {
      errors.push(`steps action \`${action}\` for \`${stepId}\` must be a non-empty array.`);
      continue;
    }

    const dependencies: string[] = [];
    for (let depIndex = 0; depIndex < valueNode.items.length; depIndex += 1) {
      const item = valueNode.items[depIndex];
      if (!isScalar(item) || !isNonEmptyString(item.value)) {
        errors.push(`steps.${stepId}.${action}[${depIndex}] must be a non-empty string.`);
        continue;
      }

      dependencies.push(normalizeId(String(item.value)));
    }

    parsedSteps.push({
      id: stepId,
      action,
      dependencies,
    });
  }
}

for (const step of parsedSteps) {
  for (let index = 0; index < step.dependencies.length; index += 1) {
    const dep = step.dependencies[index];

    const isKnown = ingredientNames.has(dep) || stepNames.has(dep);

    if (!isKnown) {
      errors.push(
        `steps.${step.id}.${step.action}[${index}] = "${dep}" is unknown. Expected ingredient id or step id.`,
      );
    }
  }
}

if (errors.length > 0) {
  console.error("Recipe validation failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Recipe validation passed.");
