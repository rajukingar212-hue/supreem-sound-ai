/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          blue: "#2563EB",
          "blue-bright": "#3B82F6",
          "blue-hover": "#60A5FA",
          navy: "#0B1220",
          midnight: "#080D18",
          card: "#111827",
          "card-secondary": "#151F30",
          border: "#263449",
          "light-bg": "#F8FAFC",
          "light-card": "#FFFFFF",
          "light-secondary": "#F1F5F9",
          "light-border": "#E2E8F0",
        },
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #2563EB 0%, #3B82F6 50%, #60A5FA 100%)",
        "hero-dark": "linear-gradient(135deg, #0B1220 0%, #14213D 55%, #1D4ED8 100%)",
        "hero-light": "linear-gradient(135deg, #FFFFFF 0%, #EFF6FF 55%, #DBEAFE 100%)",
      },
    },
  },
  plugins: [],
};
