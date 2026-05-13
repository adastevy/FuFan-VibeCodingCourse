import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0a0a0a",
        card: { DEFAULT: "#161616", hover: "#1c1c1c" },
        border: { DEFAULT: "#262626", hover: "#3a3a3a" },
        text: { DEFAULT: "#f5f5f5", sub: "#a1a1a1", weak: "#737373" },
        accent: { DEFAULT: "#ff8c1a", dim: "rgba(255,140,26,0.15)" },
        green: { DEFAULT: "#22c55e", dim: "rgba(34,197,94,0.15)" },
        red: { DEFAULT: "#ef4444", dim: "rgba(239,68,68,0.15)" },
        purple: { DEFAULT: "#a855f7", dim: "rgba(168,85,247,0.15)" },
        blue: { DEFAULT: "#3b82f6", dim: "rgba(59,130,246,0.15)" },
        yellow: "#eab308",
      },
      borderRadius: {
        card: "12px",
        btn: "8px",
        badge: "6px",
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.3)",
        "accent-glow": "0 0 12px rgba(255,140,26,0.35)",
        "green-glow": "0 0 5px #22c55e",
      },
      fontFamily: {
        sans: [
          "system-ui",
          "-apple-system",
          '"PingFang SC"',
          '"Microsoft YaHei"',
          '"Segoe UI"',
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
