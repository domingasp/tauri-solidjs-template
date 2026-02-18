import sharp from "sharp";

import type { Platform } from "../types";

import CONFIG from "../config";
import { createGradientBuffer } from "./gradient";
import { createRoundedRectangle, createSquircle } from "./mask";

interface IconGenerationOptions {
  backgroundColor?: string;
  inputPath: string;
  outputPath: string;
  paddingPercent: number;
  platform: Platform;
  useGradient?: boolean;
}

type MacOSIconOptions = Omit<
  IconGenerationOptions,
  "paddingPercent" | "platform"
> & {
  iconPaddingPercent: number;
  useSquircle: boolean;
};

/**
 * Create empty canvas of specified size.
 * @returns A Sharp instance representing the canvas.
 */
const createCanvas = (size: number, background?: string): sharp.Sharp => {
  return sharp({
    create: {
      background: background ?? { alpha: 0, b: 0, g: 0, r: 0 },
      channels: 4,
      height: size,
      width: size,
    },
  });
};

/**
 * Resize an icon to the specified size.
 * @returns A buffer containing the resized icon.
 */
const resizeIcon = async (inputPath: string, size: number): Promise<Buffer> => {
  return sharp(inputPath)
    .resize(size, size, {
      background: { alpha: 0, b: 0, g: 0, r: 0 },
      fit: "contain",
    })
    .png()
    .toBuffer();
};

/**
 * Create and save an icon with padding around it.
 * @param inputPath Path to the source icon image.
 * @param outputPath Path to save the generated icon.
 * @param paddingPercent Percentage of the total size to use as padding on each side.
 */
export const createPaddedIcon = async (
  inputPath: string,
  outputPath: string,
  paddingPercent: number,
): Promise<void> => {
  const paddingSize = Math.floor(CONFIG.constants.targetSize * paddingPercent);
  const iconSize = CONFIG.constants.targetSize - paddingSize * 2;

  const resizedIcon = await resizeIcon(inputPath, iconSize);
  const canvas = createCanvas(CONFIG.constants.targetSize);

  await canvas
    .composite([{ input: resizedIcon, left: paddingSize, top: paddingSize }])
    .png()
    .toFile(outputPath);
};

/** Create an icon with a background color and padding. */
export const createIconWithBackground = async (
  options: IconGenerationOptions,
): Promise<void> => {
  const paddingSize = Math.floor(
    CONFIG.constants.targetSize * options.paddingPercent,
  );
  const iconSize = CONFIG.constants.targetSize - paddingSize * 2;
  const resizedIcon = await resizeIcon(options.inputPath, iconSize);
  let canvas: sharp.Sharp;
  if (options.useGradient && options.backgroundColor) {
    const gradientBuffer = await createGradientBuffer(
      CONFIG.constants.targetSize,
      options.backgroundColor,
    );
    canvas = sharp(gradientBuffer);
  } else {
    canvas = createCanvas(CONFIG.constants.targetSize, options.backgroundColor);
  }

  await canvas
    .composite([{ input: resizedIcon, left: paddingSize, top: paddingSize }])
    .png()
    .toFile(options.outputPath);
};

/**
 * Create a macOS icon with specified options, including background color,
 * padding, and shape.
 */
export const createMacOSIcon = async (
  options: MacOSIconOptions,
): Promise<void> => {
  const paddingSize = Math.floor(
    CONFIG.constants.targetSize * CONFIG.platform.macos.padding,
  );
  const backgroundSize = CONFIG.constants.targetSize - paddingSize * 2;
  const cornerRadius = Math.floor(
    backgroundSize * CONFIG.constants.macosCornerRadiusPercent,
  );
  const iconPadding = Math.floor(backgroundSize * options.iconPaddingPercent);
  const iconSize = backgroundSize - iconPadding * 2;

  const resizedIcon = await resizeIcon(options.inputPath, iconSize);
  const mask = options.useSquircle
    ? createSquircle(backgroundSize, backgroundSize)
    : createRoundedRectangle(backgroundSize, backgroundSize, cornerRadius);

  let backgroundCanvas: sharp.Sharp;
  if (options.useGradient && options.backgroundColor) {
    const gradientBuffer = await createGradientBuffer(
      backgroundSize,
      options.backgroundColor,
    );
    backgroundCanvas = sharp(gradientBuffer);
  } else {
    backgroundCanvas = createCanvas(backgroundSize, options.backgroundColor);
  }

  const maskedIcon = await backgroundCanvas
    .composite([
      { blend: "dest-in", input: mask },
      { input: resizedIcon, left: iconPadding, top: iconPadding },
    ])
    .png()
    .toBuffer();

  await createCanvas(CONFIG.constants.targetSize)
    .composite([{ input: maskedIcon, left: paddingSize, top: paddingSize }])
    .png()
    .toFile(options.outputPath);
};
