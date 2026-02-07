import js from "@eslint/js";
import eslintPluginBoundaries, {
  Config,
  Rules,
  Settings,
} from "eslint-plugin-boundaries";
import eslintPluginPerfectionist from "eslint-plugin-perfectionist";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import eslintPluginSolid from "eslint-plugin-solid/configs/typescript";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores(["src-tauri/**"]),
  {
    extends: ["js/recommended"],
    files: ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"],
    languageOptions: { globals: globals.browser },
    plugins: { js },
  },
  tseslint.configs.recommended,

  eslintPluginPerfectionist.configs["recommended-natural"],

  // eslint-plugin-solid type not compatible with eslint
  // https://github.com/solidjs-community/eslint-plugin-solid/issues/178
  eslintPluginSolid as never,

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

  // Prettier plugin should be last to override other rules
  eslintPluginPrettierRecommended,
]);
