import { input, select } from "@inquirer/prompts";
import chalk from "chalk";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ASSETS_DIR = "assets";
const TAURI_ICONS_DIR = "src-tauri/icons";
const IOS_ICONS_DIR = "src-tauri/gen/apple/Assets.xcassets/AppIcon.appiconset";
const ANDROID_RES_DIR = "src-tauri/gen/android/app/src/main/res";
const ANDROID_BACKGROUND_XML = path.join(
  ANDROID_RES_DIR,
  "values/ic_launcher_background.xml",
);
const TEMP_DIR = path.join(ASSETS_DIR, ".temp-icons");

const TEMP_IOS_ICON = path.join(TEMP_DIR, "icon-ios-temp.png");
const TEMP_ANDROID_ICON = path.join(TEMP_DIR, "icon-android-temp.png");
const TEMP_MACOS_ICON = path.join(TEMP_DIR, "icon-macOS-temp.png");
const TEMP_WINDOWS_ICON = path.join(TEMP_DIR, "icon-windows-temp.png");
const TEMP_ANDROID_BACKUP = path.join(TEMP_DIR, "icon-android-backup");
const TEMP_IOS_BACKUP = path.join(TEMP_DIR, "icon-ios-backup");

const GENERATED_ICNS = path.join(TAURI_ICONS_DIR, "icon.icns");
const MACOS_ICNS = path.join(TAURI_ICONS_DIR, "icon.macOS.icns");

const TARGET_SIZE = 1024;
const MACOS_PADDING_PERCENT = 0.12; // 12% padding on each side (24% total)
const CORNER_RADIUS_PERCENT = 0.2237; // 22.37% corner radius for macOS icons

// Android adaptive icons to preserve
const ANDROID_ADAPTIVE_DIRS = [
  "mipmap-anydpi-v26",
  "mipmap-hdpi",
  "mipmap-mdpi",
  "mipmap-xhdpi",
  "mipmap-xxhdpi",
  "mipmap-xxxhdpi",
];

/** Backup Android adaptive icon folders from generated res directory. */
function backupAndroidAdaptiveIcons(): void {
  console.log("📦 Backing up Android adaptive icons...");

  if (!fs.existsSync(TEMP_ANDROID_BACKUP)) {
    fs.mkdirSync(TEMP_ANDROID_BACKUP, { recursive: true });
  }

  for (const dir of ANDROID_ADAPTIVE_DIRS) {
    const sourceDir = path.join(ANDROID_RES_DIR, dir);
    const backupDir = path.join(TEMP_ANDROID_BACKUP, dir);

    if (fs.existsSync(sourceDir)) {
      fs.cpSync(sourceDir, backupDir, { recursive: true });
      console.log(`  ${chalk.green("✔")} Backed up ${dir}`);
    }
  }
}

/** Backup iOS icons from generated directory. */
function backupIOSIcons(): void {
  console.log("📦 Backing up iOS icons...");

  if (!fs.existsSync(IOS_ICONS_DIR)) {
    console.warn(
      `  iOS icons directory not found at ${IOS_ICONS_DIR}. Skipping...`,
    );
    return;
  }

  if (!fs.existsSync(TEMP_IOS_BACKUP)) {
    fs.mkdirSync(TEMP_IOS_BACKUP, { recursive: true });
  }

  fs.cpSync(IOS_ICONS_DIR, TEMP_IOS_BACKUP, { recursive: true });
  console.log(`  ${chalk.green("✔")} Backed up iOS icons`);
}

/** Create icon with background color on full canvas (iOS/Android). */
async function createIconWithBackground(
  inputPath: string,
  outputPath: string,
  backgroundColor: string,
  paddingPercent: number,
  platform: string,
): Promise<void> {
  console.log(
    `🔨 Creating ${platform} icon with background and ${paddingPercent * 100}% padding...`,
  );

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
      background: backgroundColor,
      channels: 4,
      height: TARGET_SIZE,
      width: TARGET_SIZE,
    },
  })
    .composite([{ input: resizedIcon, left: paddingSize, top: paddingSize }])
    .png()
    .toFile(outputPath);

  console.log(`${chalk.green("✔")} ${platform} icon created at ${outputPath}`);
}

/** Resize image with padding centered on a 1024x1024 canvas. */
async function createMacOSIcon(
  inputPath: string,
  outputPath: string,
  backgroundColor: string | undefined,
  useSquircle: boolean,
  iconPaddingPercent: number,
): Promise<void> {
  console.log("🔨 Creating macOS icon with background and padding...");

  const paddingSize = Math.floor(TARGET_SIZE * MACOS_PADDING_PERCENT);
  const backgroundSize = TARGET_SIZE - paddingSize * 2;
  const cornerRadius = Math.floor(backgroundSize * CORNER_RADIUS_PERCENT);

  // Extra padding to create space from background edge
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

  console.log(`${chalk.green("✔")} macOS icon created at ${outputPath}`);
}

