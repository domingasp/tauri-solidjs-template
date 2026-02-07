import type { Configuration } from "lint-staged";

const config: Configuration = {
  "*.{js,jsx,ts,tsx}": ["eslint --fix"],
  "*.{json,html,css,md,yml,yaml}": ["prettier --write"],
  "src-tauri/**/*.rs": () => [
    "cargo fmt --manifest-path src-tauri/Cargo.toml",
    "cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --fix --allow-dirty --allow-staged -- -D warnings",
  ],
};

export default config;
