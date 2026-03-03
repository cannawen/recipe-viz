import fs from "node:fs";
import path from "node:path";
import { parse } from "yaml";

type Ingredient = {
  name: string;
  amount?: number;
  units?: string;
};

type Recipe = {
  ingredients: Ingredient[];
  equipment?: string[];
  steps: Record<string, string[]>;
};

const recipePath = path.join(__dirname, "..", "recipe.yml");
const raw = fs.readFileSync(recipePath, "utf8");
const parsed = parse(raw) as unknown;

const errors: string[] = [];

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const asObject = (value: unknown): Record<string, unknown> | null => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return null;
};

const recipeObj = asObject(parsed);
if (!recipeObj) {
  errors.push("Recipe root must be an object.");
}

const ingredientsValue = recipeObj?.ingredients;
const equipmentValue = recipeObj?.equipment;
const stepsValue = recipeObj?.steps;

const ingredientNames = new Set<string>();
const equipmentNames = new Set<string>();
const stepNames = new Set<string>();

if (!Array.isArray(ingredientsValue) || ingredientsValue.length === 0) {
  errors.push("ingredients must be a non-empty array.");
} else {
  for (let index = 0; index < ingredientsValue.length; index += 1) {
    const ingredient = asObject(ingredientsValue[index]);

    if (!ingredient) {
      errors.push(`ingredients[${index}] must be an object.`);
      continue;
    }

    if (!isNonEmptyString(ingredient.name)) {
      errors.push(`ingredients[${index}].name must be a non-empty string.`);
      continue;
    }

    ingredientNames.add(ingredient.name);

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

if (equipmentValue !== undefined) {
  if (!Array.isArray(equipmentValue)) {
    errors.push("equipment must be an array of strings when present.");
  } else {
    for (let index = 0; index < equipmentValue.length; index += 1) {
      const item = equipmentValue[index];
      if (!isNonEmptyString(item)) {
        errors.push(`equipment[${index}] must be a non-empty string.`);
        continue;
      }
      equipmentNames.add(item);
    }
  }
}

const stepsObj = asObject(stepsValue);
if (!stepsObj || Object.keys(stepsObj).length === 0) {
  errors.push("steps must be a non-empty object.");
} else {
  for (const key of Object.keys(stepsObj)) {
    if (!isNonEmptyString(key)) {
      errors.push("step keys must be non-empty strings.");
      continue;
    }
    stepNames.add(key);
  }

  for (const [stepName, dependencies] of Object.entries(stepsObj)) {
    if (!Array.isArray(dependencies) || dependencies.length === 0) {
      errors.push(`steps.${stepName} must be a non-empty array of strings.`);
      continue;
    }

    for (let index = 0; index < dependencies.length; index += 1) {
      const dep = dependencies[index];
      if (!isNonEmptyString(dep)) {
        errors.push(`steps.${stepName}[${index}] must be a non-empty string.`);
        continue;
      }

      const isKnown =
        ingredientNames.has(dep) || equipmentNames.has(dep) || stepNames.has(dep);

      if (!isKnown) {
        errors.push(
          `steps.${stepName}[${index}] = \"${dep}\" is unknown. Expected ingredient, equipment, or step key.`,
        );
      }
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
