import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { serializeDbExcel, serializeDbJson } from "./exporters";
import { getStorageDir } from "./storage-config";
import type { BomDatabase, ComponentItem, ComponentType, PcbBomItem, PcbItem, ProjectItem, PurchaseRecord, StoreReview } from "./types";

const DATA_FILE_NAME = "bom-data.json";
const EXPORT_DIR_NAME = "exports";
const SNAPSHOT_DIR_NAME = "snapshots";
const LATEST_JSON_FILE_NAME = "bom-data.latest.json";
const LATEST_EXCEL_FILE_NAME = "bom-data.latest.xls";
const MAX_SNAPSHOTS = 120;

const defaultDb: BomDatabase = {
  types: [
    {
      id: randomUUID(),
      name: "电阻",
      primaryName: "电阻",
      secondaryName: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: randomUUID(),
      name: "电容",
      primaryName: "电容",
      secondaryName: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: randomUUID(),
      name: "芯片",
      primaryName: "芯片",
      secondaryName: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  components: [],
  projects: [],
  pcbs: [],
  stores: [],
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
    projectId: input.projectId,
    name: input.name?.trim() ?? "",
    version: input.version?.trim() ?? "",
    boardQuantity: Number(input.boardQuantity ?? 1),
    note: input.note?.trim() ?? "",
    items: (input.items ?? []).map((item) => normalizePcbBomItem(item)),
    createdAt: input.createdAt ?? nowIso(),
    updatedAt: input.updatedAt ?? nowIso(),
  };
}

export function normalizeProject(input: ProjectItem): ProjectItem {
  return {
    id: input.id,
    name: input.name?.trim() ?? "",
    note: input.note?.trim() ?? "",
    createdAt: input.createdAt ?? nowIso(),
    updatedAt: input.updatedAt ?? nowIso(),
  };
}

export function normalizeType(input: ComponentType): ComponentType {
  const nameFallback = input.name?.trim() ?? "";
  const derivedPrimary = nameFallback.includes("/") ? nameFallback.split("/")[0]?.trim() ?? "" : nameFallback;
  const derivedSecondary = nameFallback.includes("/") ? nameFallback.split("/")[1]?.trim() ?? "" : "";
  const primaryName = input.primaryName?.trim() || derivedPrimary;
  const secondaryName = input.secondaryName?.trim() || derivedSecondary;
  const name = secondaryName ? `${primaryName}/${secondaryName}` : primaryName;

  return {
    id: input.id,
    name,
    primaryName,
    secondaryName,
    createdAt: input.createdAt ?? nowIso(),
    updatedAt: input.updatedAt ?? nowIso(),
  };
}

export function normalizeStore(input: StoreReview): StoreReview {
  return {
    id: input.id,
    platform: input.platform?.trim() ?? "",
    shopName: input.shopName?.trim() ?? "",
    qualityScore: Number(input.qualityScore ?? 0),
    shippingFee: Number(input.shippingFee ?? 0),
    priceScore: Number(input.priceScore ?? 0),
    mainProducts: input.mainProducts?.trim() ?? "",
    note: input.note?.trim() ?? "",
    createdAt: input.createdAt ?? nowIso(),
    updatedAt: input.updatedAt ?? nowIso(),
  };
}

async function ensureDbFile() {
  const paths = await getDataPaths();
  await mkdir(paths.dataDir, { recursive: true });
  await mkdir(paths.exportDir, { recursive: true });
  await mkdir(paths.snapshotDir, { recursive: true });
  try {
    await readFile(paths.dataFile, "utf8");
  } catch {
    await writeFile(paths.dataFile, serializeDbJson(defaultDb), "utf8");
    await writeAutoExports(defaultDb);
  }
}

async function getDataPaths() {
  const dataDir = await getStorageDir();
  const exportDir = path.join(dataDir, EXPORT_DIR_NAME);
  const snapshotDir = path.join(dataDir, SNAPSHOT_DIR_NAME);

  return {
    dataDir,
    dataFile: path.join(dataDir, DATA_FILE_NAME),
    exportDir,
    snapshotDir,
    latestJsonFile: path.join(exportDir, LATEST_JSON_FILE_NAME),
    latestExcelFile: path.join(exportDir, LATEST_EXCEL_FILE_NAME),
  };
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
  const normalizedTypes = (parsed.types ?? []).map((item) => normalizeType(item as ComponentType));
  const sourceProjects = (parsed.projects ?? []).map((item) => normalizeProject(item as ProjectItem));
  const projectByName = new Map(sourceProjects.map((item) => [item.name.toLowerCase(), item]));

  // Backward compatible migration: legacy pcb.projectName -> projects + pcb.projectId.
  const normalizedPcbs = (parsed.pcbs ?? []).map((item) => {
    const legacy = item as PcbItem & { projectName?: string };
    let projectId = legacy.projectId;

    if (!projectId) {
      const legacyProjectName = legacy.projectName?.trim() ?? "默认项目";
      const key = legacyProjectName.toLowerCase();
      let project = projectByName.get(key);
      if (!project) {
        const now = nowIso();
        project = {
          id: createId(),
          name: legacyProjectName,
          note: "",
          createdAt: now,
          updatedAt: now,
        };
        sourceProjects.push(project);
        projectByName.set(key, project);
      }
      projectId = project.id;
    }

    return normalizePcb({
      ...legacy,
      projectId,
    } as PcbItem);
  });

  return {
    types: normalizedTypes,
    components: (parsed.components ?? []).map((item) =>
      normalizeComponent({
        ...item,
        warningThreshold: Number(item.warningThreshold ?? 0),
      } as ComponentItem),
    ),
    projects: sourceProjects,
    pcbs: normalizedPcbs,
    stores: (parsed.stores ?? []).map((item) => normalizeStore(item as StoreReview)),
  };
}

function getSnapshotName() {
  return nowIso().replaceAll(":", "-").replaceAll(".", "-");
}

async function cleanupOldSnapshots() {
  const paths = await getDataPaths();
  const files = (await readdir(paths.snapshotDir))
    .filter((file) => file.endsWith(".json"))
    .sort();

  if (files.length <= MAX_SNAPSHOTS) {
    return;
  }

  const staleFiles = files.slice(0, files.length - MAX_SNAPSHOTS);
  await Promise.all(staleFiles.map((file) => unlink(path.join(paths.snapshotDir, file)).catch(() => {})));
}

async function writeAutoExports(db: BomDatabase) {
  const paths = await getDataPaths();
  const jsonText = serializeDbJson(db);
  const excelText = serializeDbExcel(db);

  await Promise.all([
    writeFile(paths.latestJsonFile, jsonText, "utf8"),
    writeFile(paths.latestExcelFile, excelText, "utf8"),
    writeFile(path.join(paths.snapshotDir, `bom-data.${getSnapshotName()}.json`), jsonText, "utf8"),
  ]);

  await cleanupOldSnapshots();
}

async function tryRecoverFromLatestSnapshot() {
  const paths = await getDataPaths();
  const files = (await readdir(paths.snapshotDir))
    .filter((file) => file.endsWith(".json"))
    .sort();

  const latest = files.at(-1);
  if (!latest) {
    return null;
  }

  const snapshotRaw = await readFile(path.join(paths.snapshotDir, latest), "utf8");
  return JSON.parse(snapshotRaw) as BomDatabase;
}

export async function readDb(): Promise<BomDatabase> {
  await ensureDbFile();
  const paths = await getDataPaths();
  const raw = await readFile(paths.dataFile, "utf8");
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

  const schemaNeedsPersist =
    !Array.isArray((parsed as { projects?: unknown }).projects) ||
    !Array.isArray((parsed as { stores?: unknown }).stores) ||
    ((parsed as { pcbs?: Array<{ projectId?: string }> }).pcbs ?? []).some((item) => !item.projectId);

  if (schemaNeedsPersist) {
    shouldPersist = true;
  }

  const normalized = normalizeDb(parsed);

  if (shouldPersist) {
    await writeFile(paths.dataFile, serializeDbJson(normalized), "utf8");
    await writeAutoExports(normalized);
  }

  return normalized;
}

export async function writeDb(db: BomDatabase): Promise<void> {
  await ensureDbFile();
  const paths = await getDataPaths();
  const normalized = normalizeDb(db);
  await writeFile(paths.dataFile, serializeDbJson(normalized), "utf8");
  await writeAutoExports(normalized);
}

export async function getDataFilePath() {
  const paths = await getDataPaths();
  return paths.dataFile;
}
