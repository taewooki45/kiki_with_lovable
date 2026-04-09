import { supabase } from "@/lib/supabaseClient";
import type { StockPin } from "@/types/stock";

/** KRX 6자리로 정규화 (DB에 앞자리 0 누락된 경우 대비) */
export function normalizeKrxTicker(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!/^\d+$/.test(s)) return null;
  if (s.length > 6) return null;
  return s.padStart(6, "0");
}

function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const p =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(p), Math.sqrt(1 - p));
}

interface DbRow {
  source_place_id: string;
  name: string;
  lat: number;
  lng: number;
  sector: string | null;
  description: string | null;
  source_station: string | null;
  ticker: string | null;
  stock_name: string | null;
  map_display_name: string | null;
}

/**
 * 브라우저에서 Supabase anon으로 직접 조회 (로컬 dev에 /api 없을 때 등).
 * 서버의 /api/companies/nearby 와 동일한 필터·정렬.
 */
export async function fetchNearbyCompaniesFromSupabase(
  center: { lat: number; lng: number },
  radiusM: number,
): Promise<StockPin[]> {
  if (!supabase) return [];

  const lat = center.lat;
  const lng = center.lng;

  const fetchBbox = async (bboxM: number) => {
    const latPad = bboxM / 111320;
    const lngPad = bboxM / (111320 * Math.cos((lat * Math.PI) / 180));
    return supabase
      .from("nearby_companies")
      .select(
        "source_place_id,name,lat,lng,sector,description,source_station,ticker,stock_name,map_display_name",
      )
      .not("ticker", "is", null)
      .gte("lat", lat - latPad)
      .lte("lat", lat + latPad)
      .gte("lng", lng - lngPad)
      .lte("lng", lng + lngPad)
      .limit(500);
  };

  type WithD = StockPin & { _d: number };

  const rowsToPins = (r: DbRow[], maxDistM: number): StockPin[] => {
    const mapped: WithD[] = r
      .map((row) => {
        const ticker = normalizeKrxTicker(row.ticker != null ? String(row.ticker) : null);
        if (!ticker) return null;
        const _d = distanceMeters(lat, lng, row.lat, row.lng);
        const pin: WithD = {
          id: row.source_place_id,
          ticker,
          name: (row.stock_name ?? row.map_display_name ?? row.name).trim(),
          lat: row.lat,
          lng: row.lng,
          sector: row.sector ?? "기타",
          description: row.description ?? "주변 기업 정보",
          isSponsored: false,
          logoUrl: undefined,
          price: 0,
          changePercent: 0,
          _d,
        };
        return pin;
      })
      .filter((v): v is WithD => v != null)
      .filter((row) => row._d <= maxDistM)
      .sort((a, b) => a._d - b._d);

    return mapped.map(({ _d, ...rest }) => rest);
  };

  let bboxRadius = Math.max(radiusM, 800);
  let { data, error } = await fetchBbox(bboxRadius);
  if (error) return [];

  let rows = (data ?? []) as DbRow[];
  let pins = rowsToPins(rows, radiusM);

  if (pins.length === 0) {
    const wide = Math.min(Math.max(radiusM * 3, 2500), 6000);
    const second = await fetchBbox(wide);
    if (!second.error && second.data?.length) {
      rows = second.data as DbRow[];
      pins = rowsToPins(rows, wide);
    }
  }

  return pins;
}
