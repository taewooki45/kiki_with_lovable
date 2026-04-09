import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { resolveListedKrx } from "./krxListedMatch";

interface Row {
  source_place_id: string;
  name: string;
  map_display_name: string | null;
  sector: string | null;
}

function tryResolve(row: Row) {
  const a = resolveListedKrx(row.name.trim(), {});
  if (a) return a;
  if (row.map_display_name?.trim()) {
    const b = resolveListedKrx(row.map_display_name.trim(), {});
    if (b) return b;
  }
  const combined = `${row.name} ${row.map_display_name ?? ""}`.trim();
  return resolveListedKrx(combined, {});
}

/**
 * DB에 ticker가 비어 있는 nearby_companies 행을 name 기준으로 다시 매칭해 채웁니다.
 * POST /api/companies/backfill-tickers  (헤더: x-sync-token — sync와 동일)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-sync-token");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const syncToken = process.env.COMPANY_SYNC_TOKEN;
  if (syncToken) {
    const received = req.headers["x-sync-token"];
    if (received !== syncToken) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    res.status(503).json({ error: "Supabase server env is not configured" });
    return;
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const sel = "source_place_id,name,map_display_name,sector";
    const { data: nullRows, error: e1 } = await supabase.from("nearby_companies").select(sel).is("ticker", null);
    const { data: emptyRows, error: e2 } = await supabase.from("nearby_companies").select(sel).eq("ticker", "");

    const fetchErr = e1 ?? e2;
    if (fetchErr) {
      res.status(500).json({ error: fetchErr.message });
      return;
    }

    const seen = new Set<string>();
    const list: Row[] = [];
    for (const r of [...(nullRows ?? []), ...(emptyRows ?? [])] as Row[]) {
      if (seen.has(r.source_place_id)) continue;
      seen.add(r.source_place_id);
      list.push(r);
    }
    let updated = 0;
    let skipped = 0;

    for (const row of list) {
      const listed = tryResolve(row);
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
        skipped += 1;
        continue;
      }
      updated += 1;
    }

    res.status(200).json({
      ok: true,
      scanned: list.length,
      updated,
      skipped,
      hint: skipped > 0 ? "일부 상호는 krxListedMatch 규칙에 없어 제외됐을 수 있습니다. sync 재실행도 고려하세요." : undefined,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    res.status(500).json({ error: message, stage: "backfill_tickers" });
  }
}
