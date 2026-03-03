import { NextResponse } from "next/server";
import {
  createId,
  normalizeRecord,
  nowIso,
  readDb,
  recomputeComponent,
  writeDb,
} from "@/lib/db";

export const runtime = "nodejs";

type ImportRecord = {
  platform: string;
  link: string;
  quantity: number;
  pricePerUnit: number;
  purchasedAt?: string;
};

type ImportItem = {
  typeName: string;
  model: string;
  auxInfo?: string;
  note?: string;
  warningThreshold?: number;
  records?: ImportRecord[];
};

function normalizeImportRecord(input: ImportRecord) {
  const platform = input.platform?.trim();
  const link = input.link?.trim();
  const quantity = Number(input.quantity ?? 0);
  const pricePerUnit = Number(input.pricePerUnit ?? -1);

  if (!platform || !link || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(pricePerUnit) || pricePerUnit < 0) {
    throw new Error("导入记录参数不合法");
  }

  const now = nowIso();
  return normalizeRecord({
    id: createId(),
    platform,
    link,
    quantity,
    pricePerUnit,
    purchasedAt: input.purchasedAt ?? now,
    createdAt: now,
    updatedAt: now,
  });
}

export async function POST(req: Request) {
  const body = (await req.json()) as { items?: ImportItem[] };
  const items = body.items ?? [];

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ message: "导入数据不能为空" }, { status: 400 });
  }

  const db = await readDb();

  let typesCreated = 0;
  let componentsCreated = 0;
  let componentsUpdated = 0;
  let recordsAdded = 0;

  for (const item of items) {
    const typeName = item.typeName?.trim();
    const model = item.model?.trim();

    if (!typeName || !model) {
      return NextResponse.json({ message: "每条导入数据都必须包含类型和型号" }, { status: 400 });
    }

    const warningThreshold = Number(item.warningThreshold ?? 0);
    if (!Number.isFinite(warningThreshold) || warningThreshold < 0) {
      return NextResponse.json({ message: `型号 ${model} 的预警阈值不合法` }, { status: 400 });
    }

    const primaryName = typeName.includes("/") ? typeName.split("/")[0]?.trim() ?? "" : typeName;
    const secondaryName = typeName.includes("/") ? typeName.split("/")[1]?.trim() ?? "" : "";
    const normalizedTypeName = secondaryName ? `${primaryName}/${secondaryName}` : primaryName;
    let type = db.types.find(
      (entry) =>
        entry.primaryName.toLowerCase() === primaryName.toLowerCase() &&
        (entry.secondaryName ?? "").toLowerCase() === secondaryName.toLowerCase(),
    );
    if (!type) {
      const now = nowIso();
      type = {
        id: createId(),
        name: normalizedTypeName,
        primaryName,
        secondaryName,
        createdAt: now,
        updatedAt: now,
      };
      db.types.push(type);
      typesCreated += 1;
    }

    const recordList = (item.records ?? []).map(normalizeImportRecord);
    recordsAdded += recordList.length;

    const existing = db.components.find((entry) => entry.typeId === type.id && entry.model === model);

    if (existing) {
      existing.auxInfo = item.auxInfo?.trim() ?? existing.auxInfo;
      existing.note = item.note?.trim() ?? existing.note;
      existing.warningThreshold = warningThreshold;
      existing.records.push(...recordList);
      const index = db.components.findIndex((entry) => entry.id === existing.id);
      db.components[index] = recomputeComponent(existing);
      componentsUpdated += 1;
    } else {
      const now = nowIso();
      db.components.push(
        recomputeComponent({
          id: createId(),
          typeId: type.id,
          model,
          auxInfo: item.auxInfo?.trim() ?? "",
          note: item.note?.trim() ?? "",
          warningThreshold,
          records: recordList,
          totalQuantity: 0,
          lowestPrice: null,
          createdAt: now,
          updatedAt: now,
        }),
      );
      componentsCreated += 1;
    }
  }

  await writeDb(db);

  return NextResponse.json({
    message: "批量导入完成",
    summary: {
      typesCreated,
      componentsCreated,
      componentsUpdated,
      recordsAdded,
    },
  });
}
