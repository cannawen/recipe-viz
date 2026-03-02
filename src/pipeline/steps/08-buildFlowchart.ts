import type { RecipeGraphData } from "../types";

function escapeLabel(value: string): string {
  return value.replace(/"/g, "\\\"");
}

export function buildFlowchart(recipe: RecipeGraphData): RecipeGraphData {
  const nodeIdMap = new Map<string, string>();

  recipe.graph.nodes.forEach((node, index) => {
    nodeIdMap.set(node.id, `N${index + 1}`);
  });

  const lines: string[] = ["flowchart TD"];

  for (const node of recipe.graph.nodes) {
    const mermaidId = nodeIdMap.get(node.id);
    if (!mermaidId) {
      continue;
    }
    lines.push(`  ${mermaidId}[\"${escapeLabel(node.label)}\"]`);
  }

  for (const edge of recipe.graph.edges) {
    const from = nodeIdMap.get(edge.from);
    const to = nodeIdMap.get(edge.to);

    if (!from || !to) {
      continue;
    }

    if (edge.label) {
      lines.push(`  ${from} -->|${escapeLabel(edge.label)}| ${to}`);
    } else {
      lines.push(`  ${from} --> ${to}`);
    }
  }

  return {
    ...recipe,
    flowchartMermaid: lines.join("\n"),
  };
}