/** Create a padded icon on a transparent canvas. */
async function createPaddedIcon(
  inputPath: string,
  outputPath: string,
  paddingPercent: number,
): Promise<void> {
  console.log(
    `🔨 Creating padded icon with ${paddingPercent * 100}% padding...`,
  );

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

  console.log(`${chalk.green("✔")} Padded icon created at ${outputPath}`);
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
 * Creates separate padded versions for:
 * - Standard platforms (with user-specified padding)
 * - Android adaptive icons (with larger padding for splash screen)
 * - macOS (with background and custom padding)
 */
async function main() {
  try {
    if (!fs.existsSync(ASSETS_DIR)) {
      fs.mkdirSync(ASSETS_DIR, { recursive: true });
    }

    if (!fs.existsSync(TEMP_DIR)) {
      fs.mkdirSync(TEMP_DIR, { recursive: true });
    }

    const inputIcon = findInputIcon();
    const background = await promptForBackground();

    const iosPadding = 0.1;
    const androidPadding = 0.25;
    const macOSPadding = 0.05;

    const macOSShape = await promptForMacOSShape();

    await createPaddedIcon(inputIcon, TEMP_ANDROID_ICON, androidPadding);
    runCommand(`pnpm tauri icon ${TEMP_ANDROID_ICON}`);
    backupAndroidAdaptiveIcons();

    await createMacOSIcon(
      inputIcon,
      TEMP_MACOS_ICON,
      background,
      macOSShape === "squircle",
      macOSPadding,
    );
    runCommand(`pnpm tauri icon ${TEMP_MACOS_ICON}`);
    if (fs.existsSync(GENERATED_ICNS)) moveFile(GENERATED_ICNS, MACOS_ICNS);

    await createIconWithBackground(
      inputIcon,
      TEMP_IOS_ICON,
      background,
      iosPadding,
      "iOS",
    );
    runCommand(`pnpm tauri icon ${TEMP_IOS_ICON}`);
    backupIOSIcons();

    await createPaddedIcon(inputIcon, TEMP_WINDOWS_ICON, 0.05);
    runCommand(`pnpm tauri icon ${TEMP_WINDOWS_ICON}`);

    // generate icons replaces ic_launcher_background.xml
    updateAndroidBackgroundColor(background);
    restoreAndroidAdaptiveIcons();
    restoreIOSIcons();

    console.log(`${chalk.green("✔")} All icons generated successfully!`);
  } catch (error) {
    console.error(
      `${chalk.red("✘")} Error:`,
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  } finally {
    console.log("🚮 Cleaning up temporary files...");
    // fs.rmSync(TEMP_DIR, { recursive: true });
  }
}

/** Move and rename a file. */
function moveFile(source: string, destination: string): void {
  const destDir = path.dirname(destination);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  fs.renameSync(source, destination);
  console.log(`${chalk.green("✔")} Moved ${source} to ${destination}`);
}

/**
 * Prompt user for background color choice and shape.
 *
 * Used for macOS icon generation.
 */
async function promptForBackground(): Promise<string> {
  const choice: "custom" | "dark" | "light" = await select({
    choices: [
      { name: "Light", value: "light" },
      { name: "Dark", value: "dark" },
      {
        name: "Custom hex color",
        value: "custom",
      },
    ],
    default: "dark",
    message: "Choose background color (iOS, Android, macOS):",
  });

  switch (choice) {
    case "dark":
      return "#171717";
    case "light":
      return "#FFFFFF";
    default:
      return await input({
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
}

/**
 * Prompt user for macOS icon shape.
 */
async function promptForMacOSShape(): Promise<
  "rounded-rectangle" | "squircle"
> {
  return await select({
    choices: [
      { name: "Squircle", value: "squircle" },
      { name: "Rounded rectangle", value: "rounded-rectangle" },
    ],
    default: "squircle",
    message: "Choose macOS icon shape:",
  });
}

/** Restore Android adaptive icon folders to res directory. */
function restoreAndroidAdaptiveIcons(): void {
  console.log("📦 Restoring Android adaptive icons...");

  if (!fs.existsSync(TEMP_ANDROID_BACKUP)) {
    console.warn("  No backup found, skipping restore.");
    return;
  }

  const adaptiveDirs = fs.readdirSync(TEMP_ANDROID_BACKUP);

  for (const dir of adaptiveDirs) {
    const backupDir = path.join(TEMP_ANDROID_BACKUP, dir);
    const targetDir = path.join(ANDROID_RES_DIR, dir);

    if (fs.existsSync(backupDir)) {
      fs.cpSync(backupDir, targetDir, { recursive: true });
      console.log(`  ${chalk.green("✔")} Restored ${dir}`);
    }
  }
}

/** Restore iOS icons from backup. */
function restoreIOSIcons(): void {
  console.log("📦 Restoring iOS icons...");

  if (!fs.existsSync(TEMP_IOS_BACKUP)) {
    console.warn("  No iOS backup found, skipping restore.");
    return;
  }

  if (!fs.existsSync(IOS_ICONS_DIR)) {
    fs.mkdirSync(IOS_ICONS_DIR, { recursive: true });
  }

  fs.cpSync(TEMP_IOS_BACKUP, IOS_ICONS_DIR, { recursive: true });
  console.log(`  ${chalk.green("✔")} Restored iOS icons`);
}

/** Execute a shell command */
function runCommand(command: string): void {
  console.log(`⚡️ Running: ${command}`);
  execSync(command, { stdio: "ignore" });
}

/** Updates the Android ic_launcher_background.xml with the chosen hex color. */
function updateAndroidBackgroundColor(hexColor: string): void {
  if (!fs.existsSync(ANDROID_BACKGROUND_XML)) {
    console.warn(
      `  Android background XML not found at ${ANDROID_BACKGROUND_XML}. Skipping...`,
    );
    return;
  }

  console.log(`🎨 Updating Android launcher background XML to ${hexColor}...`);

  const xmlContent = fs.readFileSync(ANDROID_BACKGROUND_XML, "utf-8");

  const updatedXml = xmlContent.replace(
    /(<color name="ic_launcher_background">).*?(<\/color>)/,
    `$1${hexColor}$2`,
  );

  console.log(updatedXml);

  fs.writeFileSync(ANDROID_BACKGROUND_XML, updatedXml);
  console.log(`  ${chalk.green("✔")} Updated ic_launcher_background.xml`);
}

main();
