import { createHash } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

export function safeJsonParse<T>(value: string): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    const cleaned = value
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    return JSON.parse(cleaned) as T;
  }
}

type CacheContents = Record<string, string>;

const DEFAULT_CACHE_FILE = path.join(process.cwd(), ".cache", "recipe-viz-api-cache.json");
const CACHE_FILE = process.env.RECIPE_VIZ_CACHE_FILE ?? DEFAULT_CACHE_FILE;

let cache: CacheContents | null = null;

async function loadCache(): Promise<CacheContents> {
  if (cache) {
    return cache;
  }

  try {
    const fileData = await readFile(CACHE_FILE, "utf8");
    cache = JSON.parse(fileData) as CacheContents;
  } catch {
    cache = {};
  }

  return cache;
}

async function persistCache(contents: CacheContents): Promise<void> {
  await mkdir(path.dirname(CACHE_FILE), { recursive: true });
  await writeFile(CACHE_FILE, JSON.stringify(contents, null, 2), "utf8");
}

export function createApiCacheKey(scope: string, requestPayload: string): string {
  const digest = createHash("sha256").update(requestPayload).digest("hex");
  return `${scope}:${digest}`;
}

export async function readApiCache(cacheKey: string): Promise<string | undefined> {
  const contents = await loadCache();
  return contents[cacheKey];
}

export async function writeApiCache(cacheKey: string, value: string): Promise<void> {
  const contents = await loadCache();
  contents[cacheKey] = value;
  await persistCache(contents);
}

export function getApiCacheFilePath(): string {
  return CACHE_FILE;
}
