import { input, select } from "@inquirer/prompts";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ASSETS_DIR = "assets";
const TAURI_ICONS_DIR = "src-tauri/icons";
const TEMP_ICON = path.join(ASSETS_DIR, "icon-temp.png");
const TEMP_MACOS_ICON = path.join(ASSETS_DIR, "icon-macOS-temp.png");
const GENERATED_ICNS = path.join(TAURI_ICONS_DIR, "icon.icns");
const MACOS_ICNS = path.join(TAURI_ICONS_DIR, "icon.macOS.icns");

const TARGET_SIZE = 1024;
const MACOS_PADDING_PERCENT = 0.12; // 12% padding on each side (24% total)
const CORNER_RADIUS_PERCENT = 0.2237; // 22.37% corner radius for macOS icons

/** Resize image with padding centered on a 1024x1024 canvas. */
async function createMacOSIcon(
  inputPath: string,
  outputPath: string,
  backgroundColor: string | undefined,
  useSquircle: boolean,
): Promise<void> {
  console.log("Creating macOS icon with background and padding...");

  const paddingSize = Math.floor(TARGET_SIZE * MACOS_PADDING_PERCENT);
  const backgroundSize = TARGET_SIZE - paddingSize * 2;
  const cornerRadius = Math.floor(backgroundSize * CORNER_RADIUS_PERCENT);

  // Extra padding to create space from background edge
  const iconPaddingPercent = 0.08;
  const iconPadding = Math.floor(backgroundSize * iconPaddingPercent);
  const iconSize = backgroundSize - iconPadding * 2;

  const resizedIcon = await sharp(inputPath)
    .resize(iconSize, iconSize, {
      background: { alpha: 0, b: 0, g: 0, r: 0 },
      fit: "contain",
    })
    .png()
    .toBuffer();

  const mask = useSquircle
    ? await createSquircleMask(backgroundSize, backgroundSize)
    : await createRoundedMask(backgroundSize, backgroundSize, cornerRadius);

  const generatedIcon = await sharp({
    create: {
      background: backgroundColor ?? { alpha: 0, b: 0, g: 0, r: 0 },
      channels: 4,
      height: backgroundSize,
      width: backgroundSize,
    },
  })
    .composite([{ blend: "dest-in", input: mask }, { input: resizedIcon }])
    .png()
    .toBuffer();

  // Create final 1024x1024 icon with padding
  await sharp({
    create: {
      background: { alpha: 0, b: 0, g: 0, r: 0 },
      channels: 4,
      height: TARGET_SIZE,
      width: TARGET_SIZE,
    },
  })
    .composite([{ input: generatedIcon, left: paddingSize, top: paddingSize }])
    .png()
    .toFile(outputPath);

  console.log(`✔ macOS icon created at ${outputPath}`);
}

/** Create a padded icon on a transparent canvas. */
async function createPaddedIcon(
  inputPath: string,
  outputPath: string,
  paddingPercent: number,
): Promise<void> {
  console.log(`Creating padded icon with ${paddingPercent * 100}% padding...`);

  const paddingSize = Math.floor(TARGET_SIZE * paddingPercent);
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

  console.log(`✔ Padded icon created at ${outputPath}`);
}

/** Create a rounded rectangle mask. */
async function createRoundedMask(
  width: number,
  height: number,
  radius: number,
): Promise<Buffer> {
  const svg = `
    <svg width="${width}" height="${height}">
      <rect x="0" y="0"
        width="${width}" height="${height}"
        rx="${radius}" ry="${radius}"
        fill="white"
      />
    </svg>
  `;

  return Buffer.from(svg);
}

