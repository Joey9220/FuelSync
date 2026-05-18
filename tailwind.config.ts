import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      boxShadow: {
        soft: "0 14px 40px rgba(15, 23, 42, 0.08)",
      },
      colors: {
        ink: "#102033",
        mint: "#17a673",
        coral: "#f9735b",
        oat: "#f7f3ea",
      },
    },
  },
  plugins: [],
} satisfies Config;
