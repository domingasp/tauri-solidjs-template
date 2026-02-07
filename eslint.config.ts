import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";
import eslintPluginSolid from "eslint-plugin-solid/configs/typescript";
import eslintPluginBoundaries, {
  Settings,
  Config,
  Rules,
} from "eslint-plugin-boundaries";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";

export default defineConfig([
  globalIgnores(["src-tauri/**"]),
  {
    files: ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: { globals: globals.browser },
  },
  tseslint.configs.recommended,

  // eslint-plugin-solid type not compatible with eslint
  // https://github.com/solidjs-community/eslint-plugin-solid/issues/178
  eslintPluginSolid as never,

  {
    plugins: { boundaries: eslintPluginBoundaries },
    settings: {
      "boundaries/elements": [
        {
          type: "app",
          pattern: ["./*.{ts,tsx}", "src/*.{ts,tsx}"],
          mode: "full",
        },
      ],
    } satisfies Settings,
    rules: {
      "boundaries/element-types": ["error", { default: "disallow", rules: [] }],
    } satisfies Rules,
  } satisfies Config,

  // Prettier plugin should be last to override other rules
  eslintPluginPrettierRecommended,
]);
