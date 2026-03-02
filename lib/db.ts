import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { BomDatabase, ComponentItem, PurchaseRecord } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "bom-data.json");

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

async function ensureDbFile() {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    await readFile(DATA_FILE, "utf8");
  } catch {
    await writeFile(DATA_FILE, JSON.stringify(defaultDb, null, 2), "utf8");
  }
}

export async function readDb(): Promise<BomDatabase> {
  await ensureDbFile();
  const raw = await readFile(DATA_FILE, "utf8");
  const parsed = JSON.parse(raw) as BomDatabase;

  return {
    types: parsed.types ?? [],
    components: (parsed.components ?? []).map((item) =>
      normalizeComponent({
        ...item,
        warningThreshold: Number(item.warningThreshold ?? 0),
      } as ComponentItem),
    ),
  };
}

export async function writeDb(db: BomDatabase): Promise<void> {
  await ensureDbFile();
  await writeFile(DATA_FILE, JSON.stringify(db, null, 2), "utf8");
}

export { DATA_FILE };
