import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { serializeDbExcel, serializeDbJson } from "./exporters";
import type { BomDatabase, ComponentItem, PcbBomItem, PcbItem, PurchaseRecord } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "bom-data.json");
const EXPORT_DIR = path.join(DATA_DIR, "exports");
const SNAPSHOT_DIR = path.join(DATA_DIR, "snapshots");
const LATEST_JSON_FILE = path.join(EXPORT_DIR, "bom-data.latest.json");
const LATEST_EXCEL_FILE = path.join(EXPORT_DIR, "bom-data.latest.xls");
const MAX_SNAPSHOTS = 120;

const defaultDb: BomDatabase = {
  types: [
    {
      id: randomUUID(),
      name: "电阻",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: randomUUID(),
      name: "电容",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: randomUUID(),
      name: "芯片",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  components: [],
  pcbs: [],
};

export function createId() {
  return randomUUID();
}

export function nowIso() {
  return new Date().toISOString();
}

export function recomputeComponent(component: ComponentItem): ComponentItem {
  const totalQuantity = component.records.reduce((sum, item) => sum + item.quantity, 0);
  const lowestPrice =
    component.records.length > 0
      ? component.records.reduce((min, item) => Math.min(min, item.pricePerUnit), component.records[0].pricePerUnit)
      : null;

  return {
    ...component,
    warningThreshold: Number(component.warningThreshold ?? 0),
    totalQuantity,
    lowestPrice,
    updatedAt: nowIso(),
  };
}

export function normalizeComponent(input: ComponentItem): ComponentItem {
  return recomputeComponent({
    ...input,
    typeId: input.typeId,
    model: input.model.trim(),
    auxInfo: input.auxInfo?.trim() ?? "",
    note: input.note?.trim() ?? "",
    warningThreshold: Number(input.warningThreshold ?? 0),
    records: (input.records ?? []).map((record) => normalizeRecord(record)),
    totalQuantity: Number(input.totalQuantity ?? 0),
    lowestPrice: input.lowestPrice === null ? null : Number(input.lowestPrice),
    createdAt: input.createdAt ?? nowIso(),
    updatedAt: input.updatedAt ?? nowIso(),
  });
}

export function normalizeRecord(input: {
  id: string;
  platform: string;
  link: string;
  quantity: number;
  pricePerUnit: number;
  purchasedAt: string;
  createdAt: string;
  updatedAt: string;
}): PurchaseRecord {
  return {
    id: input.id,
    platform: input.platform.trim(),
    link: input.link.trim(),
    quantity: Number(input.quantity),
    pricePerUnit: Number(input.pricePerUnit),
    purchasedAt: input.purchasedAt,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}

export function normalizePcbBomItem(input: PcbBomItem): PcbBomItem {
  return {
    id: input.id,
    componentId: input.componentId,
    quantityPerBoard: Number(input.quantityPerBoard ?? 0),
    createdAt: input.createdAt ?? nowIso(),
    updatedAt: input.updatedAt ?? nowIso(),
  };
}

export function normalizePcb(input: PcbItem): PcbItem {
  return {
    id: input.id,
    projectName: input.projectName?.trim() ?? "",
    name: input.name?.trim() ?? "",
    version: input.version?.trim() ?? "",
    boardQuantity: Number(input.boardQuantity ?? 1),
    note: input.note?.trim() ?? "",
    items: (input.items ?? []).map((item) => normalizePcbBomItem(item)),
    createdAt: input.createdAt ?? nowIso(),
    updatedAt: input.updatedAt ?? nowIso(),
  };
}

async function ensureDbFile() {
  await mkdir(DATA_DIR, { recursive: true });
  await mkdir(EXPORT_DIR, { recursive: true });
  await mkdir(SNAPSHOT_DIR, { recursive: true });
  try {
    await readFile(DATA_FILE, "utf8");
  } catch {
    await writeFile(DATA_FILE, serializeDbJson(defaultDb), "utf8");
    await writeAutoExports(defaultDb);
  }
}

function sliceFirstJsonRoot(raw: string): string {
  const text = raw.replace(/^\uFEFF/, "").trim();
  if (!text) {
    throw new Error("数据库文件为空");
  }

  const firstChar = text[0];
  if (firstChar !== "{" && firstChar !== "[") {
    return text;
  }

  const stack: string[] = [firstChar];
  let inString = false;
  let escaped = false;

  for (let i = 1; i < text.length; i += 1) {
    const char = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{" || char === "[") {
      stack.push(char);
      continue;
    }

    if (char === "}" || char === "]") {
      const open = stack.at(-1);
      const matched = (open === "{" && char === "}") || (open === "[" && char === "]");
      if (matched) {
        stack.pop();
      }

      if (stack.length === 0) {
        return text.slice(0, i + 1);
      }
    }
  }

  return text;
}

function normalizeDb(parsed: BomDatabase): BomDatabase {
  return {
    types: parsed.types ?? [],
    components: (parsed.components ?? []).map((item) =>
      normalizeComponent({
        ...item,
        warningThreshold: Number(item.warningThreshold ?? 0),
      } as ComponentItem),
    ),
    pcbs: (parsed.pcbs ?? []).map((item) => normalizePcb(item as PcbItem)),
  };
}

function getSnapshotName() {
  return nowIso().replaceAll(":", "-").replaceAll(".", "-");
}

async function cleanupOldSnapshots() {
  const files = (await readdir(SNAPSHOT_DIR))
    .filter((file) => file.endsWith(".json"))
    .sort();

  if (files.length <= MAX_SNAPSHOTS) {
    return;
  }

  const staleFiles = files.slice(0, files.length - MAX_SNAPSHOTS);
  await Promise.all(staleFiles.map((file) => unlink(path.join(SNAPSHOT_DIR, file)).catch(() => {})));
}

async function writeAutoExports(db: BomDatabase) {
  const jsonText = serializeDbJson(db);
  const excelText = serializeDbExcel(db);

  await Promise.all([
    writeFile(LATEST_JSON_FILE, jsonText, "utf8"),
    writeFile(LATEST_EXCEL_FILE, excelText, "utf8"),
    writeFile(path.join(SNAPSHOT_DIR, `bom-data.${getSnapshotName()}.json`), jsonText, "utf8"),
  ]);

  await cleanupOldSnapshots();
}

async function tryRecoverFromLatestSnapshot() {
  const files = (await readdir(SNAPSHOT_DIR))
    .filter((file) => file.endsWith(".json"))
    .sort();

  const latest = files.at(-1);
  if (!latest) {
    return null;
  }

  const snapshotRaw = await readFile(path.join(SNAPSHOT_DIR, latest), "utf8");
  return JSON.parse(snapshotRaw) as BomDatabase;
}

export async function readDb(): Promise<BomDatabase> {
  await ensureDbFile();
  const raw = await readFile(DATA_FILE, "utf8");
  let parsed: BomDatabase | null = null;
  let shouldPersist = false;

  try {
    parsed = JSON.parse(raw) as BomDatabase;
  } catch {
    try {
      const recovered = sliceFirstJsonRoot(raw);
      parsed = JSON.parse(recovered) as BomDatabase;
      shouldPersist = true;
    } catch {
      parsed = await tryRecoverFromLatestSnapshot();
      shouldPersist = true;
    }
  }

  if (!parsed) {
    parsed = defaultDb;
    shouldPersist = true;
  }

  const normalized = normalizeDb(parsed);

  if (shouldPersist) {
    await writeFile(DATA_FILE, serializeDbJson(normalized), "utf8");
    await writeAutoExports(normalized);
  }

  return normalized;
}

export async function writeDb(db: BomDatabase): Promise<void> {
  await ensureDbFile();
  const normalized = normalizeDb(db);
  await writeFile(DATA_FILE, serializeDbJson(normalized), "utf8");
  await writeAutoExports(normalized);
}

export { DATA_FILE };
