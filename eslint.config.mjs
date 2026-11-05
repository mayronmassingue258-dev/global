import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __dirname = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

// Compatível com eslint-config-next 15 (configuração clássica via FlatCompat).
const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Prefixo "_" = descartado de propósito (ex.: tirar um campo com desestruturação).
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true }]
    }
  },
  {
    ignores: [".next/**", ".next-e2e/**", "out/**", "build/**", "coverage/**", "playwright-report/**", "test-results/**", "mock-api/.data/**", "backend/**", "lighthouse-reports/**", "next-env.d.ts"]
  }
];

export default eslintConfig;
