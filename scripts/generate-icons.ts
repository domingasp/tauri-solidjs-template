import { execSync } from "child_process";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ASSETS_DIR = "assets";
const TAURI_ICONS_DIR = "src-tauri/icons";
const INPUT_ICON = path.join(ASSETS_DIR, "icon.png");
const MACOS_ICON = path.join(ASSETS_DIR, "icon-macos.png");
const GENERATED_ICNS = path.join(TAURI_ICONS_DIR, "icon.icns");
const MACOS_ICNS = path.join(TAURI_ICONS_DIR, "icon.mac.icns");

const TARGET_SIZE = 1024;
const MACOS_PADDING_PERCENT = 0.12; // 12% padding on each side (24% total)

/** Resize image with padding centered on a 1024x1024 canvas */
async function createMacOSIcon(
  inputPath: string,
  outputPath: string,
): Promise<void> {
  console.log("Creating macOS icon with padding...");

  const paddingSize = Math.floor(TARGET_SIZE * MACOS_PADDING_PERCENT);
  const iconSize = TARGET_SIZE - paddingSize * 2;

  const resizedIcon = await sharp(inputPath)
    .resize(iconSize, iconSize, {
      background: { alpha: 0, b: 0, g: 0, r: 0 },
      fit: "contain",
    })
    .png()
    .toBuffer();

  await sharp({
    create: {
      background: { alpha: 0, b: 0, g: 0, r: 0 },
      channels: 4,
      height: TARGET_SIZE,
      width: TARGET_SIZE,
    },
  })
    .composite([{ input: resizedIcon, left: paddingSize, top: paddingSize }])
    .png()
    .toFile(outputPath);

  console.log(`✔ macOS icon created at ${outputPath}`);
}

async function main() {
  try {
    console.log("Generating icons...");

    if (!fs.existsSync(ASSETS_DIR)) {
      fs.mkdirSync(ASSETS_DIR, { recursive: true });
    }

    if (!fs.existsSync(INPUT_ICON)) {
      throw new Error(`Input icon not found at ${INPUT_ICON}`);
    }

    await createMacOSIcon(INPUT_ICON, MACOS_ICON);

    console.log("Generating macOS icons...");
    runCommand(`pnpm tauri icon ${MACOS_ICON}`);

    if (fs.existsSync(GENERATED_ICNS)) {
      moveFile(GENERATED_ICNS, MACOS_ICNS);
    }

    console.log("Generating icons for other platforms...");
    runCommand(`pnpm tauri icon ${INPUT_ICON}`);

    if (fs.existsSync(MACOS_ICON)) {
      console.log("Cleaning up temporary files...");
      fs.unlinkSync(MACOS_ICON);
    }

    console.log("✔ All icons generated successfully!");
  } catch (error) {
    console.error("✘ Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

/** Move and rename a file */
function moveFile(source: string, destination: string): void {
  const destDir = path.dirname(destination);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  fs.renameSync(source, destination);
  console.log(`✔ Moved ${source} to ${destination}`);
}

/** Execute a shell command */
function runCommand(command: string): void {
  console.log(`Running: ${command}`);
  execSync(command, { stdio: "inherit" });
}

main();
