import type { StockPin } from "@/types/stock";
import { fetchNearbyCompaniesFromSupabase } from "@/lib/nearbyCompanies";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

interface NearbyApiCompany extends StockPin {
  distanceM?: number;
  sourceStation?: string | null;
}

interface NearbyApiResponse {
  companies: NearbyApiCompany[];
}

/**
 * 주변 상장 매칭 POI. 우선 Vercel `/api/companies/nearby`, 실패 시 브라우저에서 Supabase 직접 조회.
 * (로컬 `vite`만 켜면 /api 가 없어 빈 지도가 되는 문제 완화)
 */
export async function fetchNearbyCompanies(
  center: { lat: number; lng: number },
  radius = 1000,
): Promise<StockPin[]> {
  const params = new URLSearchParams({
    lat: String(center.lat),
    lng: String(center.lng),
    radius: String(radius),
  });

  try {
    const response = await fetch(`/api/companies/nearby?${params.toString()}`);
    if (response.ok) {
      const json = (await response.json()) as NearbyApiResponse;
      const list = Array.isArray(json.companies) ? json.companies : [];
      if (list.length > 0) return list;
    }
  } catch {
    /* /api 없음(로컬 Vite)·네트워크 오류 */
  }

  /** API가 200이지만 빈 배열이면(구버전 배포 등) Supabase 직접 조회로 한 번 더 */
  if (isSupabaseConfigured()) {
    return fetchNearbyCompaniesFromSupabase(center, radius);
  }

  return [];
}
