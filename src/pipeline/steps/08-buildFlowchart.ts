import type { RecipeGraphData } from "../types";

function escapeLabel(value: string): string {
  return value.replace(/"/g, "\\\"");
}

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function shorten(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function buildActionLabel(stepNumber: number, actionText: string): string {
  const cleaned = compactWhitespace(actionText.replace(/^[a-z]\d+\s*:\s*/i, ""));
  const concise = shorten(cleaned, 48);
  return `${stepNumber}. ${concise}`;
}

export function buildFlowchart(recipe: RecipeGraphData): RecipeGraphData {
  const lines: string[] = ["flowchart TD"];

  if (recipe.actions.length > 0) {
    const actionNodeIdMap = new Map<string, string>();

    recipe.actions.forEach((action, index) => {
      const mermaidId = `S${index + 1}`;
      actionNodeIdMap.set(action.id, mermaidId);
      lines.push(`  ${mermaidId}[\"${escapeLabel(buildActionLabel(index + 1, action.action))}\"]`);
    });

    let hasDependencyEdges = false;

    for (const action of recipe.actions) {
      const to = actionNodeIdMap.get(action.id);
      if (!to) {
        continue;
      }

      for (const dependency of action.dependsOn ?? []) {
        const from = actionNodeIdMap.get(dependency);
        if (from) {
          lines.push(`  ${from} --> ${to}`);
          hasDependencyEdges = true;
        }
      }
    }

    if (!hasDependencyEdges) {
      for (let index = 1; index < recipe.actions.length; index += 1) {
        lines.push(`  S${index} --> S${index + 1}`);
      }
    }

    return {
      ...recipe,
      flowchartMermaid: lines.join("\n"),
    };
  }

  const nodeIdMap = new Map<string, string>();

  recipe.graph.nodes.forEach((node, index) => {
    if (node.type !== "action") {
      return;
    }
    nodeIdMap.set(node.id, `N${index + 1}`);
  });

  for (const node of recipe.graph.nodes) {
    if (node.type !== "action") {
      continue;
    }

    const mermaidId = nodeIdMap.get(node.id);
    if (!mermaidId) {
      continue;
    }

    lines.push(`  ${mermaidId}[\"${escapeLabel(shorten(compactWhitespace(node.label), 48))}\"]`);
  }

  for (const edge of recipe.graph.edges) {
    if (!nodeIdMap.has(edge.from) || !nodeIdMap.has(edge.to)) {
      continue;
    }

    const from = nodeIdMap.get(edge.from);
    const to = nodeIdMap.get(edge.to);

    if (!from || !to) {
      continue;
    }

    lines.push(`  ${from} --> ${to}`);
  }

  return {
    ...recipe,
    flowchartMermaid: lines.join("\n"),
  };
}
