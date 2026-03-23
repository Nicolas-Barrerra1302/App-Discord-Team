import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1rem",
    },
    extend: {
      colors: {
        background: {
          DEFAULT: "#0f0f0f",
          card: "#1e1e2e",
          sidebar: "#16213e",
        },
        primary: {
          DEFAULT: "#e91e63",
          hover: "#c2185b",
        },
        success: "#00e676",
        warning: "#ff9800",
        danger: "#f44336",
        text: {
          DEFAULT: "#e0e0e0",
          muted: "#9e9e9e",
          heading: "#ffffff",
        },
      },
    },
  },
  plugins: [],
};
export default config;
