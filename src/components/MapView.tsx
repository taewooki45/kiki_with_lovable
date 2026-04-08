import { MapContainer, TileLayer, Circle, CircleMarker, useMap } from "react-leaflet";
import { useEffect } from "react";
import StockPinMarker from "./StockPin";
import type { StockPin } from "@/types/stock";

interface MapViewProps {
  center: { lat: number; lng: number };
  radius: number;
  stocks: StockPin[];
  onSelectStock: (stock: StockPin) => void;
  /** GPS 성공 시 사용자 위치 마커·정확도 원 표시 */
  showUserMarker?: boolean;
  /** 미터 단위, 있으면 반투명 정확도 원 */
  userAccuracyM?: number | null;
}

/** Recenter map when center changes */
function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom());
  }, [lat, lng, map]);
  return null;
}

/**
 * 첫 페인트·리사이즈 후 타일이 비는 문제 완화 (컨테이너 크기 재계산)
 */
function MapInvalidateSize() {
  const map = useMap();
  useEffect(() => {
    const run = () => map.invalidateSize({ animate: false });
    const raf = requestAnimationFrame(run);
    const delayed = window.setTimeout(run, 250);
    window.addEventListener("resize", run);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(delayed);
      window.removeEventListener("resize", run);
    };
  }, [map]);
  return null;
}

const MapView = ({
  center,
  radius,
  stocks,
  onSelectStock,
  showUserMarker = false,
  userAccuracyM = null,
}: MapViewProps) => {
  return (
    <div className="absolute inset-0 z-0 min-h-0 w-full" data-testid="map-wrapper">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={16}
        className="z-0 h-full w-full min-h-[100dvh]"
        style={{ minHeight: "100%" }}
        zoomControl={false}
        attributionControl
        scrollWheelZoom
        data-testid="map-container"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          subdomains={["a", "b", "c", "d"]}
          maxZoom={20}
        />
        <MapInvalidateSize />
        <RecenterMap lat={center.lat} lng={center.lng} />

        {/* 반경 표시 (앱 로직상 “내 주변”) */}
        <Circle
          center={[center.lat, center.lng]}
          radius={radius}
          pathOptions={{
            color: "hsl(210, 60%, 55%)",
            fillColor: "hsl(210, 60%, 55%)",
            fillOpacity: 0.08,
            weight: 2,
            dashArray: "6 4",
          }}
        />

        {/* GPS 정확도(미터) — Leaflet Circle 사용 */}
        {showUserMarker && userAccuracyM != null && userAccuracyM > 0 && (
          <Circle
            center={[center.lat, center.lng]}
            radius={Math.min(userAccuracyM, 400)}
            pathOptions={{
              color: "hsl(217, 91%, 60%)",
              fillColor: "hsl(217, 91%, 60%)",
              fillOpacity: 0.12,
              weight: 1,
            }}
          />
        )}

        {/* 내 위치 점(픽셀 반경) */}
        {showUserMarker && (
          <CircleMarker
            center={[center.lat, center.lng]}
            radius={8}
            pathOptions={{
              color: "#ffffff",
              fillColor: "hsl(217, 91%, 55%)",
              fillOpacity: 1,
              weight: 3,
            }}
          />
        )}

        {/* 주식 핀 */}
        {stocks.map((stock) => (
          <StockPinMarker
            key={stock.id}
            stock={stock}
            onSelect={onSelectStock}
          />
        ))}
      </MapContainer>
    </div>
  );
};

export default MapView;
