import { useState } from "react";
import MapView from "@/components/MapView";
import StepCounter from "@/components/StepCounter";
import StockInfoSheet from "@/components/StockInfoSheet";
import TrendingSection from "@/components/TrendingSection";
import BottomNav from "@/components/BottomNav";
import { MOCK_STOCKS, MOCK_USER_WALK, MOCK_TRENDING, DEFAULT_CENTER, DEFAULT_RADIUS_M } from "@/data/mockStocks";
import type { StockPin } from "@/types/stock";
import { MapPin } from "lucide-react";
import { useUserLocation } from "@/hooks/useUserLocation";

const Index = () => {
  const [selectedStock, setSelectedStock] = useState<StockPin | null>(null);
  const [showTrending, setShowTrending] = useState(false);
  const { center, accuracyM, status } = useUserLocation(DEFAULT_CENTER);

  return (
    <div className="relative h-[100dvh] min-h-0 w-full overflow-hidden" data-testid="map-screen">
      {/* Map — 중심은 GPS(실패 시 mock 기본 좌표) */}
      <MapView
        center={center}
        radius={DEFAULT_RADIUS_M}
        stocks={MOCK_STOCKS}
        onSelectStock={setSelectedStock}
        showUserMarker={status === "ok"}
        userAccuracyM={accuracyM}
      />

      {/* Top overlay: Step counter — Leaflet 판 z-index(≤1000) 위로 */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1200] p-4 pt-[calc(env(safe-area-inset-top,0px)+12px)]">
        <div className="pointer-events-auto mx-auto w-full max-w-lg">
          <StepCounter walk={MOCK_USER_WALK} />
        </div>
      </div>

      {/* Trending toggle (플로팅 FAB) — 지도/마커보다 위 + 터치 우선 */}
      <div
        className="pointer-events-auto absolute bottom-[88px] right-[max(1rem,env(safe-area-inset-right))] z-[1200]"
        style={{ touchAction: "manipulation" }}
      >
        <button
          type="button"
          onClick={() => setShowTrending(!showTrending)}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-md ring-2 ring-background/80 transition-transform active:scale-95"
          aria-label="근처 인기 종목 보기"
          aria-pressed={showTrending}
        >
          <MapPin className="h-5 w-5" />
        </button>
      </div>

      {/* Trending section */}
      {showTrending && (
        <div className="animate-slide-up absolute bottom-[88px] left-[max(1rem,env(safe-area-inset-left))] right-[calc(4.5rem+max(0px,env(safe-area-inset-right)))] z-[1200] max-w-[min(100%,20rem)] sm:max-w-none">
          <TrendingSection stocks={MOCK_TRENDING} />
        </div>
      )}

      {/* Stock detail sheet */}
      <StockInfoSheet
        stock={selectedStock}
        onClose={() => setSelectedStock(null)}
        cashBalance={MOCK_USER_WALK.cashBalance}
      />

      {/* Bottom nav */}
      <BottomNav />
    </div>
  );
};

export default Index;
