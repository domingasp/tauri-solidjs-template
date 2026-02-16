import type { Configuration } from "lint-staged";

const config: Configuration = {
  "*": "oxfmt --no-error-on-unmatched-pattern",
  "*.{js,jsx,ts,tsx,mjs,cjs}": ["pnpm run lint:js"],
  "src-tauri/**/*.rs": () => [
    "cargo fmt --manifest-path src-tauri/Cargo.toml",
    "cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --fix --allow-dirty --allow-staged -- -D warnings",
  ],
};

export default config;
