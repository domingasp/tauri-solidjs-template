import { input, select } from "@inquirer/prompts";
import { colord } from "colord";
import { exec } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import ora from "ora";
import sharp from "sharp";

const execAsync = promisify(exec);

// #region Configuration

const CONFIG = {
  constants: {
    androidAdaptiveDirs: [
      "mipmap-anydpi-v26",
      "mipmap-hdpi",
      "mipmap-mdpi",
      "mipmap-xhdpi",
      "mipmap-xxhdpi",
      "mipmap-xxxhdpi",
    ],
    macosCornerRadiusPercent: 0.2237,
    targetSize: 1024,
  },
  dirs: {
    androidRes: "src-tauri/gen/android/app/src/main/res",
    assets: "assets",
    iosIcons: "src-tauri/gen/apple/Assets.xcassets/AppIcon.appiconset",
    tauriIcons: "src-tauri/icons",
    temp: "assets/.temp-icons",
  },
  files: {
    androidBackgroundXml: "values/ic_launcher_background.xml",
    generatedIcns: "icon.icns",
    macosIcns: "icon.macOS.icns",
  },
  platform: {
    android: { name: "Android", padding: 0.25 },
    ios: { name: "iOS", padding: 0.1 },
    macos: { name: "macOS", padding: 0.1 },
    windows: { name: "Windows", padding: 0.05 },
  },
} as const;

// #endregion Configuration

// #region Types

type IconGenerationOptions = {
  backgroundColor?: string;
  inputPath: string;
  outputPath: string;
  paddingPercent: number;
  platform: Platform;
  useGradient?: boolean;
};
type MacOSIconOptions = Omit<
  IconGenerationOptions,
  "paddingPercent" | "platform"
> & {
  iconPaddingPercent: number;
  useSquircle: boolean;
};

type MacOSShape = "rounded-rectangle" | "squircle";

type Platform = "android" | "ios" | "macos" | "windows";

// #endregion Types

class AndroidHandler {
  /** Backup Android adaptive icon directories. */
  static backup(): void {
    const backupPath = FileManager.getBackupPath("android-adaptive");
    FileManager.ensureDir(backupPath);

    for (const dir of CONFIG.constants.androidAdaptiveDirs) {
      const sourceDir = path.join(CONFIG.dirs.androidRes, dir);
      const targetDir = path.join(backupPath, dir);
      if (fs.existsSync(sourceDir)) {
        FileManager.backup(sourceDir, targetDir);
      }
    }
  }

  /** Restore Android adaptive icon directories from backup. */
  static restore(): void {
    const backupPath = FileManager.getBackupPath("android-adaptive");
    if (!fs.existsSync(backupPath)) return;

    const adaptiveDirs = fs.readdirSync(backupPath);
    for (const dir of adaptiveDirs) {
      const sourcePath = path.join(backupPath, dir);
      const targetPath = path.join(CONFIG.dirs.androidRes, dir);
      if (fs.existsSync(sourcePath)) {
        FileManager.restore(sourcePath, targetPath);
      }
    }
  }

  /** Create gradient drawable and update adaptive icon to use it. */
  static setupGradientBackground(baseColor: string): void {
    const drawableDir = path.join(CONFIG.dirs.androidRes, "drawable");
    FileManager.ensureDir(drawableDir);

    const drawablePath = path.join(drawableDir, "ic_launcher_background.xml");
    const drawableContent = GradientGenerator.createAndroidDrawable(baseColor);
    fs.writeFileSync(drawablePath, drawableContent);

    this.updateAdaptiveIconBackground(
      "@color/ic_launcher_background",
      "@drawable/ic_launcher_background",
    );
  }

  /** Update the background color in the Android launcher XML files. */
  static updateBackgroundColor(hexColor: string): void {
    const xmlPath = path.join(
      CONFIG.dirs.androidRes,
      CONFIG.files.androidBackgroundXml,
    );

    if (!fs.existsSync(xmlPath)) return;

    const xmlContent = fs.readFileSync(xmlPath, "utf-8");
    const updatedXml = xmlContent.replace(
      /(<color name="ic_launcher_background">).*?(<\/color>)/,
      `$1${hexColor}$2`,
    );

    fs.writeFileSync(xmlPath, updatedXml);

    this.updateAdaptiveIconBackground(
      "@drawable/ic_launcher_background",
      "@color/ic_launcher_background",
    );
  }

