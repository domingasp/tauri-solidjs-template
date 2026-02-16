import type { Config, Rules, Settings } from "eslint-plugin-boundaries";

import js from "@eslint/js";
import eslintPluginBetterTailwindcss from "eslint-plugin-better-tailwindcss";
import eslintPluginBoundaries from "eslint-plugin-boundaries";
import { flatConfigs as eslintImportXFlatConfigs } from "eslint-plugin-import-x";
import eslintPluginJsdoc from "eslint-plugin-jsdoc";
import { configs as eslintPluginPerfectionistConfigs } from "eslint-plugin-perfectionist";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import eslintPluginSolid from "eslint-plugin-solid/configs/typescript";
import { configs as eslintPluginSonarJsConfigs } from "eslint-plugin-sonarjs";
import eslintPluginTailwindVariants from "eslint-plugin-tailwind-variants";
import eslintPluginUnicorn from "eslint-plugin-unicorn";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import { configs as tseslintConfigs } from "typescript-eslint";

export default defineConfig([
  globalIgnores(["src-tauri/**"]),

  // Base configuration
  {
    extends: ["js/recommended"],
    files: ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"],
    languageOptions: { globals: globals.browser },
    plugins: { js },
    rules: {
      complexity: ["error", { max: 12 }],
      "func-style": ["error", "expression"],
      "max-depth": "error",
      "max-lines": [
        "error",
        { max: 300, skipBlankLines: true, skipComments: true },
      ],
      "max-lines-per-function": [
        "error",
        { max: 50, skipBlankLines: true, skipComments: true },
      ],
      "max-params": "error",
      "max-statements": ["error", { max: 15 }],
      "no-console": "error",
      "no-magic-numbers": [
        "error",
        { ignore: [-1, 0, 1], ignoreReadonlyClassProperties: true },
      ],
      "no-restricted-syntax": [
        "error",
        {
          message:
            "Enums are discouraged. Use union types or const objects instead.",
          selector: "TSEnumDeclaration",
        },
      ],
    },
  },

  // Test files exemptions
  {
    files: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}"],
    rules: {
      "max-lines-per-function": "off",
      "max-statements": "off",
      "no-magic-numbers": "off",
    },
  },

  // Config files exemptions
  {
    files: ["*.config.{ts,js,mjs}"],
    rules: {
      "max-lines": "off",
      "max-lines-per-function": "off",
      "max-statements": "off",
      "no-magic-numbers": "off",
    },
  },

  // TypeScript configuration
  tseslintConfigs.strictTypeChecked,
  tseslintConfigs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/explicit-function-return-type": "error",
    },
  },
  {
    extends: [tseslintConfigs.disableTypeChecked],
    files: ["**/*.{js,css}"],
    rules: {
      "@typescript-eslint/consistent-type-imports": "off",
    },
  },

  // Code quality
  {
    extends: [
      eslintPluginPerfectionistConfigs["recommended-natural"],
      eslintPluginUnicorn.configs.recommended,
      eslintPluginJsdoc.configs["flat/recommended-typescript-error"],
      eslintPluginSonarJsConfigs.recommended,
      // @ts-expect-error - https://github.com/un-ts/eslint-plugin-import-x/issues/421
      eslintImportXFlatConfigs.recommended,
      // @ts-expect-error - https://github.com/un-ts/eslint-plugin-import-x/issues/421
      eslintImportXFlatConfigs.typescript,
    ],
    files: ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"],
    settings: {
      "import/resolver": {
        node: true,
        typescript: true,
      },
    },
  },

  // eslint-plugin-solid type not compatible with eslint
  // https://github.com/solidjs-community/eslint-plugin-solid/issues/178
  eslintPluginSolid as never,

  // Architecture
  {
    plugins: { boundaries: eslintPluginBoundaries },
    rules: {
      "boundaries/element-types": ["error", { default: "disallow", rules: [] }],
    } satisfies Rules,
    settings: {
      "boundaries/elements": [
        {
          mode: "full",
          pattern: ["./*.{ts,tsx}", "src/*.{ts,tsx}"],
          type: "app",
        },
      ],
    } satisfies Settings,
  } satisfies Config,

  // CSS
  {
    extends: [
      eslintPluginBetterTailwindcss.configs.recommended,
      eslintPluginTailwindVariants.configs.recommended,
    ],
    settings: {
      "better-tailwindcss": {
        entryPoint: "src/styles/global.css",
      },
    },
  },

  // Prettier (must be last)
  eslintPluginPrettierRecommended,
]);
