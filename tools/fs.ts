import { readFile } from "node:fs/promises";

export async function loadJsonConfig<T>(path: string, fallback?: T): Promise<T> {
  try {
    const raw = await readFile(path, "utf-8");
    return JSON.parse(raw) as T;
  } catch (error) {
    if (fallback !== undefined) {
      return fallback;
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to load config from ${path}: ${message}`);
  }
}