  /** Update adaptive icon XML files to use specified background reference. */
  private static updateAdaptiveIconBackground(
    oldReference: string,
    newReference: string,
  ): void {
    const dir = CONFIG.constants.androidAdaptiveDirs.find((d) =>
      d.startsWith("mipmap-anydpi"),
    );
    if (!dir) return;

    const iconFiles = [
      path.join(CONFIG.dirs.androidRes, dir, "ic_launcher.xml"),
      path.join(CONFIG.dirs.androidRes, dir, "ic_launcher_round.xml"),
    ];

    for (const iconPath of iconFiles) {
      if (!fs.existsSync(iconPath)) continue;
      let content = fs.readFileSync(iconPath, "utf-8");
      content = content.replace(new RegExp(oldReference, "g"), newReference);
      fs.writeFileSync(iconPath, content);
    }
  }
}

class FileManager {
  /** Backup a directory or file to the backup location. */
  static backup(sourcePath: string, backupPath: string): void {
    this.ensureDir(path.dirname(backupPath));
    if (fs.existsSync(sourcePath)) {
      fs.cpSync(sourcePath, backupPath, { recursive: true });
    }
  }

  /** Ensure directory exists, creating it if necessary. */
  static ensureDir(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /** Find the first existing input icon file in the assets directory. */
  static findInputIcon(): string {
    const candidates = ["icon.svg", "icon.png", "icon.jpg", "icon.jpeg"];
    for (const candidate of candidates) {
      const candidatePath = path.join(CONFIG.dirs.assets, candidate);
      if (fs.existsSync(candidatePath)) {
        return candidatePath;
      }
    }

    throw new Error(
      `No input icon found in ${CONFIG.dirs.assets}. Please add: ${candidates.join(", ")}`,
    );
  }

  /** Get the backup path for a given subfolder. */
  static getBackupPath(subfolder: string): string {
    return path.join(CONFIG.dirs.temp, subfolder);
  }

  /** Get the temporary path for a given filename. */
  static getTempPath(filename: string): string {
    return path.join(CONFIG.dirs.temp, filename);
  }

  /** Move a directory or file to a new location. */
  static move(source: string, destination: string): void {
    this.ensureDir(path.dirname(destination));
    fs.renameSync(source, destination);
  }

  /** Restore a directory or file from the backup location. */
  static restore(backupPath: string, targetPath: string): void {
    if (!fs.existsSync(backupPath)) {
      return;
    }
    this.ensureDir(targetPath);
    fs.cpSync(backupPath, targetPath, { recursive: true });
  }
}

class GradientGenerator {
  /** Generate an Android drawable XML string with a radial gradient. */
  static createAndroidDrawable(baseColor: string): string {
    const base = colord(baseColor);
    const brightness = base.brightness();
    let variantA: string;
    let variantB: string;
    if (brightness < 0.3) {
      variantA = base.lighten(0.2).hue(20).toHex();
      variantB = base.lighten(0.08).hue(-20).toHex();
    } else if (brightness >= 1.0) {
      variantA = base.darken(0.15).hue(20).toHex();
      variantB = base.darken(0.3).hue(-20).toHex();
    } else {
      variantA = base.lighten(0.08).hue(20).toHex();
      variantB = base.darken(0.08).hue(-20).toHex();
    }

    return `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item>
        <shape>
            <solid android:color="${baseColor}" />
        </shape>
    </item>
    <item>
        <shape>
            <gradient
                android:type="radial"
                android:gradientRadius="90%"
                android:centerX="0.0"
                android:centerY="0.1"
                android:startColor="${variantA}"
                android:endColor="@android:color/transparent" />
        </shape>
    </item>
    <item>
        <shape>
            <gradient
                android:type="radial"
                android:gradientRadius="80%"
                android:centerX="1.0"
                android:centerY="1.0"
                android:startColor="${variantB}"
                android:endColor="@android:color/transparent" />
        </shape>
    </item>
</layer-list>`;
  }

