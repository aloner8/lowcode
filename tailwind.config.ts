import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: "var(--bs-primary)",
        secondary: "var(--bs-secondary)",
        success: "var(--bs-success)",
        danger: "var(--bs-danger)",
        warning: "var(--bs-warning)",
        info: "var(--bs-info)",
      },
      borderRadius: {
        theme: "var(--bs-border-radius)",
      },
    },
  },
  plugins: [],
};
export default config;
