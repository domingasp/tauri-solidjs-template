import type { Config, Rules, Settings } from "eslint-plugin-boundaries";

import { fixupConfigRules } from "@eslint/compat";
import js from "@eslint/js";
import eslintPluginBetterTailwindcss from "eslint-plugin-better-tailwindcss";
import eslintPluginBoundaries from "eslint-plugin-boundaries";
import eslintPluginImportPlugin from "eslint-plugin-import";
import eslintPluginJsdoc from "eslint-plugin-jsdoc";
import { configs as eslintPluginPerfectionistConfigs } from "eslint-plugin-perfectionist";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import eslintPluginSolid from "eslint-plugin-solid/configs/typescript";
import eslintPluginSonarJs from "eslint-plugin-sonarjs";
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
      complexity: ["error", { max: 15 }],
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
      "max-statements": "error",
      "no-magic-numbers": ["error", { ignore: [-1, 0, 1] }],
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
      "no-magic-numbers": "off",
    },
  },

  // TypeScript configuration
  tseslintConfigs.strictTypeChecked,
  tseslintConfigs.stylistic,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
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
      eslintPluginImportPlugin.flatConfigs.recommended,
      eslintPluginImportPlugin.flatConfigs.typescript,
      eslintPluginJsdoc.configs["flat/recommended-typescript-error"],
      fixupConfigRules(eslintPluginSonarJs.configs?.recommended as never),
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
