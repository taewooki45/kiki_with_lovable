import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveListedKrx } from "./krxListedMatch";

export interface DbRowForTicker {
  source_place_id: string;
  name: string;
  map_display_name: string | null;
  description: string | null;
  sector: string | null;
}

const PAGE_SIZE = 1000;

/** "(여의도점)", "[강남]" 등 지점 접미 — 원문 매칭 실패 시 제거 후 재시도 */
function stripBranchHints(name: string): string {
  return name
    .replace(/\([^)]{0,40}\)/g, " ")
    .replace(/\[[^\]]{0,40}\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** name + map_display_name + description 을 searchExtra 로 넣어 매칭률 상승 */
export function resolveListedFromDbRow(row: DbRowForTicker) {
  const name = row.name?.trim() ?? "";
  if (!name) return null;
  const extra = [row.map_display_name, row.description].filter(Boolean).join(" ").trim();
  const ctx = { searchExtra: extra || undefined };

  const first = resolveListedKrx(name, ctx);
  if (first) return first;

  const simplified = stripBranchHints(name);
  if (simplified && simplified !== name) {
    return resolveListedKrx(simplified, ctx);
  }
  return null;
}

async function fetchRowsWithEmptyTicker(
  supabase: SupabaseClient,
  sel: string,
): Promise<DbRowForTicker[]> {
  const merged: DbRowForTicker[] = [];

  for (const isNull of [true, false] as const) {
    for (let from = 0; ; from += PAGE_SIZE) {
      let q = supabase.from("nearby_companies").select(sel);
      q = isNull ? q.is("ticker", null) : q.eq("ticker", "");
      const { data, error } = await q.order("source_place_id", { ascending: true }).range(from, from + PAGE_SIZE - 1);
      if (error) throw new Error(error.message);
      const batch = (data ?? []) as DbRowForTicker[];
      merged.push(...batch);
      if (batch.length < PAGE_SIZE) break;
    }
  }

  const seen = new Set<string>();
  const list: DbRowForTicker[] = [];
  for (const r of merged) {
    if (seen.has(r.source_place_id)) continue;
    seen.add(r.source_place_id);
    list.push(r);
  }
  return list;
}

/**
 * ticker 가 비어 있는 행을 규칙으로 채움. service role 클라이언트 사용.
 */
export async function repairEmptyTickers(supabase: SupabaseClient): Promise<{
  scanned: number;
  updated: number;
  skipped: number;
  updateErrors: number;
}> {
  const sel = "source_place_id,name,map_display_name,description,sector";
  const list = await fetchRowsWithEmptyTicker(supabase, sel);

  let updated = 0;
  let skipped = 0;
  let updateErrors = 0;

  /** Supabase REST 기본 행 한도(1000)를 넘기는 빈 ticker 행까지 모두 처리 */
  for (const row of list) {
    const listed = resolveListedFromDbRow(row);
    if (!listed) {
      skipped += 1;
      continue;
    }

    const { error: upErr } = await supabase
      .from("nearby_companies")
      .update({
        ticker: listed.ticker,
        stock_name: listed.stockName,
        map_display_name: listed.mapDisplayName,
        sector: listed.sector ?? row.sector,
        updated_at: new Date().toISOString(),
      })
      .eq("source_place_id", row.source_place_id);

    if (upErr) {
      console.warn("[tickerRepair] update failed:", row.source_place_id, upErr.message);
      updateErrors += 1;
      skipped += 1;
      continue;
    }
    updated += 1;
  }

  return { scanned: list.length, updated, skipped, updateErrors };
}
