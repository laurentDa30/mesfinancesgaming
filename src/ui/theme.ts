/** Palette Nexa : fond sombre, un seul accent fort (cyan), violet pour la progression. */
export const colors = {
  bg: "#0B0E1A",
  panel: "#141A2E",
  panelHigh: "#1C2440",
  line: "#2A3354",
  text: "#E8ECF8",
  muted: "#8B93B0",
  cyan: "#3EE6E0",
  violet: "#8B5CF6",
  good: "#34D399",
  warn: "#FBBF24",
  bad: "#F87171",
} as const;

export const space = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 } as const;
export const radius = { s: 8, m: 12, l: 20, round: 999 } as const;

export const type = {
  title: { fontSize: 22, fontWeight: "700" as const, color: colors.text },
  h2: { fontSize: 17, fontWeight: "600" as const, color: colors.text },
  body: { fontSize: 15, color: colors.text },
  small: { fontSize: 13, color: colors.muted },
  money: { fontSize: 28, fontWeight: "700" as const, color: colors.text, fontVariant: ["tabular-nums" as const] },
};
