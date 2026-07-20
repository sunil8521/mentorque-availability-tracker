/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
      colors: {
        navy: {
          950: "#09090b",
          900: "#111113",
          800: "#18181b",
          700: "#27272a",
          600: "#3f3f46",
        },
        primary: {
          600: "#fafafa",
          500: "#e4e4e7",
          400: "#d4d4d8",
          300: "#a1a1aa",
        },
        ink: {
          50: "#fafafa",
          400: "#a1a1aa",
          500: "#71717a",
          600: "#52525b",
        },
      },
    },
  },
  plugins: [],
};
