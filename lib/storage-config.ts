import os from "node:os";
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";

type StorageConfig = {
  dataDir?: string;
};

const CONFIG_DIR = path.join(os.homedir(), ".bom_manager");
const CONFIG_FILE = path.join(CONFIG_DIR, "storage-config.json");

function normalizeDir(input: string) {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("存储路径不能为空");
  }
  const resolved = path.resolve(trimmed);
  return resolved;
}

export async function getStorageDir() {
  if (process.env.BOM_DATA_DIR?.trim()) {
    return normalizeDir(process.env.BOM_DATA_DIR);
  }

  try {
    const raw = await readFile(CONFIG_FILE, "utf8");
    const parsed = JSON.parse(raw) as StorageConfig;
    if (parsed.dataDir?.trim()) {
      const dir = normalizeDir(parsed.dataDir);
      process.env.BOM_DATA_DIR = dir;
      return dir;
    }
  } catch {
    // fallback to default
  }

  const fallback = path.join(process.cwd(), "data");
  process.env.BOM_DATA_DIR = fallback;
  return fallback;
}

export async function setStorageDir(targetDir: string) {
  const dir = normalizeDir(targetDir);
  await mkdir(dir, { recursive: true });
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_FILE, `${JSON.stringify({ dataDir: dir }, null, 2)}\n`, "utf8");
  process.env.BOM_DATA_DIR = dir;
  return dir;
}

export async function getStorageConfig() {
  const dataDir = await getStorageDir();
  return {
    dataDir,
    configFile: CONFIG_FILE,
  };
}