/** Create a squircle (super-ellipse) mask for macOS-style rounded corners. */
async function createSquircleMask(
  width: number,
  height: number,
): Promise<Buffer> {
  const points: string[] = [];
  const steps = 360;
  const n = 3.7; // Super-ellipse exponent (higher = more square-like)
  const a = width / 2;
  const b = height / 2;

  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    const cosT = Math.cos(angle);
    const sinT = Math.sin(angle);

    const x = a * Math.sign(cosT) * Math.pow(Math.abs(cosT), 2 / n);
    const y = b * Math.sign(sinT) * Math.pow(Math.abs(sinT), 2 / n);

    const command = i === 0 ? "M" : "L";
    points.push(`${command} ${a + x},${b + y}`);
  }

  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <path d="${points.join(" ")} Z" fill="white"/>
    </svg>
  `;

  return Buffer.from(svg);
}

/**
 * Find first available icon file in assets directory.
 *
 * In order: icon.svg, icon.png, icon.jpg, icon.jpeg
 *
 * Throws and error if no icon is found.
 */
function findInputIcon(): string {
  const candidates = ["icon.svg", "icon.png", "icon.jpg", "icon.jpeg"];

  for (const candidate of candidates) {
    const candidatePath = path.join(ASSETS_DIR, candidate);
    if (fs.existsSync(candidatePath)) {
      return candidatePath;
    }
  }

  throw new Error(
    `No input icon found in ${ASSETS_DIR}. Please add an icon named one of: ${candidates.join(", ")}`,
  );
}

/**
 * Generate icons for Tauri application.
 *
 * A padded icon is generated for macOS to ensure consistent sizing. If
 * a custom icon is preferred please use `pnpm tauri icon assets/icon.png`
 * and add your own `icon.macOS.icns` to `src-tauri/icons`.
 */
async function main() {
  try {
    console.log("Generating icons...");

    if (!fs.existsSync(ASSETS_DIR)) {
      fs.mkdirSync(ASSETS_DIR, { recursive: true });
    }

    const inputIcon = findInputIcon();

    const paddingPercent = await promptForPadding();
    await createPaddedIcon(inputIcon, TEMP_ICON, paddingPercent);

    const background = await promptForBackground();

    await createMacOSIcon(
      inputIcon,
      TEMP_MACOS_ICON,
      background?.color,
      background?.useSquircle ?? true,
    );

    console.log("Generating macOS icons...");
    runCommand(`pnpm tauri icon ${TEMP_MACOS_ICON}`);

    if (fs.existsSync(GENERATED_ICNS)) {
      moveFile(GENERATED_ICNS, MACOS_ICNS);
    }

    console.log("Generating icons for other platforms...");
    runCommand(`pnpm tauri icon ${TEMP_ICON}`);

    console.log("✔ All icons generated successfully!");
  } catch (error) {
    console.error("✘ Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    console.log("Cleaning up temporary files...");
    if (fs.existsSync(TEMP_MACOS_ICON)) {
      fs.unlinkSync(TEMP_MACOS_ICON);
    }
    if (fs.existsSync(TEMP_ICON)) {
      fs.unlinkSync(TEMP_ICON);
    }
  }
}

/** Move and rename a file. */
function moveFile(source: string, destination: string): void {
  const destDir = path.dirname(destination);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  fs.renameSync(source, destination);
  console.log(`✔ Moved ${source} to ${destination}`);
}

/**
 * Prompt user for background color choice and shape.
 *
 * Used for macOS icon generation.
 */
async function promptForBackground(): Promise<
  undefined | { color: string; useSquircle: boolean }
> {
  const choice: "custom" | "dark" | "light" | "transparent" = await select({
    choices: [
      { name: "Light", value: "light" },
      { name: "Dark", value: "dark" },
      { name: "Transparent", value: "transparent" },
      {
        name: "Custom hex color",
        value: "custom",
      },
    ],
    default: "dark",
    message: "Choose macOS icon background color:",
  });

  if (choice === "transparent") {
    console.log("Using transparent background for macOS icon...");
    return undefined;
  }

  let color: string;
  switch (choice) {
    case "dark":
      console.log("Using dark background (#171717) for macOS icon...");
      color = "#171717";
      break;
    case "light":
      console.log("Using light background (#FFFFFF) for macOS icon...");
      color = "#FFFFFF";
      break;
    default:
      color = await input({
        default: "#171717",
        message: "Enter hex color:",
        validate: (value) => {
          if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
            return true;
          }
          return "Please enter a valid hex color (e.g., #171717)";
        },
      });
  }

  const shapeChoice: "rounded-rectangle" | "squircle" = await select({
    choices: [
      { name: "Squircle", value: "squircle" },
      { name: "Rounded rectangle", value: "rounded-rectangle" },
    ],
    default: "rounded-rectangle",
    message: "Choose macOS icon shape:",
  });

  return { color, useSquircle: shapeChoice === "squircle" };
}

/**
 * Prompt user for padding amount.
 *
 * Used for all platform icon generation.
 */
async function promptForPadding(): Promise<number> {
  const choice = await select({
    choices: [
      { name: "None (0%)", value: 0 },
      { name: "Small (5%)", value: 0.05 },
      { name: "Medium (10%)", value: 0.1 },
      { name: "Large (15%)", value: 0.15 },
      { name: "Custom", value: -1 },
    ],
    default: 0.12,
    message: "Choose padding amount for icons:",
  });

  if (choice === -1) {
    const padding = await input({
      default: "5",
      message: "Enter padding percentage (0-30):",
      validate: (value) => {
        const num = parseFloat(value);
        if (isNaN(num) || num < 0 || num > 30) {
          return "Please enter a valid number between 0 and 30";
        }
        return true;
      },
    });
    return parseFloat(padding) / 100;
  }

  return choice;
}

/** Execute a shell command */
function runCommand(command: string): void {
  console.log(`Running: ${command}`);
  execSync(command, { stdio: "inherit" });
}

main();
