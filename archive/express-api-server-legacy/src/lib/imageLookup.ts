import { and, desc, eq, inArray } from "drizzle-orm";
import { db, imagesTable, type ImageTargetType } from "@workspace/db";

export function toImageUrl(objectPath: string): string {
  const entityId = objectPath.replace(/^\/objects\//, "");
  return `/images/objects/${entityId}`;
}

/**
 * Bulk-resolves the latest APPROVED image per targetId for a given
 * targetType, for joining into list responses (e.g. product rails) without
 * N+1 queries. Only approved images are ever surfaced here — pending/
 * rejected uploads must never leak into public-facing responses.
 */
export async function getApprovedImageMap(
  targetType: ImageTargetType,
  targetIds: number[],
): Promise<Map<number, string>> {
  if (targetIds.length === 0) return new Map();

  const rows = await db
    .select({ targetId: imagesTable.targetId, objectPath: imagesTable.objectPath, createdAt: imagesTable.createdAt })
    .from(imagesTable)
    .where(and(eq(imagesTable.targetType, targetType), eq(imagesTable.status, "approved"), inArray(imagesTable.targetId, targetIds)))
    .orderBy(desc(imagesTable.createdAt));

  const map = new Map<number, string>();
  for (const row of rows) {
    if (row.targetId == null || map.has(row.targetId)) continue;
    map.set(row.targetId, toImageUrl(row.objectPath));
  }
  return map;
}

export async function getApprovedImageUrl(targetType: ImageTargetType, targetId: number): Promise<string | null> {
  const map = await getApprovedImageMap(targetType, [targetId]);
  return map.get(targetId) ?? null;
}
