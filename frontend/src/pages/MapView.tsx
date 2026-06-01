import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Navigation, Filter, TreePine, Clock, Star, Share2, Copy, Check, Route, Loader2, Database, ChevronUp, ChevronDown, Map } from 'lucide-react';
import { getScoreColor, getGradeDescription } from '../utils/accessibility';
import type { RecommendationFilter } from '../types';

// ─── VWorld API 키 ────────────────────────────────────────────────────────────
const VWORLD_KEY = '4B826FAE-56F2-32CB-829B-2CD7F7DFF7E7';

// ─── 백엔드 API URL
const API_BASE = import.meta.env.VITE_API_BASE
  || (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? 'https://greenreach-api.onrender.com'
    : 'http://localhost:8000');

// ─── 타입 정의 ────────────────────────────────────────────────────────────────
interface Park {
  id: string;
  name: string;
  type: string;
  district: string;
  address: string;
  lat: number;
  lng: number;
  area: number;
  facilities: string[];
  childFriendly: boolean;
  petFriendly: boolean;
  accessible: boolean;
  manager?: string;
  phone?: string;
  dataDate?: string;
  straightDistance?: number;
  walkingDistance?: number;
  walkingTime?: number;
}

interface AccessibilityResult {
  score: number;
  grade: string;
  nearestPark: Park;
  walkingDistance: number;
  walkingTime: number;
  slopeAdjustedTime?: number;
  slopePenalty?: number;
  elevationGain?: number;
  elevationLoss?: number;
  routeCoords?: [number, number][];
  routeMethod?: string;
  parkCount500m: number;
  parkCount1km: number;
  distScore: number;
  densityScore: number;
  areaScore: number;
  data_source?: string;
  db?: string;
  error?: string;
}

