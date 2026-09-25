import cytoscape from "cytoscape";

export function getCytoscapeStyles(showLabels: boolean = true): cytoscape.StylesheetCSS[] {
  return [
    {
      selector: "node",
      css: {
        "background-color": "data(color)" as unknown as string,
        label: showLabels ? "data(label)" : "",
        color: "#1E293B",
        "font-size": "11px",
        "font-family": "Manrope, monospace",
        "font-weight": "bold",
        "text-valign": "bottom",
        "text-margin-y": 6,
        width: 36,
        height: 36,
        "border-width": 3,
        "border-color": "#FFFFFF",
      },
    },
    {
      selector: "node[?isSource]",
      css: {
        "border-color": "#EF4444",
        "border-width": 4,
        width: 44,
        height: 44,
      },
    },
    {
      selector: "node[?isDestination]",
      css: {
        "border-color": "#06B6D4",
        "border-width": 4,
        width: 42,
        height: 42,
        shape: "diamond",
      },
    },
    {
      selector: "node:selected",
      css: {
        "border-width": 5,
        "border-color": "#38BDF8",
      },
    },
    {
      selector: "edge",
      css: {
        width: "data(width)" as unknown as number,
        "line-color": "#94A3B8",
        "target-arrow-color": "#64748B",
        "target-arrow-shape": "triangle",
        "arrow-scale": 1.2,
        "curve-style": "bezier",
        label: showLabels ? "data(label)" : "",
        "font-size": "9.5px",
        color: "#334155",
        "font-family": "JetBrains Mono, monospace",
        "font-weight": "bold",
        "text-background-color": "#FFFFFF",
        "text-background-opacity": 0.92,
        "text-background-padding": "3px",
        "text-border-color": "#E2E8F0",
        "text-border-width": 1,
        "text-border-opacity": 0.8,
      },
    },
    {
      selector: 'edge[suspicious = "true"]',
      css: {
        "line-color": "#F43F5E",
        "target-arrow-color": "#E11D48",
      },
    },
    {
      selector: "edge:selected",
      css: {
        "line-color": "#0EA5E9",
        "target-arrow-color": "#0284C7",
        width: 4,
      },
    },
  ];
}
