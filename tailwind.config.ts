/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-nunito)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        // Semantic tokens - all theme-aware via CSS variables
        app: {
          bg: "var(--c-bg)",
          surface: "var(--c-surface)",
          surface2: "var(--c-surface-2)",
          raised: "var(--c-raised)",
          border: "var(--c-border)",
          text: "var(--c-text)",
          muted: "var(--c-muted)",
          faint: "var(--c-faint)",
          primary: "var(--c-primary)",
          primaryDark: "var(--c-primary-dark)",
          primarySoft: "var(--c-primary-soft)",
          flame: "var(--c-flame)",
          blue: "var(--c-blue)",
          danger: "var(--c-danger)",
        },
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
        "3xl": "2rem",
      },
      boxShadow: {
        "duo": "0 4px 0 var(--c-primary-dark)",
        "duo-sm": "0 3px 0 var(--c-primary-dark)",
        "duo-flame": "0 4px 0 var(--c-flame-dark)",
        card: "0 2px 0 var(--c-border)",
      },
      animation: {
        "press": "press 0.12s ease-out",
        "pop": "pop 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
        "float": "float 3s ease-in-out infinite",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "sheet-in": "sheet-in 0.3s cubic-bezier(0.32, 0.72, 0, 1)",
      },
      keyframes: {
        press: {
          "0%": { transform: "scale(1)" },
          "100%": { transform: "scale(0.96)" },
        },
        pop: {
          "0%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.28)" },
          "100%": { transform: "scale(1)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        "sheet-in": {
          "0%": { transform: "translateY(24px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
}
