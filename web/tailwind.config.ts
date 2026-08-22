import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Warm editorial paper + ink (no generic AI blue/violet).
        paper: "#F6F4EE",
        surface: "#FFFFFF",
        raised: "#FCFBF7",
        ink: "#1C1B18",
        "ink-2": "#4A453C",
        muted: "#726C61",
        faint: "#9A9488",
        hairline: "#E4DFD4",
        "hairline-2": "#EEEAE0",
        // Semantic data colors — validated pair (CVD ΔE 10.0).
        naive: "#C4551D", // waste / hot
        "naive-tint": "#F4E3D6",
        coord: "#118A64", // efficient / cool
        "coord-tint": "#D8ECE2",
        gold: "#B8862F", // reserved signal accent
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Text",
          "system-ui",
          "Segoe UI",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "SF Mono",
          "SFMono-Regular",
          "Menlo",
          "Cascadia Mono",
          "monospace",
        ],
      },
      fontSize: {
        "hero": ["clamp(3.5rem, 9vw, 7rem)", { lineHeight: "0.95", letterSpacing: "-0.03em" }],
      },
      letterSpacing: {
        tightest: "-0.03em",
      },
      maxWidth: {
        wrap: "1200px",
      },
      keyframes: {
        "row-in": {
          "0%": { opacity: "0", transform: "translateY(-6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fill": {
          "0%": { transform: "scaleX(0)" },
          "100%": { transform: "scaleX(1)" },
        },
        "pulse-dot": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
      },
      animation: {
        "row-in": "row-in 0.35s cubic-bezier(0.2, 0.7, 0.2, 1)",
        "fill": "fill 0.6s cubic-bezier(0.2, 0.7, 0.2, 1) forwards",
        "pulse-dot": "pulse-dot 1.8s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
