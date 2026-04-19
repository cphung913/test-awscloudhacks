import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#f4f1e8",
          elevated: "#ede9da",
          panel: "#ebe6d6",
          ribbon: "#0e1a22",
        },
        border: {
          DEFAULT: "#d4cfc0",
          strong: "#b8b0a0",
        },
        ink: {
          DEFAULT: "#1a1a1a",
          dim: "#666666",
          faint: "#999999",
          ribbon: "#e8e4d8",
        },
        risk: {
          clear: "#22c55e",
          monitor: "#ca8a04",
          advisory: "#ea580c",
          danger: "#dc2626",
        },
        accent: {
          DEFAULT: "#7fb2c9",
          strong: "#2d5a7a",
          danger: "#a63d2a",
        },
      },
      fontFamily: {
        sans: ["Inter Tight", "Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        panel: "0 1px 2px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.08)",
      },
    },
  },
  plugins: [],
} satisfies Config;
