import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";

/** @type {import('eslint').Linter.Config[]} */
export default [
  {files: ["**/*.{js,mjs,cjs,ts}"]},
  {languageOptions: { globals: globals.node }},
  pluginJs.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
      languageOptions: {
          parserOptions: {
              projectService: {
                  allowDefaultProject: [
                      "src/tests/query-builder_test.ts",
                      "src/tests/bucket-response_test.ts",
                      "src/tests/response-types_test.ts",
                      "jest.config.js",
                      "eslint.config.mjs",
                  ],
              },
          },
      },
  },
  eslintPluginPrettierRecommended,
  {
      rules: {
          "@typescript-eslint/no-explicit-any": "error",
          "@typescript-eslint/explicit-function-return-type": ["error", {
              "allowExpressions": true,
              "allowTypedFunctionExpressions": true,
              "allowHigherOrderFunctions": true,
          }],
          "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
          "@typescript-eslint/no-non-null-assertion": "error",
          "@typescript-eslint/consistent-type-imports": "error",
          "no-console": ["error", { "allow": ["warn"] }],
          "eqeqeq": "error",
          "prettier/prettier": ["error", { "endOfLine": "auto" }],
      },
  },
];