  /** Generate a subtle radial gradient SVG. */
  static createGradient(
    width: number,
    height: number,
    baseColor: string,
  ): string {
    const base = colord(baseColor);
    const brightness = base.brightness();

    let variantA: string;
    let variantB: string;

    if (brightness < 0.3) {
      variantA = base.lighten(0.2).hue(20).toHex();
      variantB = base.lighten(0.08).hue(-20).toHex();
    } else if (brightness >= 1.0) {
      variantA = base.darken(0.15).hue(20).toHex();
      variantB = base.darken(0.3).hue(-20).toHex();
    } else {
      variantA = base.lighten(0.08).hue(20).toHex();
      variantB = base.darken(0.08).hue(-20).toHex();
    }

    return `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="topLeft" cx="0%" cy="10%" r="90%">
            <stop offset="0%" style="stop-color:${variantA};stop-opacity:0.6" />
            <stop offset="100%" style="stop-color:${baseColor};stop-opacity:0" />
          </radialGradient>
          <radialGradient id="bottomRight" cx="100%" cy="100%" r="80%">
            <stop offset="0%" style="stop-color:${variantB};stop-opacity:0.6" />
            <stop offset="100%" style="stop-color:${baseColor};stop-opacity:0" />
          </radialGradient>
        </defs>
        <rect width="${width}" height="${height}" fill="${baseColor}" />
        <rect width="${width}" height="${height}" fill="url(#topLeft)" />
        <rect width="${width}" height="${height}" fill="url(#bottomRight)" />
      </svg>
    `.trim();
  }

  /** Create a radial gradient buffer */
  static async createGradientBuffer(
    size: number,
    baseColor: string,
  ): Promise<Buffer> {
    const svg = this.createGradient(size, size, baseColor);
    return await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
  }
}

class IconGenerator {
  /** Create an icon with a background color and padding. */
  static async createIconWithBackground(
    options: IconGenerationOptions,
  ): Promise<void> {
    const {
      backgroundColor,
      inputPath,
      outputPath,
      paddingPercent,
      useGradient,
    } = options;
    const paddingSize = Math.floor(
      CONFIG.constants.targetSize * paddingPercent,
    );
    const iconSize = CONFIG.constants.targetSize - paddingSize * 2;

    const resizedIcon = await this.resizeIcon(inputPath, iconSize);
    let canvas: sharp.Sharp;
    if (useGradient && backgroundColor) {
      const gradientBuffer = await GradientGenerator.createGradientBuffer(
        CONFIG.constants.targetSize,
        backgroundColor,
      );
      canvas = sharp(gradientBuffer);
    } else {
      canvas = await this.createCanvas(
        CONFIG.constants.targetSize,
        backgroundColor,
      );
    }

    await canvas
      .composite([{ input: resizedIcon, left: paddingSize, top: paddingSize }])
      .png()
      .toFile(outputPath);
  }

  static async createMacOSIcon(options: MacOSIconOptions): Promise<void> {
    const {
      backgroundColor,
      iconPaddingPercent,
      inputPath,
      outputPath,
      useGradient,
      useSquircle,
    } = options;

    const paddingSize = Math.floor(
      CONFIG.constants.targetSize * CONFIG.platform.macos.padding,
    );
    const backgroundSize = CONFIG.constants.targetSize - paddingSize * 2;
    const cornerRadius = Math.floor(
      backgroundSize * CONFIG.constants.macosCornerRadiusPercent,
    );
    const iconPadding = Math.floor(backgroundSize * iconPaddingPercent);
    const iconSize = backgroundSize - iconPadding * 2;

    const resizedIcon = await this.resizeIcon(inputPath, iconSize);
    const mask = useSquircle
      ? await MaskGenerator.createSquircle(backgroundSize, backgroundSize)
      : await MaskGenerator.createRoundedRectangle(
          backgroundSize,
          backgroundSize,
          cornerRadius,
        );

    let backgroundCanvas: sharp.Sharp;
    if (useGradient && backgroundColor) {
      const gradientBuffer = await GradientGenerator.createGradientBuffer(
        backgroundSize,
        backgroundColor,
      );
      backgroundCanvas = sharp(gradientBuffer);
    } else {
      backgroundCanvas = await this.createCanvas(
        backgroundSize,
        backgroundColor,
      );
    }

    const maskedIcon = await backgroundCanvas
      .composite([{ blend: "dest-in", input: mask }, { input: resizedIcon }])
      .png()
      .toBuffer();

    await (
      await this.createCanvas(CONFIG.constants.targetSize)
    )
      .composite([{ input: maskedIcon, left: paddingSize, top: paddingSize }])
      .png()
      .toFile(outputPath);
  }

