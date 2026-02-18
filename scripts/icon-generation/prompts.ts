import { checkbox, input, select } from "@inquirer/prompts";
import fs from "node:fs";

import type { MacOSShape, Platform } from "./types";

import CONFIG from "./config";

/**
 * Request background color from the user.
 * @returns A hex color string for the background.
 */
export const getBackgroundColor = async (): Promise<string> => {
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
    case "dark": {
      return "#171717";
    }
    case "light": {
      return "#FFFFFF";
    }
    default: {
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
};

/**
 * Request macOS icon shape from the user.
 * @returns The selected macOS icon shape.
 */
export const getMacOSShape = async (): Promise<MacOSShape> => {
  return await select<MacOSShape>({
    choices: [
      { name: "Rounded Rectangle", value: "rounded-rectangle" },
      { name: "Squircle", value: "squircle" },
    ],
    default: "rounded-rectangle",
    message: "Choose macOS icon shape:",
  });
};

/**
 * Request platforms to generate icons for.
 * @returns An array of selected platforms.
 */
export const getPlatformsToGenerate = async (): Promise<Platform[]> => {
  const platforms = await checkbox<Platform>({
    choices: Object.entries(CONFIG.platform).map(([key, value]) => {
      const hasPrerequisite =
        "prerequisite" in value ? fs.existsSync(value.prerequisite) : true;

      const label =
        hasPrerequisite || !("prerequisite" in value)
          ? value.name
          : `${value.name} (${value.prerequisite} not found)`;

      return {
        checked: hasPrerequisite,
        name: label,
        value: key as Platform,
      };
    }),
    message: "Select platforms to generate icons for:",
    validate: (selected) =>
      selected.length > 0 ? true : "Please select at least one platform",
  });

  return platforms;
};

/**
 * Request whether to use a gradient.
 * @returns `true` if a gradient should be used.
 */
export const getUseGradient = async (): Promise<boolean> => {
  const choice = await select<boolean>({
    choices: [
      { name: "Yes - Subtle gradient", value: true },
      { name: "No - Solid color", value: false },
    ],
    default: true,
    message: "Use a subtle gradient background?",
  });

  return choice;
};
