/**
 * Placeholder "photo" backgrounds until real product photography is supplied.
 * Each seed maps to a gradient within the brand's green/gold/ivory range so
 * cards stay visually coherent even without photographs.
 */
const PALETTE: Record<string, [string, string]> = {
  amber: ["#8a5a20", "#c9962c"],
  emerald: ["#0e5a44", "#2f7a5f"],
  sienna: ["#7a4a24", "#b97a3d"],
  gold: ["#a67816", "#e0b65a"],
  moss: ["#3c5a34", "#6f8f5a"],
  wheat: ["#8f7a3f", "#cbb26a"],
  clay: ["#6e4a2e", "#a97748"],
  leaf: ["#245c3a", "#4f8a5f"],
  sand: ["#8a7355", "#c4ac83"],
  rose: ["#7a3d3d", "#b96a5c"],
  slate: ["#33403c", "#5c6f68"],
  indigo: ["#0e5a44", "#c9962c"],
  copper: ["#7a4a2e", "#b97a44"],
  forest: ["#123d2c", "#2f6a4a"],
  straw: ["#8f7331", "#c9a94a"],
};

export function seedGradient(seed: string): string {
  const [from, to] = PALETTE[seed] ?? PALETTE.emerald;
  return `linear-gradient(135deg, ${from} 0%, ${to} 100%)`;
}