  /** Create an icon with padding around it. */
  static async createPaddedIcon(
    inputPath: string,
    outputPath: string,
    paddingPercent: number,
  ): Promise<void> {
    const paddingSize = Math.floor(
      CONFIG.constants.targetSize * paddingPercent,
    );
    const iconSize = CONFIG.constants.targetSize - paddingSize * 2;

    const resizedIcon = await this.resizeIcon(inputPath, iconSize);
    const canvas = await this.createCanvas(CONFIG.constants.targetSize);

    await canvas
      .composite([{ input: resizedIcon, left: paddingSize, top: paddingSize }])
      .png()
      .toFile(outputPath);
  }

  /** Create empty canvas of specified size. */
  private static async createCanvas(
    size: number,
    background?: string,
  ): Promise<sharp.Sharp> {
    return sharp({
      create: {
        background: background ?? { alpha: 0, b: 0, g: 0, r: 0 },
        channels: 4,
        height: size,
        width: size,
      },
    });
  }

  /** Resize an icon to the specified size. */
  private static async resizeIcon(
    inputPath: string,
    size: number,
  ): Promise<Buffer> {
    return sharp(inputPath)
      .resize(size, size, {
        background: { alpha: 0, b: 0, g: 0, r: 0 },
        fit: "contain",
      })
      .png()
      .toBuffer();
  }
}

class IOSHandler {
  /** Backup iOS icon assets. */
  static backup(): void {
    const backupPath = FileManager.getBackupPath("ios-icons");
    if (fs.existsSync(CONFIG.dirs.iosIcons)) {
      FileManager.backup(CONFIG.dirs.iosIcons, backupPath);
    }
  }

