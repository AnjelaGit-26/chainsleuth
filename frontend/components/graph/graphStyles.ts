import cytoscape from "cytoscape";

export function getCytoscapeStyles(showLabels: boolean = true): cytoscape.StylesheetCSS[] {
  return [
    {
      selector: "node",
      css: {
        "background-color": "#475569", // Gray = normal/intermediate wallet
        label: showLabels ? "data(label)" : "",
        color: "#cbd5e1",
        "font-size": "10px",
        "font-family": "monospace",
        "text-valign": "bottom",
        "text-margin-y": 5,
        width: 30,
        height: 30,
        "border-width": 2,
        "border-color": "#1e293b",
      },
    },
    {
      selector: 'node[role = "burner"]',
      css: {
        "background-color": "#ef4444", // Coral/Red = suspicious/burner
        "border-color": "#991b1b",
        width: 32,
        height: 32,
      },
    },
    {
      selector: 'node[role = "ofac"]',
      css: {
        "background-color": "#dc2626", // Red = OFAC sanctioned node
        "border-color": "#991b1b",
        "border-width": 3,
        width: 36,
        height: 36,
      },
    },
    {
      selector: 'node[role = "bridge"]',
      css: {
        "background-color": "#06b6d4", // Cyan = Cross-chain bridge node
        "border-color": "#0891b2",
        "border-width": 3,
        width: 35,
        height: 35,
      },
    },
    {
      selector: 'node[role = "vasp"]',
      css: {
        "background-color": "#0d9488", // Teal/Green = attributed VASP deposit target
        "border-color": "#14b8a6",
        "border-width": 4,
        width: 42,
        height: 42,
      },
    },
    {
      selector: "node:selected",
      css: {
        "border-width": 4,
        "border-color": "#38bdf8",
      },
    },
    {
      selector: "node.cluster-highlighted",
      css: {
        "border-width": 4,
        "border-color": "#c084fc",
        "background-color": "#9333ea",
      },
    },
    {
      selector: "edge",
      css: {
        width: "data(width)" as unknown as number,
        "line-color": "#334155",
        "target-arrow-color": "#475569",
        "target-arrow-shape": "triangle",
        "arrow-scale": 1.2,
        "curve-style": "bezier",
        label: showLabels ? "data(label)" : "",
        "font-size": "9px",
        color: "#94a3b8",
        "font-family": "monospace",
        "text-background-color": "#0f172a",
        "text-background-opacity": 0.85,
        "text-background-padding": "3px",
      },
    },
    {
      selector: 'edge[suspicious = "true"]',
      css: {
        "line-color": "#f87171",
        "target-arrow-color": "#ef4444",
      },
    },
    {
      selector: "edge:selected",
      css: {
        "line-color": "#38bdf8",
        "target-arrow-color": "#38bdf8",
        width: 4,
      },
    },
  ];
}
