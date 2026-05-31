/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["DM Sans", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      colors: {
        surface: {
          900: "#0c0f14",
          800: "#12161e",
          700: "#1a2030",
          600: "#252d3d",
        },
        accent: {
          DEFAULT: "#3b9eff",
          dim: "#2563a8",
          glow: "#5eb8ff",
        },
        success: "#34d399",
        warning: "#fbbf24",
        danger: "#f87171",
      },
    },
  },
  plugins: [],
};
