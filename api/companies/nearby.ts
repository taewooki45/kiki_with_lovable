import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

function normalizeKrxTicker(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!/^\d+$/.test(s)) return null;
  if (s.length > 6) return null;
  return s.padStart(6, "0");
}

interface DbCompanyRow {
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

function mapRowsToCompanies(
  rows: DbCompanyRow[],
  lat: number,
  lng: number,
  maxDistanceM: number,
) {
  return rows
    .map((row) => {
      const ticker = normalizeKrxTicker(row.ticker != null ? String(row.ticker) : null);
      if (!ticker) return null;
      const distanceM = distanceMeters(lat, lng, row.lat, row.lng);
      return {
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
        distanceM,
        sourceStation: row.source_station,
      };
    })
    .filter((v): v is NonNullable<typeof v> => v != null)
    .filter((row) => row.distanceM <= maxDistanceM)
    .sort((a, b) => a.distanceM - b.distanceM);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const radius = Number(req.query.radius ?? 1000);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    res.status(400).json({ error: "lat/lng query required" });
    return;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    res.status(503).json({ error: "Supabase env is not configured" });
    return;
  }

  try {
    const supabase = createClient(supabaseUrl, anonKey);

    const fetchInBbox = async (bboxRadiusM: number) => {
      const latPad = bboxRadiusM / 111320;
      const lngPad = bboxRadiusM / (111320 * Math.cos((lat * Math.PI) / 180));
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

    let bboxRadius = Math.max(radius, 800);
    let { data, error } = await fetchInBbox(bboxRadius);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    let rows = (data ?? []) as DbCompanyRow[];
    let filtered = mapRowsToCompanies(rows, lat, lng, radius);

    // 1차 반경에 없으면 바운딩·거리를 넓혀 재시도 (크롤 1km 밖 가장자리·GPS 오차 대비)
    if (filtered.length === 0) {
      const wide = Math.min(Math.max(radius * 3, 2500), 6000);
      const second = await fetchInBbox(wide);
      if (!second.error && second.data?.length) {
        rows = second.data as DbCompanyRow[];
        filtered = mapRowsToCompanies(rows, lat, lng, wide);
      }
    }

    const companies = filtered.map(({ distanceM, sourceStation: _s, ...rest }) => rest);

    res.status(200).json({ companies });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    res.status(500).json({ error: message });
  }
}
