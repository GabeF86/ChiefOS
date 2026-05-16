import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "var(--ink)",
          2: "var(--ink-2)",
          3: "var(--ink-3)",
        },
        cream: {
          DEFAULT: "var(--cream)",
          2: "var(--cream-2)",
        },
        surface: "var(--surface)",
        border: {
          DEFAULT: "var(--border)",
          2: "var(--border-2)",
        },
        teal: {
          DEFAULT: "var(--teal)",
          dark: "var(--teal-dark)",
          soft: "var(--teal-soft)",
        },
        gold: {
          DEFAULT: "var(--gold)",
          soft: "var(--gold-soft)",
        },
        emerald: { DEFAULT: "var(--emerald)" },
        red: { DEFAULT: "var(--red)" },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-fraunces)", "ui-serif", "Georgia", "serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: {
        card: "14px",
        input: "8px",
        pill: "999px",
      },
      transitionDuration: {
        150: "150ms",
        200: "200ms",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
