/** Lodgist visual tokens. Names match the CSS variables already in globals.css. */

export const color = {
  navy: "#0B1B2B",
  orange: "#FF6F3C",
  teal: "#1ABC9C",
  text: "#FFFFFF",
  textMuted: "rgba(255,255,255,0.55)",
  line: "rgba(255,255,255,0.08)",
} as const;

export const type = {
  display: "var(--font-poppins)",
  body: "var(--font-open-sans)",
} as const;

export const space = {
  section: "4rem",
  card: "1.5rem",
} as const;

export const radius = {
  card: "1rem",
  pill: "999px",
} as const;
