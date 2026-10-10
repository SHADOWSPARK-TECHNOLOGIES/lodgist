import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Native node --test suites and their shared spatial helper are CommonJS.
    // Keep require/module.exports compatible with those consumers; TS/TSX and
    // other application modules still enforce no-require-imports.
    files: ["src/lib/*.test.js", "src/lib/spatialTiles.js", "src/lib/spatialTool.js", "src/lib/spatialPublic.js", "src/lib/campusDirections.js"],
    languageOptions: { sourceType: "commonjs" },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "vendor/**",
  ]),
]);

export default eslintConfig;