  /** Restore iOS icon assets from backup. */
  static restore(): void {
    const backupPath = FileManager.getBackupPath("ios-icons");
    if (fs.existsSync(backupPath)) {
      FileManager.restore(backupPath, CONFIG.dirs.iosIcons);
    }
  }
}

class MaskGenerator {
  /** Create a rounded rectangle mask. */
  static async createRoundedRectangle(
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

  /** Create a squircle mask. */
  static async createSquircle(width: number, height: number): Promise<Buffer> {
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
}

class PromptManager {
  /** Request background color from the user. */
  static async getBackgroundColor(): Promise<string> {
    const choice = await select<"custom" | "dark" | "light">({
      choices: [
        { name: "Light", value: "light" },
        { name: "Dark", value: "dark" },
        { name: "Custom hex code", value: "custom" },
      ],
      default: "dark",
      message: "Choose a background color (iOS, Android, macOS):",
    });

    switch (choice) {
      case "dark":
        return "#171717";
      case "light":
        return "#FFFFFF";
      default:
        return await input({
          default: "#171717",
          message: "Enter a custom hex color:",
          validate: (value) =>
            /^#[0-9A-Fa-f]{6}$/.test(value)
              ? true
              : "Please enter a valid hex color (e.g., #171717)",
        });
    }
  }

  /** Request macOS icon shape from the user. */
  static async getMacOSShape(): Promise<MacOSShape> {
    return await select<MacOSShape>({
      choices: [
        { name: "Rounded Rectangle", value: "rounded-rectangle" },
        { name: "Squircle", value: "squircle" },
      ],
      default: "rounded-rectangle",
      message: "Choose macOS icon shape:",
    });
  }

  /** Request whether to use a gradient. */
  static async useGradient(): Promise<boolean> {
    const choice = await select<boolean>({
      choices: [
        { name: "Yes - Subtle gradient", value: true },
        { name: "No - Solid color", value: false },
      ],
      default: true,
      message: "Use a subtle gradient background?",
    });

    return choice;
  }
}

class TaskRunner {
  static async generatePlatformIcons(
    inputIcon: string,
    platform: Platform,
    backgroundColor: string,
    useGradient?: boolean,
    macOSShape?: MacOSShape,
  ): Promise<string> {
    const config = CONFIG.platform[platform];
    const tempPath = FileManager.getTempPath(`icon-${platform}-temp.png`);

    switch (platform) {
      case "ios":
        await IconGenerator.createIconWithBackground({
          backgroundColor,
          inputPath: inputIcon,
          outputPath: tempPath,
          paddingPercent: config.padding,
          platform,
          useGradient,
        });
        break;
      case "macos":
        await IconGenerator.createMacOSIcon({
          backgroundColor,
          iconPaddingPercent: config.padding,
          inputPath: inputIcon,
          outputPath: tempPath,
          useGradient,
          useSquircle: macOSShape === "squircle",
        });
        break;
      default:
        await IconGenerator.createPaddedIcon(
          inputIcon,
          tempPath,
          config.padding,
        );
        break;
    }

    return tempPath;
  }

  /** Run a shell command synchronously, suppressing output. */
  static async runCommand(command: string): Promise<void> {
    await execAsync(command);
  }
}

async function main() {
  const spinner = ora();

  try {
    spinner.start("Setting up directories");
    FileManager.ensureDir(CONFIG.dirs.assets);
    FileManager.ensureDir(CONFIG.dirs.temp);
    spinner.succeed("Directories ready");

    spinner.start("Looking for input icon");
    const inputIcon = FileManager.findInputIcon();
    spinner.succeed(`Found input icon: ${path.basename(inputIcon)}`);

    const backgroundColor = await PromptManager.getBackgroundColor();
    const useGradient = await PromptManager.useGradient();
    const macOSShape = await PromptManager.getMacOSShape();

    spinner.start("Generating Android icons");
    const androidTempIcon = await TaskRunner.generatePlatformIcons(
      inputIcon,
      "android",
      backgroundColor,
      useGradient,
    );
    await TaskRunner.runCommand(`pnpm tauri icon ${androidTempIcon}`);
    AndroidHandler.backup();
    spinner.succeed("Android icons generated");

    spinner.start("Generating macOS icons");
    const generatedIcns = await TaskRunner.generatePlatformIcons(
      inputIcon,
      "macos",
      backgroundColor,
      useGradient,
      macOSShape,
    );
    const macosIcns = path.join(CONFIG.dirs.tauriIcons, CONFIG.files.macosIcns);
    if (fs.existsSync(generatedIcns)) {
      FileManager.move(generatedIcns, macosIcns);
    }
    spinner.succeed("macOS icons generated");

    spinner.start("Generating iOS icons");
    const iosTempIcon = await TaskRunner.generatePlatformIcons(
      inputIcon,
      "ios",
      backgroundColor,
      useGradient,
    );
    await TaskRunner.runCommand(`pnpm tauri icon ${iosTempIcon}`);
    IOSHandler.backup();
    spinner.succeed("iOS icons generated");

    spinner.start("Generating Windows icons");
    const windowsTempIcon = await TaskRunner.generatePlatformIcons(
      inputIcon,
      "windows",
      backgroundColor,
      useGradient,
    );
    await TaskRunner.runCommand(`pnpm tauri icon ${windowsTempIcon}`);
    spinner.succeed("Windows icons generated");

    spinner.start("Moving generated icons to final locations");
    AndroidHandler.restore();

    if (useGradient) AndroidHandler.setupGradientBackground(backgroundColor);
    else AndroidHandler.updateBackgroundColor(backgroundColor);

    IOSHandler.restore();
    spinner.succeed("Icons moved to final locations");

    spinner.succeed("✨ All icons generated successfully!");
  } catch (error) {
    spinner.fail("Icon generation failed");
    console.error(
      "Error:",
      error instanceof Error ? error.message : String(error),
    );

    process.exit(1);
  } finally {
    spinner.start("Cleaning up temporary files...");
    if (fs.existsSync(CONFIG.dirs.temp)) {
      fs.rmSync(CONFIG.dirs.temp, { force: true, recursive: true });
    }
    spinner.succeed("Cleanup complete");
  }
}

main();