// ─── Leaflet 마커 아이콘 ──────────────────────────────────────────────────────
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const userIcon = L.divIcon({
  html: `<div style="position:relative;width:20px;height:20px">
    <div style="position:absolute;inset:0;background:#16a34a;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35)"></div>
    <div style="position:absolute;inset:-6px;background:#16a34a22;border-radius:50%;animation:pulse 2s infinite"></div>
  </div>`,
  className: '',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const parkIcon = L.divIcon({
  html: `<div style="background:#22c55e;width:28px;height:28px;border-radius:50%;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.2);display:flex;align-items:center;justify-content:center;font-size:14px">🌳</div>`,
  className: '',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const selectedParkIcon = L.divIcon({
  html: `<div style="background:#dc2626;width:34px;height:34px;border-radius:50%;border:3px solid white;box-shadow:0 3px 10px rgba(220,38,38,0.5);display:flex;align-items:center;justify-content:center;font-size:16px">🌳</div>`,
  className: '',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

// ─── 지도 이벤트 컴포넌트 ─────────────────────────────────────────────────────
function MapClickHandler({ onMapClick, enabled }: { onMapClick: (lat: number, lng: number) => void; enabled: boolean }) {
  useMapEvents({
    click(e) {
      if (!enabled) return;
      const target = e.originalEvent.target as HTMLElement;
      if (target.closest('.leaflet-marker-icon') || target.closest('.leaflet-popup')) return;
      onMapClick(e.latlng.lat, e.latlng.lng);
    }
  });
  return null;
}

function MapCenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => { map.setView([lat, lng], 14); }, [lat, lng, map]);
  return null;
}

function MapRefCapture({ mapRef }: { mapRef: React.MutableRefObject<L.Map | null> }) {
  const map = useMap();
  useEffect(() => { mapRef.current = map; }, [map, mapRef]);
  return null;
}

// ─── OSRM 도보 경로 ──────────────────────────────────────────────────────────
// Valhalla(valhalla1.openstreetmap.de)는 한국 데이터 미지원 → OSRM 사용
async function fetchWalkingRoute(
  fromLat: number, fromLng: number,
  toLat: number, toLng: number
): Promise<[number, number][]> {
  try {
    const url = `https://router.project-osrm.org/route/v1/foot/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
    const data = await res.json();
    if (data.code !== 'Ok' || !data.routes?.[0]) throw new Error('경로 없음');
    return data.routes[0].geometry.coordinates.map(
      ([lng, lat]: [number, number]) => [lat, lng] as [number, number]
    );
  } catch {
    return [[fromLat, fromLng], [toLat, toLng]];
  }
}

const DEFAULT_LAT = 37.5665;
const DEFAULT_LNG = 126.9780;

// ─── 지도 컴포넌트 Props ──────────────────────────────────────────────────────
interface MapComponentProps {
  userLat: number;
  userLng: number;
  score: AccessibilityResult | null;
  visibleParks: Park[];
  selectedParkId: string | null;
  routeParkId: string | null;
  routeLoading: boolean;
  showRoute: boolean;
  routeCoords: [number, number][];
  mapRef: React.MutableRefObject<L.Map | null>;
  onMapClick: (lat: number, lng: number) => void;
  onSelectPark: (parkId: string) => void;
  onShowRoute: (park: Park) => void;
  onCancelRoute: () => void;
}

// ─── 지도 컴포넌트 (외부 정의 + memo로 불필요한 리마운트 방지) ──────────────
const MapComponent = memo(({
  userLat, userLng, score, visibleParks,
  selectedParkId, routeParkId, routeLoading, showRoute, routeCoords,
  mapRef, onMapClick, onSelectPark, onShowRoute, onCancelRoute,
}: MapComponentProps) => (
  <MapContainer
    center={[userLat, userLng]}
    zoom={14}
    style={{ width: '100%', height: '100%', cursor: 'grab' }}
  >
    <TileLayer
      attribution='&copy; <a href="https://www.vworld.kr" target="_blank">VWorld</a>'
      url={`https://api.vworld.kr/req/wmts/1.0.0/${VWORLD_KEY}/Base/{z}/{y}/{x}.png`}
      maxZoom={19}
      tileSize={256}
    />
    <MapCenter lat={userLat} lng={userLng} />
    <MapClickHandler onMapClick={onMapClick} enabled={false} />
    <MapRefCapture mapRef={mapRef} />

    <Marker position={[userLat, userLng]} icon={userIcon}>
      <Popup>
        <div className="text-sm font-semibold">📍 분석 위치</div>
        <div className="text-xs text-gray-500 mt-1">점수: <strong>{score?.score ?? '-'}점</strong> {score?.grade}등급</div>
      </Popup>
    </Marker>

    <Circle center={[userLat, userLng]} radius={500}
      pathOptions={{ color: '#16a34a', fillColor: '#16a34a', fillOpacity: 0.05, weight: 1.5, dashArray: '5,5' }} />
    <Circle center={[userLat, userLng]} radius={1000}
      pathOptions={{ color: '#16a34a', fillColor: '#16a34a', fillOpacity: 0.02, weight: 1, dashArray: '8,8' }} />

    {showRoute && routeCoords.length > 1 && (
      <Polyline positions={routeCoords}
        pathOptions={{ color: '#2563eb', weight: 5, opacity: 0.85, lineCap: 'round', lineJoin: 'round' }} />
    )}

    {visibleParks.map((park) => {
      const isSelected = selectedParkId === park.id;
      const isRouteActive = routeParkId === park.id && showRoute;
      return (
        <Marker
          key={park.id}
          position={[park.lat, park.lng]}
          icon={isSelected ? selectedParkIcon : parkIcon}
          ref={(markerInstance) => {
            if (markerInstance && selectedParkId === park.id) {
              markerInstance.openPopup();
            }
          }}
          eventHandlers={{
            click: (e) => {
              onSelectPark(park.id);
              e.target.openPopup();
            },
          }}
        >
          <Popup>
            <div style={{ minWidth: 200 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{park.name}</div>
              {isSelected && <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 600, marginBottom: 2 }}>📍 선택된 공원</div>}
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>{park.type} · {park.district}</div>
              {park.area > 0 && <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>면적: {(park.area / 10000).toFixed(1)}ha</div>}
              {park.walkingDistance && (
                <div style={{ fontSize: 12, fontWeight: 600, color: '#16a34a', marginBottom: 8 }}>
                  🚶 도보 {park.walkingTime}분 ({park.walkingDistance}m)
                </div>
              )}
              {/* 액션 버튼 */}
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <button
                  style={{
                    flex: 1, padding: '6px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: isRouteActive ? '#2563eb' : '#eff6ff',
                    color: isRouteActive ? '#fff' : '#1d4ed8',
                    fontSize: 11, fontWeight: 600,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onShowRoute(park);
                  }}
                >
                  {routeLoading && routeParkId === park.id ? '⏳ 계산 중...' : isRouteActive ? '🗺️ 경로 표시 중' : '🗺️ 경로 표시'}
                </button>
                <button
                  style={{
                    flex: 1, padding: '6px 0', borderRadius: 8, border: 'none',
                    cursor: isRouteActive ? 'pointer' : 'default',
                    background: isRouteActive ? '#fee2e2' : '#f3f4f6',
                    color: isRouteActive ? '#dc2626' : '#9ca3af',
                    fontSize: 11, fontWeight: 600,
                    opacity: isRouteActive ? 1 : 0.5,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isRouteActive) onCancelRoute();
                  }}
                  disabled={!isRouteActive}
                >
                  ❌ 경로 취소
                </button>
              </div>
            </div>
          </Popup>
        </Marker>
      );
    })}
  </MapContainer>
));

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────
export default function MapView() {
  const [userLat, setUserLat] = useState(DEFAULT_LAT);
  const [userLng, setUserLng] = useState(DEFAULT_LNG);
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationError, setLocationError] = useState('');
  const [locationReady, setLocationReady] = useState(false);

  const [score, setScore] = useState<AccessibilityResult | null>(null);
  const [nearbyParks, setNearbyParks] = useState<Park[]>([]);
  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  const [showFilter, setShowFilter] = useState(false);
  const [filter, setFilter] = useState<RecommendationFilter>({
    childFriendly: false,
    petFriendly: false,
    accessible: false,
    maxDistance: 2000,
  });

  const [selectedParkId, setSelectedParkId] = useState<string | null>(null);
  const [selectedPark, setSelectedPark] = useState<Park | null>(null);
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const [showRoute, setShowRoute] = useState(false);
  const [routeParkId, setRouteParkId] = useState<string | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [copied, setCopied] = useState(false);
  const mapRef = useRef<L.Map | null>(null);

  const [mobileTab, setMobileTab] = useState<'map' | 'info'>('map');

  // 백엔드 상태 확인 + 자동 위치 감지
  useEffect(() => {
    fetch(`${API_BASE}/health`)
      .then(r => r.json())
      .then(d => setBackendOnline(d.status === 'ok'))
      .catch(() => setBackendOnline(false));

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLat(pos.coords.latitude);
          setUserLng(pos.coords.longitude);
          setLocationLoading(false);
          setLocationReady(true);
        },
        () => {
          setLocationLoading(false);
          setLocationReady(true);
        },
        { timeout: 8000, maximumAge: 60000 }
      );
    } else {
      setLocationLoading(false);
      setLocationReady(true);
    }
  }, []);

  const analyzeLocation = useCallback(async (lat: number, lng: number) => {
    setApiLoading(true);
    setApiError('');
    setRouteCoords([]);
    setShowRoute(false);
    setSelectedParkId(null);
    setSelectedPark(null);

    try {
      const [scoreRes, nearbyRes] = await Promise.all([
        fetch(`${API_BASE}/api/accessibility/osm?lat=${lat}&lng=${lng}`),
        fetch(`${API_BASE}/api/parks/nearby?lat=${lat}&lng=${lng}&radius=${filter.maxDistance}&limit=20`),
      ]);

      if (!scoreRes.ok || !nearbyRes.ok) throw new Error('API 응답 오류');

      const scoreData: AccessibilityResult = await scoreRes.json();
      const nearbyData = await nearbyRes.json();

      if (scoreData.error) {
        setApiError(scoreData.error);
        setScore(null);
      } else {
        setScore(scoreData);
      }

      let parks: Park[] = nearbyData.parks || [];
      if (filter.childFriendly) parks = parks.filter(p => p.childFriendly);
      if (filter.petFriendly) parks = parks.filter(p => p.petFriendly);
      if (filter.accessible) parks = parks.filter(p => p.accessible);
      setNearbyParks(parks);

    } catch {
      setApiError('서버에 연결할 수 없습니다.');
      setScore(null);
      setNearbyParks([]);
    } finally {
      setApiLoading(false);
    }
  }, [filter.maxDistance, filter.childFriendly, filter.petFriendly, filter.accessible]);

  useEffect(() => {
    if (!locationReady) return;
    analyzeLocation(userLat, userLng);
  }, [userLat, userLng, analyzeLocation, locationReady]);

  const getMyLocation = () => {
    setLocationLoading(true);
    setLocationError('');
    setLocationReady(false);
    if (!navigator.geolocation) {
      setLocationError('위치 정보를 지원하지 않습니다.');
      setLocationLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLat(pos.coords.latitude);
        setUserLng(pos.coords.longitude);
        setLocationLoading(false);
        setLocationReady(true);
      },
      () => {
        setLocationError('위치를 가져올 수 없습니다. 지도를 클릭하세요.');
        setLocationLoading(false);
        setLocationReady(true);
      }
    );
  };

  const handleMapClick = useCallback((lat: number, lng: number) => {
    setUserLat(lat);
    setUserLng(lng);
    setLocationError('');
  }, []);

  const handleShowRoute = async () => {
    if (!score?.nearestPark) return;
    setRouteLoading(true);
    const coords = await fetchWalkingRoute(
      userLat, userLng,
      score.nearestPark.lat, score.nearestPark.lng
    );
    setRouteCoords(coords);
    setShowRoute(true);
    setRouteLoading(false);
  };

  // 팝업 내 경로 표시 버튼 핸들러
  const handleShowRoutePark = useCallback(async (park: Park) => {
    setRouteCoords([]);
    setShowRoute(false);
    setRouteParkId(park.id);
    setRouteLoading(true);
    const coords = await fetchWalkingRoute(userLat, userLng, park.lat, park.lng);
    setRouteCoords(coords);
    setShowRoute(true);
    setRouteLoading(false);
  }, [userLat, userLng]);

  // 팝업 내 경로 취소 핸들러
  const handleCancelRoute = useCallback(() => {
    setShowRoute(false);
    setRouteCoords([]);
    setRouteParkId(null);
  }, []);

  const handleSelectPark = useCallback((parkId: string) => {
    setSelectedParkId(parkId);
    const park = nearbyParks.find(p => p.id === parkId) ?? null;
    setSelectedPark(park);
  }, [nearbyParks]);

  const shareText = score
    ? `🌿 우리 동네 녹지 접근성 점수: ${score.score}점 (${score.grade}등급)\n가장 가까운 공원: ${score.nearestPark.name} (도보 ${score.walkingTime}분)\n\n#GreenReach #그린리치 #녹지접근성`
    : '';

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareText + '\n\nhttps://greenreach.kr').then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleShareTwitter = () => {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`, '_blank');
  };

  const scoreColor = score ? getScoreColor(score.score) : '#16a34a';
  const visibleParks = nearbyParks;

  // ─── 공통 패널 내용 ──────────────────────────────────────────────────────
  const PanelContent = () => (
    <>
      {/* 백엔드 상태 배지 */}
      <div className="px-4 pt-3 pb-0">
        <div className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-full w-fit ${
          backendOnline === null ? 'bg-gray-100 text-gray-500' :
          backendOnline ? 'bg-green-50 text-green-700 border border-green-200' :
          'bg-red-50 text-red-600 border border-red-200'
        }`}>
          <Database className="w-3 h-3" />
          {backendOnline === null ? '서버 확인 중...' :
           backendOnline ? '공공데이터 연결됨 (전국 공원 16,999개)' :
           '서버 오프라인'}
        </div>
      </div>

      {/* 위치 버튼 */}
      <div className="p-4 border-b border-gray-100 space-y-2">
        <div className="flex gap-2">
          <button
            onClick={getMyLocation}
            disabled={locationLoading || apiLoading}
            className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 active:bg-green-800 disabled:bg-green-400 text-white font-semibold py-3 px-3 rounded-xl transition-colors text-sm"
          >
            {locationLoading || apiLoading
              ? <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
              : <Navigation className="w-4 h-4 flex-shrink-0" />}
            <span className="truncate">
              {locationLoading ? '위치 확인 중...' : apiLoading ? '분석 중...' : 'GPS 위치 분석'}
            </span>
          </button>
        </div>
        {locationError && <p className="text-xs text-orange-600 text-center">{locationError}</p>}
        {apiError && <p className="text-xs text-red-600 text-center">{apiError}</p>}
        <p className="text-xs text-gray-400 text-center">
          📍 {userLat.toFixed(4)}, {userLng.toFixed(4)}
        </p>
      </div>

      {/* 선택된 공원 정보 카드 */}
      {selectedPark && (
        <div className="mx-4 mt-4 mb-0 bg-red-50 border border-red-200 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-red-700">
              <span>📍</span>
              선택된 공원
            </div>
            <button
              onClick={() => { setSelectedParkId(null); setSelectedPark(null); setShowRoute(false); setRouteCoords([]); }}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              ✕ 해제
            </button>
          </div>
          <div className="font-bold text-sm text-gray-800 truncate mb-0.5">{selectedPark.name}</div>
          <div className="text-xs text-gray-500 mb-2">{selectedPark.type} · {selectedPark.district}</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white rounded-lg p-2">
              <div className="text-xs text-gray-500 mb-0.5">도보 거리</div>
              <div className="font-semibold text-sm text-red-700">
                {(selectedPark.walkingDistance ?? 0) >= 1000
                  ? `${((selectedPark.walkingDistance ?? 0) / 1000).toFixed(1)}km`
                  : `${selectedPark.walkingDistance ?? 0}m`}
              </div>
            </div>
            <div className="bg-white rounded-lg p-2">
              <div className="text-xs text-gray-500 mb-0.5">도보 시간</div>
              <div className="font-semibold text-sm text-red-700">약 {selectedPark.walkingTime ?? 0}분</div>
            </div>
            {selectedPark.area > 0 && (
              <div className="bg-white rounded-lg p-2">
                <div className="text-xs text-gray-500 mb-0.5">면적</div>
                <div className="font-semibold text-sm text-gray-700">{(selectedPark.area / 10000).toFixed(1)}ha</div>
              </div>
            )}
            <div className="bg-white rounded-lg p-2">
              <div className="text-xs text-gray-500 mb-0.5">편의시설</div>
              <div className="font-semibold text-sm text-gray-700">{selectedPark.facilities.length}개</div>
            </div>
          </div>
          {selectedPark.facilities.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {selectedPark.facilities.slice(0, 4).map(f => (
                <span key={f} className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">{f}</span>
              ))}
              {selectedPark.facilities.length > 4 && (
                <span className="text-xs text-gray-400">+{selectedPark.facilities.length - 4}개</span>
              )}
            </div>
          )}
          <button
            onClick={() => handleShowRoutePark(selectedPark)}
            disabled={routeLoading}
            className={`mt-2 w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
              routeParkId === selectedPark.id && showRoute
                ? 'bg-blue-600 text-white'
                : 'bg-white text-blue-700 border border-blue-200 hover:bg-blue-50'
            }`}
          >
            {routeLoading && routeParkId === selectedPark.id
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> 경로 계산 중...</>
              : routeParkId === selectedPark.id && showRoute
                ? <><Route className="w-3.5 h-3.5" /> 경로 표시 중</>
                : <><Route className="w-3.5 h-3.5" /> 이 공원까지 경로 보기</>
            }
          </button>
        </div>
      )}

      {/* 접근성 점수 카드 */}
      {score && !score.error && (
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-800 mb-3 flex items-center gap-2 text-sm">
            <Star className="w-4 h-4 text-yellow-500" />
            녹지 접근성 점수
            <span className="text-xs text-gray-400 font-normal ml-auto">공공데이터 기반</span>
          </h2>

          <div className="flex items-center gap-4 mb-4">
            <div
              className="w-18 h-18 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg"
              style={{
                width: 72, height: 72,
                background: `conic-gradient(${scoreColor} ${score.score * 3.6}deg, #e5e7eb 0deg)`
              }}
            >
              <div className="rounded-full flex flex-col items-center justify-center" style={{ width: 58, height: 58, background: scoreColor }}>
                <span className="text-xl font-bold text-white leading-none">{score.score}</span>
                <span className="text-xs text-white opacity-80">/ 100</span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-2xl font-bold" style={{ color: scoreColor }}>{score.grade}등급</div>
              <div className="text-xs text-gray-600 mt-0.5">{getGradeDescription(score.grade)}</div>
              <div className="text-xs text-gray-500 mt-1 truncate">
                📍 {score.nearestPark.name} · 도보 {score.walkingTime}분
              </div>
            </div>
          </div>

          {/* 점수 바 */}
          <div className="bg-gray-50 rounded-xl p-3 mb-3 space-y-1.5">
            {[
              { label: '거리', value: score.distScore, max: 50, color: '#16a34a' },
              { label: '밀도', value: score.densityScore, max: 30, color: '#2563eb' },
              { label: '면적', value: score.areaScore, max: 20, color: '#d97706' },
            ].map(({ label, value, max, color }) => (
              <div key={label} className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-8 flex-shrink-0">{label}</span>
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${(value / max) * 100}%`, background: color }} />
                </div>
                <span className="text-xs font-semibold text-gray-700 w-10 text-right">{value}/{max}</span>
              </div>
            ))}
          </div>

          {/* 통계 그리드 */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="bg-gray-50 rounded-lg p-2.5">
              <div className="text-xs text-gray-500 mb-0.5">가장 가까운 공원</div>
              <div className="font-semibold text-sm text-gray-800 truncate">{score.nearestPark.name}</div>
              <div className="text-xs text-gray-500">{score.nearestPark.type}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-2.5">
              <div className="text-xs text-gray-500 mb-0.5">도보 거리</div>
              <div className="font-semibold text-sm text-gray-800">
                {score.walkingDistance >= 1000
                  ? `${(score.walkingDistance / 1000).toFixed(1)}km`
                  : `${score.walkingDistance}m`}
              </div>
              <div className="text-xs text-gray-500">약 {score.walkingTime}분</div>
            </div>
            <div className="bg-green-50 rounded-lg p-2.5">
              <div className="text-xs text-gray-500 mb-0.5">500m 내 공원</div>
              <div className="font-semibold text-sm text-green-700">{score.parkCount500m}개</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-2.5">
              <div className="text-xs text-gray-500 mb-0.5">1km 내 공원</div>
              <div className="font-semibold text-sm text-blue-700">{score.parkCount1km}개</div>
            </div>
          </div>

          {/* 경사도 정보 */}
          {score.slopePenalty !== undefined && score.slopePenalty > 1.0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 mb-3">
              <div className="text-xs font-semibold text-orange-700 mb-1.5">⛰️ 경사도 분석</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-500">경사 패널티</span>
                  <div className="font-semibold text-orange-700">×{score.slopePenalty.toFixed(1)}</div>
                </div>
                <div>
                  <span className="text-gray-500">경사 반영 시간</span>
                  <div className="font-semibold text-orange-700">{score.slopeAdjustedTime}분</div>
                </div>
                {(score.elevationGain ?? 0) > 0 && (
                  <div><span className="text-gray-500">오르막</span><div className="font-semibold text-red-600">↑{score.elevationGain}m</div></div>
                )}
                {(score.elevationLoss ?? 0) > 0 && (
                  <div><span className="text-gray-500">내리막</span><div className="font-semibold text-blue-600">↓{score.elevationLoss}m</div></div>
                )}
              </div>
              <div className="text-xs text-orange-600 mt-1.5">⚠️ 언덕이 있어 실제 보행 시간이 더 걸립니다</div>
            </div>
          )}

          {/* 액션 버튼 */}
          <div className="flex gap-2">
            <button
              onClick={handleShowRoute}
              disabled={routeLoading}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                showRoute ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
              }`}
            >
              {routeLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Route className="w-3.5 h-3.5" />}
              {routeLoading ? '계산 중...' : showRoute ? '경로 표시 중' : '도보 경로'}
            </button>
            <button
              onClick={() => setShowShare(!showShare)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" />
              공유하기
            </button>
          </div>

          {showShare && (
            <div className="mt-2 bg-gray-50 rounded-xl p-3 space-y-2">
              <p className="text-xs text-gray-600 whitespace-pre-line leading-relaxed">{shareText}</p>
              <div className="flex gap-2">
                <button onClick={handleCopyLink} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-gray-200 hover:bg-gray-300 text-gray-700 transition-colors">
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? '복사됨!' : '복사'}
                </button>
                <button onClick={handleShareTwitter} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-sky-500 hover:bg-sky-600 text-white transition-colors">
                  <Share2 className="w-3 h-3" />
                  트위터
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 필터 */}
      <div className="p-4 border-b border-gray-100">
        <button
          onClick={() => setShowFilter(!showFilter)}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-green-700 w-full"
        >
          <Filter className="w-4 h-4" />
          맞춤 공원 필터
          {showFilter ? <ChevronUp className="w-4 h-4 ml-auto" /> : <ChevronDown className="w-4 h-4 ml-auto" />}
        </button>
        {showFilter && (
          <div className="mt-3 space-y-3">
            {[
              { key: 'childFriendly', label: '👶 아이 동반 가능' },
              { key: 'petFriendly', label: '🐕 반려동물 동반 가능' },
              { key: 'accessible', label: '♿ 장애인 접근 가능' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filter[key as keyof RecommendationFilter] as boolean}
                  onChange={(e) => setFilter({ ...filter, [key]: e.target.checked })}
                  className="rounded text-green-600 w-4 h-4"
                />
                {label}
              </label>
            ))}
            <div>
              <label className="text-sm text-gray-700">최대 거리: {filter.maxDistance}m</label>
              <input
                type="range" min={500} max={5000} step={500}
                value={filter.maxDistance}
                onChange={(e) => setFilter({ ...filter, maxDistance: Number(e.target.value) })}
                className="w-full mt-1 accent-green-600"
              />
            </div>
          </div>
        )}
      </div>

      {/* 주변 공원 목록 */}
      <div className="p-4">
        <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2 text-sm">
          <TreePine className="w-4 h-4 text-green-600" />
          주변 공원 목록
          <span className="text-xs text-gray-400 font-normal ml-auto">{nearbyParks.length}개</span>
        </h3>

        {apiLoading ? (
          <div className="flex items-center justify-center py-8 gap-2 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">공공데이터 불러오는 중...</span>
          </div>
        ) : (
          <div className="space-y-2">
            {nearbyParks.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                {apiError ? '서버 연결 오류' : '조건에 맞는 공원이 없습니다'}
              </p>
            ) : (
              nearbyParks.map((park) => (
                <div
                  key={park.id}
                  className={`rounded-lg p-3 cursor-pointer transition-colors border ${
                    selectedParkId === park.id
                      ? 'bg-red-50 border-red-300'
                      : 'bg-gray-50 hover:bg-green-50 active:bg-green-100 border-transparent hover:border-green-200'
                  }`}
                  onClick={() => {
                    setSelectedParkId(park.id);
                    setSelectedPark(park);
                    if (mapRef.current) {
                      mapRef.current.flyTo([park.lat, park.lng], 17, { animate: true, duration: 0.8 });
                    }
                    setMobileTab('map');
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-gray-800 truncate">{park.name}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{park.type} · {park.district}</div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {park.childFriendly && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">👶</span>}
                        {park.petFriendly && <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">🐕</span>}
                        {park.accessible && <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">♿</span>}
                        {park.facilities.slice(0, 2).map(f => (
                          <span key={f} className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">{f}</span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-semibold text-green-700">
                        {(park.walkingDistance ?? 0) >= 1000
                          ? `${((park.walkingDistance ?? 0) / 1000).toFixed(1)}km`
                          : `${park.walkingDistance ?? 0}m`}
                      </div>
                      <div className="text-xs text-gray-500 flex items-center gap-1 justify-end">
                        <Clock className="w-3 h-3" />{park.walkingTime ?? 0}분
                      </div>
                      {park.area > 0 && (
                        <div className="text-xs text-gray-400">{(park.area / 10000).toFixed(1)}ha</div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-400 space-y-0.5">
          <p className="font-medium text-gray-500">📊 데이터 출처</p>
          <p>· 공원: 공공데이터포털 (data.go.kr)</p>
          <p>· 지도: VWorld (LX한국국토정보공사)</p>
          <p>· 경로: OSRM (project-osrm.org)</p>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* ══════════════════════════════════════════════════════════════════════
          데스크탑 레이아웃 (lg 이상)
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="hidden lg:flex h-[calc(100vh-64px)]">
        {/* 사이드패널 */}
        <div className="w-96 bg-white border-r border-gray-200 overflow-y-auto flex-shrink-0">
          <PanelContent />
        </div>

        {/* 지도 */}
        <div className="flex-1 relative">
          {/* 힌트 배너 */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-white/90 backdrop-blur-sm text-gray-700 text-xs font-medium px-4 py-2 rounded-full shadow-md flex items-center gap-1.5 pointer-events-none">
            <MapPin className="w-3.5 h-3.5 text-green-600" />
            GPS 버튼을 눌러 내 위치를 분석하거나, 공원 마커를 클릭하세요
          </div>
          <MapComponent
            userLat={userLat}
            userLng={userLng}
            score={score}
            visibleParks={visibleParks}
            selectedParkId={selectedParkId}
            routeParkId={routeParkId}
            routeLoading={routeLoading}
            showRoute={showRoute}
            routeCoords={routeCoords}
            mapRef={mapRef}
            onMapClick={handleMapClick}
            onSelectPark={handleSelectPark}
            onShowRoute={handleShowRoutePark}
            onCancelRoute={handleCancelRoute}
          />
          {/* 범례 */}
          <div className="absolute bottom-4 right-4 bg-white rounded-xl shadow-lg p-3 text-xs space-y-1.5 z-[1000]">
            <div className="font-semibold text-gray-700 mb-1">범례</div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-600 border-2 border-white shadow" /><span className="text-gray-600">내 위치</span></div>
            <div className="flex items-center gap-2"><span>🌳</span><span className="text-gray-600">공원</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500 border-2 border-white shadow" /><span className="text-gray-600">선택된 공원</span></div>
            <div className="flex items-center gap-2"><div className="w-6 h-1 bg-blue-600 rounded" /><span className="text-gray-600">도보 경로</span></div>
            <div className="flex items-center gap-2"><div className="w-6 h-0.5 border-t-2 border-dashed border-green-600" /><span className="text-gray-600">500m / 1km</span></div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          모바일 레이아웃 (lg 미만)
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="lg:hidden flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>

        {/* 모바일 탭 바 */}
        <div className="flex bg-white border-b border-gray-200 flex-shrink-0">
          <button
            onClick={() => setMobileTab('map')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors ${
              mobileTab === 'map' ? 'text-green-700 border-b-2 border-green-600' : 'text-gray-500'
            }`}
          >
            <Map className="w-4 h-4" />
            지도
          </button>
          <button
            onClick={() => setMobileTab('info')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors relative ${
              mobileTab === 'info' ? 'text-green-700 border-b-2 border-green-600' : 'text-gray-500'
            }`}
          >
            <Star className="w-4 h-4" />
            분석 결과
            {score && (
              <span
                className="absolute top-2 right-6 w-5 h-5 rounded-full text-xs font-bold text-white flex items-center justify-center"
                style={{ background: scoreColor }}
              >
                {score.grade}
              </span>
            )}
          </button>
        </div>

        {/* 모바일 지도 탭 */}
        {mobileTab === 'map' && (
          <div className="flex-1 relative overflow-hidden">
            {/* 모바일 힌트 배너 */}
            {!apiLoading && (
              <div className="absolute top-3 left-3 right-16 z-[1000] bg-white/90 backdrop-blur-sm text-gray-600 text-xs font-medium px-3 py-1.5 rounded-full shadow-md flex items-center gap-1.5 pointer-events-none">
                <MapPin className="w-3 h-3 text-green-600 flex-shrink-0" />
                <span className="truncate">GPS 버튼으로 내 위치 분석 · 공원 마커를 탭하세요</span>
              </div>
            )}

            {/* 지도 위 플로팅 버튼 */}
            <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2">
              <button
                onClick={getMyLocation}
                disabled={locationLoading || apiLoading}
                className="w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center border border-gray-200 active:bg-gray-50 disabled:opacity-60"
              >
                {locationLoading || apiLoading
                  ? <Loader2 className="w-5 h-5 text-green-600 animate-spin" />
                  : <Navigation className="w-5 h-5 text-green-600" />}
              </button>
              {score && (
                <button
                  onClick={handleShowRoute}
                  disabled={routeLoading}
                  className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center border ${
                    showRoute ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-200 active:bg-gray-50'
                  }`}
                >
                  {routeLoading
                    ? <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                    : <Route className={`w-5 h-5 ${showRoute ? 'text-white' : 'text-blue-600'}`} />}
                </button>
              )}
            </div>

            {/* 지도 */}
            <MapComponent
              userLat={userLat}
              userLng={userLng}
              score={score}
              visibleParks={visibleParks}
              selectedParkId={selectedParkId}
              routeParkId={routeParkId}
              routeLoading={routeLoading}
              showRoute={showRoute}
              routeCoords={routeCoords}
              mapRef={mapRef}
              onMapClick={handleMapClick}
              onSelectPark={handleSelectPark}
              onShowRoute={handleShowRoutePark}
              onCancelRoute={handleCancelRoute}
            />

            {/* 하단 미니 점수 카드 (지도 위 오버레이) */}
            {score && !apiLoading && (
              <div
                className="absolute bottom-4 left-3 right-16 z-[1000] bg-white rounded-2xl shadow-xl p-3 flex items-center gap-3 cursor-pointer active:bg-gray-50"
                onClick={() => setMobileTab('info')}
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 shadow"
                  style={{ background: `conic-gradient(${scoreColor} ${score.score * 3.6}deg, #e5e7eb 0deg)` }}
                >
                  <div className="w-9 h-9 rounded-full flex flex-col items-center justify-center" style={{ background: scoreColor }}>
                    <span className="text-sm font-bold text-white leading-none">{score.score}</span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-gray-800">{score.grade}등급 · {score.score}점</div>
                  <div className="text-xs text-gray-500 truncate">📍 {score.nearestPark.name} · 도보 {score.walkingTime}분</div>
                  <div className="text-xs text-green-600 font-medium mt-0.5">탭하여 상세 보기 →</div>
                </div>
              </div>
            )}

            {/* 로딩 오버레이 */}
            {apiLoading && (
              <div className="absolute bottom-4 left-3 right-3 z-[1000] bg-white rounded-2xl shadow-xl p-3 flex items-center gap-3">
                <Loader2 className="w-6 h-6 text-green-600 animate-spin flex-shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-gray-800">분석 중...</div>
                  <div className="text-xs text-gray-500">OSRM 보행 경로 + 경사도 계산</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 모바일 정보 탭 */}
        {mobileTab === 'info' && (
          <div className="flex-1 overflow-y-auto bg-white">
            <PanelContent />
          </div>
        )}
      </div>
    </>
  );
}
