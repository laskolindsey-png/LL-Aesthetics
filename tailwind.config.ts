import type { Config } from "tailwindcss";

// Palette lifted directly from the "Style Guide" tab of the TOOL workbook,
// so the app matches LL Aesthetics' existing luxury look.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Warm, earthy identity from Lindsey's chosen swatch.
        canvas: "#9E8F89", // Background — deep taupe (matches the logo ground)
        card: "#FFFFFF", // Card Background
        ink: "#372D28", // Primary Text / dark — deep espresso brown
        muted: "#5F5455", // Secondary Text — deep mauve-grey (reads on the taupe ground)
        line: "#E2D8CC", // Border — warm taupe
        accent: "#8A564D", // Accent — dusty terracotta
        blush: "#C9B2A1", // Warm blush beige (soft fills)
        clay: "#6B5A46", // Deep olive-brown (secondary)
        success: "#7D9B7C", // Success — sage
        warning: "#C08A3E", // Warning — amber
        danger: "#A24A3E", // Error — brick
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
