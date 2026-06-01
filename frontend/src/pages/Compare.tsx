import { useState, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { ArrowLeftRight, TrendingUp, TrendingDown, Minus, MapPin, Loader2, Navigation, RotateCcw, Search } from 'lucide-react';
import { getScoreColor } from '../utils/accessibility';

const VWORLD_KEY = '4B826FAE-56F2-32CB-829B-2CD7F7DFF7E7';
const API_BASE = import.meta.env.VITE_API_BASE
  || (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? 'https://greenreach-api.onrender.com'
    : 'http://localhost:8000');

// ─── 타입 ─────────────────────────────────────────────────────────────────────
interface AccessibilityResult {
  score: number;
  grade: string;
  nearestPark: { name: string; type: string; area: number };
  walkingDistance: number;
  walkingTime: number;
  slopePenalty?: number;
  slopeAdjustedTime?: number;
  parkCount500m: number;
  parkCount1km: number;
  distScore: number;
  densityScore: number;
  areaScore: number;
  error?: string;
}

interface LocationPoint {
  lat: number;
  lng: number;
  label: string;
}

// ─── 지도 클릭 핸들러 ─────────────────────────────────────────────────────────
function MapClickHandler({
  onMapClick, enabled
}: {
  onMapClick: (lat: number, lng: number) => void;
  enabled: boolean;
}) {
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

// ─── 마커 아이콘 ──────────────────────────────────────────────────────────────
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const iconA = L.divIcon({
  html: `<div style="background:#16a34a;width:32px;height:32px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(22,163,74,0.5);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:bold;color:white">A</div>`,
  className: '', iconSize: [32, 32], iconAnchor: [16, 16],
});
const iconB = L.divIcon({
  html: `<div style="background:#2563eb;width:32px;height:32px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(37,99,235,0.5);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:bold;color:white">B</div>`,
  className: '', iconSize: [32, 32], iconAnchor: [16, 16],
});

// ─── 비교 아이콘 ──────────────────────────────────────────────────────────────
function CompareIcon({ a, b, higherIsBetter }: { a: number; b: number; higherIsBetter: boolean }) {
  if (a === b) return <Minus className="w-4 h-4 text-gray-400" />;
  const aWins = higherIsBetter ? a > b : a < b;
  if (aWins) return <TrendingUp className="w-4 h-4 text-green-600" />;
  return <TrendingDown className="w-4 h-4 text-red-500" />;
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────
export default function Compare() {
  const [selectMode, setSelectMode] = useState<'A' | 'B' | null>('A');
  const [locA, setLocA] = useState<LocationPoint | null>(null);
  const [locB, setLocB] = useState<LocationPoint | null>(null);
  const [scoreA, setScoreA] = useState<AccessibilityResult | null>(null);
  const [scoreB, setScoreB] = useState<AccessibilityResult | null>(null);
  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);
  const [mapCenter] = useState<[number, number]>([37.5665, 126.9780]);

  // 주소 검색 상태
  const [addrA, setAddrA] = useState('');
  const [addrB, setAddrB] = useState('');
  const [addrLoadingA, setAddrLoadingA] = useState(false);
  const [addrLoadingB, setAddrLoadingB] = useState(false);
  const [addrErrorA, setAddrErrorA] = useState('');
  const [addrErrorB, setAddrErrorB] = useState('');
  const inputARef = useRef<HTMLInputElement>(null);
  const inputBRef = useRef<HTMLInputElement>(null);

  const fetchScore = useCallback(async (lat: number, lng: number, which: 'A' | 'B') => {
    const setLoading = which === 'A' ? setLoadingA : setLoadingB;
    const setScore = which === 'A' ? setScoreA : setScoreB;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/accessibility/osm?lat=${lat}&lng=${lng}`);
      const data = await res.json();
      setScore(data);
    } catch {
      setScore(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // 주소 → 좌표 변환 (Nominatim)
  const handleAddressSearch = useCallback(async (which: 'A' | 'B') => {
    const addr = which === 'A' ? addrA : addrB;
    if (!addr.trim()) return;

    const setAddrLoading = which === 'A' ? setAddrLoadingA : setAddrLoadingB;
    const setAddrError = which === 'A' ? setAddrErrorA : setAddrErrorB;

    setAddrLoading(true);
    setAddrError('');

    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addr)}&format=json&countrycodes=kr&limit=1&accept-language=ko`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'GreenReach/1.0 (greenreach.kr)' }
      });
      const data = await res.json();

      if (!data || data.length === 0) {
        setAddrError('주소를 찾을 수 없습니다. 더 구체적으로 입력해보세요.');
        return;
      }

      const { lat, lon, display_name } = data[0];
      const parsedLat = parseFloat(lat);
      const parsedLng = parseFloat(lon);
      // 표시명 축약 (앞 3개 토큰)
      const shortName = display_name.split(',').slice(0, 3).join(', ').trim();

      if (which === 'A') {
        setLocA({ lat: parsedLat, lng: parsedLng, label: shortName });
        fetchScore(parsedLat, parsedLng, 'A');
        setSelectMode('B');
      } else {
        setLocB({ lat: parsedLat, lng: parsedLng, label: shortName });
        fetchScore(parsedLat, parsedLng, 'B');
        setSelectMode(null);
      }
    } catch {
      setAddrError('검색 중 오류가 발생했습니다.');
    } finally {
      setAddrLoading(false);
    }
  }, [addrA, addrB, fetchScore]);

  const handleMapClick = (lat: number, lng: number) => {
    if (!selectMode) return;
    const label = selectMode === 'A'
      ? `위치 A (${lat.toFixed(4)}, ${lng.toFixed(4)})`
      : `위치 B (${lat.toFixed(4)}, ${lng.toFixed(4)})`;

    if (selectMode === 'A') {
      setLocA({ lat, lng, label });
      fetchScore(lat, lng, 'A');
      setSelectMode('B');
    } else {
      setLocB({ lat, lng, label });
      fetchScore(lat, lng, 'B');
      setSelectMode(null);
    }
  };

  const handleGetMyLocation = (which: 'A' | 'B') => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude: lat, longitude: lng } = pos.coords;
      const label = `내 위치 (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
      if (which === 'A') {
        setLocA({ lat, lng, label });
        fetchScore(lat, lng, 'A');
      } else {
        setLocB({ lat, lng, label });
        fetchScore(lat, lng, 'B');
      }
    });
  };

  const handleReset = () => {
    setLocA(null);
    setLocB(null);
    setScoreA(null);
    setScoreB(null);
    setSelectMode('A');
    setAddrA('');
    setAddrB('');
    setAddrErrorA('');
    setAddrErrorB('');
  };

  const colorA = scoreA ? getScoreColor(scoreA.score) : '#16a34a';
  const colorB = scoreB ? getScoreColor(scoreB.score) : '#2563eb';

  const compareItems = scoreA && scoreB ? [
    { label: '녹지 접근성 점수', a: scoreA.score, b: scoreB.score, unit: '점', higherIsBetter: true },
    { label: '도보 거리', a: scoreA.walkingDistance, b: scoreB.walkingDistance, unit: 'm', higherIsBetter: false },
    { label: '도보 시간', a: scoreA.walkingTime, b: scoreB.walkingTime, unit: '분', higherIsBetter: false },
    { label: '500m 내 공원', a: scoreA.parkCount500m, b: scoreB.parkCount500m, unit: '개', higherIsBetter: true },
    { label: '1km 내 공원', a: scoreA.parkCount1km, b: scoreB.parkCount1km, unit: '개', higherIsBetter: true },
    { label: '거리 점수', a: scoreA.distScore, b: scoreB.distScore, unit: '점', higherIsBetter: true },
    { label: '밀도 점수', a: scoreA.densityScore, b: scoreB.densityScore, unit: '점', higherIsBetter: true },
    { label: '면적 점수', a: scoreA.areaScore, b: scoreB.areaScore, unit: '점', higherIsBetter: true },
  ] : [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">동네 녹지 환경 비교</h1>
        <p className="text-gray-500 text-sm">두 위치의 실제 녹지 접근성을 비교하세요 (이사 전 동네 비교에 활용)</p>
      </div>

      {/* 주소 입력 영역 */}
      <div className="mb-4 grid sm:grid-cols-2 gap-3">
        {/* 위치 A 주소 입력 */}
        <div className="bg-green-50 border border-green-200 rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <div style={{ background: '#16a34a', color: 'white', width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 'bold', flexShrink: 0 }}>A</div>
            <span className="text-xs font-semibold text-green-800">위치 A 주소 입력</span>
          </div>
          <div className="flex gap-1.5">
            <input
              ref={inputARef}
              type="text"
              value={addrA}
              onChange={(e) => { setAddrA(e.target.value); setAddrErrorA(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleAddressSearch('A')}
              placeholder="예: 서울시 마포구 합정동"
              className="flex-1 text-xs px-3 py-2 rounded-lg border border-green-300 bg-white focus:outline-none focus:ring-2 focus:ring-green-400 placeholder-gray-400"
            />
            <button
              onClick={() => handleAddressSearch('A')}
              disabled={addrLoadingA || !addrA.trim()}
              className="flex items-center gap-1 px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white text-xs font-semibold transition-colors flex-shrink-0"
            >
              {addrLoadingA ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              검색
            </button>
          </div>
          {addrErrorA && <p className="text-xs text-red-600 mt-1.5">{addrErrorA}</p>}
          {locA && !addrErrorA && (
            <p className="text-xs text-green-700 mt-1.5 truncate">✅ {locA.label}</p>
          )}
        </div>

        {/* 위치 B 주소 입력 */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <div style={{ background: '#2563eb', color: 'white', width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 'bold', flexShrink: 0 }}>B</div>
            <span className="text-xs font-semibold text-blue-800">위치 B 주소 입력</span>
          </div>
          <div className="flex gap-1.5">
            <input
              ref={inputBRef}
              type="text"
              value={addrB}
              onChange={(e) => { setAddrB(e.target.value); setAddrErrorB(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleAddressSearch('B')}
              placeholder="예: 경기도 성남시 분당구"
              className="flex-1 text-xs px-3 py-2 rounded-lg border border-blue-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder-gray-400"
            />
            <button
              onClick={() => handleAddressSearch('B')}
              disabled={addrLoadingB || !addrB.trim()}
              className="flex items-center gap-1 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-xs font-semibold transition-colors flex-shrink-0"
            >
              {addrLoadingB ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              검색
            </button>
          </div>
          {addrErrorB && <p className="text-xs text-red-600 mt-1.5">{addrErrorB}</p>}
          {locB && !addrErrorB && (
            <p className="text-xs text-blue-700 mt-1.5 truncate">✅ {locB.label}</p>
          )}
        </div>
      </div>

      {/* 선택 안내 배너 */}
      {selectMode && (
        <div className={`mb-4 px-4 py-3 rounded-xl flex items-center gap-3 text-sm font-semibold ${
          selectMode === 'A'
            ? 'bg-green-50 border border-green-200 text-green-800'
            : 'bg-blue-50 border border-blue-200 text-blue-800'
        }`}>
          <MapPin className="w-4 h-4 flex-shrink-0" />
          {selectMode === 'A'
            ? '📍 주소를 입력하거나 지도에서 위치 A를 클릭하세요'
            : '📍 주소를 입력하거나 지도에서 위치 B를 클릭하세요'}
          <button
            onClick={handleReset}
            className="ml-auto flex items-center gap-1 text-xs font-medium opacity-70 hover:opacity-100"
          >
            <RotateCcw className="w-3 h-3" /> 초기화
          </button>
        </div>
      )}

      <div className="grid lg:grid-cols-5 gap-4">
        {/* 지도 (3/5) */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* 위치 선택 버튼 */}
            <div className="p-3 border-b border-gray-100 flex gap-2 flex-wrap">
              <button
                onClick={() => setSelectMode('A')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  selectMode === 'A'
                    ? 'bg-green-600 text-white'
                    : locA ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-gray-100 text-gray-600 hover:bg-green-50'
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-current opacity-80 flex items-center justify-center text-white text-xs font-bold" style={{ background: '#16a34a', color: 'white', fontSize: 9 }}>A</div>
                {locA
                  ? `A: ${locA.label.length > 12 ? locA.label.slice(0, 12) + '…' : locA.label}`
                  : '위치 A 선택'}
              </button>
              <button
                onClick={() => setSelectMode('B')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  selectMode === 'B'
                    ? 'bg-blue-600 text-white'
                    : locB ? 'bg-blue-100 text-blue-700 border border-blue-300' : 'bg-gray-100 text-gray-600 hover:bg-blue-50'
                }`}
              >
                <div style={{ background: '#2563eb', color: 'white', fontSize: 9, width: 16, height: 16, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>B</div>
                {locB
                  ? `B: ${locB.label.length > 12 ? locB.label.slice(0, 12) + '…' : locB.label}`
                  : '위치 B 선택'}
              </button>
              <button
                onClick={() => handleGetMyLocation(selectMode ?? 'A')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors ml-auto"
              >
                <Navigation className="w-3.5 h-3.5" />
                내 위치로 {selectMode ?? 'A'} 설정
              </button>
              {(locA || locB) && (
                <button onClick={handleReset} className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
                  <RotateCcw className="w-3 h-3" /> 초기화
                </button>
              )}
            </div>

            {/* 지도 */}
            <div style={{ height: 400 }}>
              <MapContainer
                center={mapCenter}
                zoom={12}
                style={{ width: '100%', height: '100%', cursor: selectMode ? 'crosshair' : 'grab' }}
              >
                <TileLayer
                  attribution='&copy; VWorld'
                  url={`https://api.vworld.kr/req/wmts/1.0.0/${VWORLD_KEY}/Base/{z}/{y}/{x}.png`}
                  maxZoom={19}
                />
                <MapClickHandler onMapClick={handleMapClick} enabled={!!selectMode} />
                {locA && (
                  <Marker position={[locA.lat, locA.lng]} icon={iconA}>
                    <Popup>
                      <div className="text-sm font-bold text-green-700">📍 위치 A</div>
                      <div className="text-xs text-gray-600 mt-0.5">{locA.label}</div>
                      <div className="text-xs text-gray-400">{locA.lat.toFixed(5)}, {locA.lng.toFixed(5)}</div>
                      {scoreA && <div className="text-xs font-semibold mt-1" style={{ color: colorA }}>점수: {scoreA.score}점 ({scoreA.grade}등급)</div>}
                    </Popup>
                  </Marker>
                )}
                {locB && (
                  <Marker position={[locB.lat, locB.lng]} icon={iconB}>
                    <Popup>
                      <div className="text-sm font-bold text-blue-700">📍 위치 B</div>
                      <div className="text-xs text-gray-600 mt-0.5">{locB.label}</div>
                      <div className="text-xs text-gray-400">{locB.lat.toFixed(5)}, {locB.lng.toFixed(5)}</div>
                      {scoreB && <div className="text-xs font-semibold mt-1" style={{ color: colorB }}>점수: {scoreB.score}점 ({scoreB.grade}등급)</div>}
                    </Popup>
                  </Marker>
                )}
              </MapContainer>
            </div>
          </div>

          {/* 사용 안내 */}
          {!locA && !locB && (
            <div className="mt-3 bg-gray-50 rounded-xl p-4 text-sm text-gray-600">
              <p className="font-semibold text-gray-700 mb-2">📌 사용 방법</p>
              <ol className="space-y-1 text-xs list-decimal list-inside">
                <li><strong className="text-green-700">위치 A</strong> 주소 입력 후 검색 (또는 지도 클릭)</li>
                <li><strong className="text-blue-700">위치 B</strong> 주소 입력 후 검색 (또는 지도 클릭)</li>
                <li>두 위치의 실제 녹지 접근성 점수를 비교</li>
              </ol>
              <p className="text-xs text-gray-400 mt-2">💡 "내 위치로 설정" 버튼으로 현재 위치를 자동 입력할 수 있습니다</p>
            </div>
          )}
        </div>

        {/* 결과 패널 (2/5) */}
        <div className="lg:col-span-2 space-y-4">
          {/* 점수 카드 A */}
          <div className={`bg-white rounded-2xl shadow-sm border p-5 ${locA ? 'border-green-200' : 'border-gray-100'}`}>
            <div className="flex items-center gap-2 mb-3">
              <div style={{ background: '#16a34a', color: 'white', width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 'bold', flexShrink: 0 }}>A</div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-gray-800 text-sm truncate">
                  {locA ? locA.label : '위치 A 미선택'}
                </div>
                {locA && <div className="text-xs text-gray-400">{locA.lat.toFixed(4)}, {locA.lng.toFixed(4)}</div>}
              </div>
            </div>
            {loadingA ? (
              <div className="flex items-center gap-2 text-gray-400 py-4 justify-center">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">분석 중...</span>
              </div>
            ) : scoreA && !scoreA.error ? (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: `conic-gradient(${colorA} ${scoreA.score * 3.6}deg, #e5e7eb 0deg)` }}>
                    <div className="w-12 h-12 rounded-full flex flex-col items-center justify-center" style={{ background: colorA }}>
                      <span className="text-lg font-bold text-white leading-none">{scoreA.score}</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-xl font-bold" style={{ color: colorA }}>{scoreA.grade}등급</div>
                    <div className="text-xs text-gray-500 mt-0.5 truncate max-w-[140px]">📍 {scoreA.nearestPark.name}</div>
                    <div className="text-xs text-gray-500">도보 {scoreA.walkingTime}분 · {scoreA.walkingDistance}m</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  <div className="bg-green-50 rounded-lg p-2">
                    <div className="text-gray-500">500m 내</div>
                    <div className="font-bold text-green-700">{scoreA.parkCount500m}개</div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-2">
                    <div className="text-gray-500">1km 내</div>
                    <div className="font-bold text-blue-700">{scoreA.parkCount1km}개</div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-6 text-gray-400 text-sm">
                {locA ? '분석 실패' : '주소를 입력하거나 지도에서 위치 A를 선택하세요'}
              </div>
            )}
          </div>

          {/* VS 구분선 */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200" />
            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
              <ArrowLeftRight className="w-4 h-4 text-gray-500" />
            </div>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* 점수 카드 B */}
          <div className={`bg-white rounded-2xl shadow-sm border p-5 ${locB ? 'border-blue-200' : 'border-gray-100'}`}>
            <div className="flex items-center gap-2 mb-3">
              <div style={{ background: '#2563eb', color: 'white', width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 'bold', flexShrink: 0 }}>B</div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-gray-800 text-sm truncate">
                  {locB ? locB.label : '위치 B 미선택'}
                </div>
                {locB && <div className="text-xs text-gray-400">{locB.lat.toFixed(4)}, {locB.lng.toFixed(4)}</div>}
              </div>
            </div>
            {loadingB ? (
              <div className="flex items-center gap-2 text-gray-400 py-4 justify-center">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">분석 중...</span>
              </div>
            ) : scoreB && !scoreB.error ? (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: `conic-gradient(${colorB} ${scoreB.score * 3.6}deg, #e5e7eb 0deg)` }}>
                    <div className="w-12 h-12 rounded-full flex flex-col items-center justify-center" style={{ background: colorB }}>
                      <span className="text-lg font-bold text-white leading-none">{scoreB.score}</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-xl font-bold" style={{ color: colorB }}>{scoreB.grade}등급</div>
                    <div className="text-xs text-gray-500 mt-0.5 truncate max-w-[140px]">📍 {scoreB.nearestPark.name}</div>
                    <div className="text-xs text-gray-500">도보 {scoreB.walkingTime}분 · {scoreB.walkingDistance}m</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  <div className="bg-green-50 rounded-lg p-2">
                    <div className="text-gray-500">500m 내</div>
                    <div className="font-bold text-green-700">{scoreB.parkCount500m}개</div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-2">
                    <div className="text-gray-500">1km 내</div>
                    <div className="font-bold text-blue-700">{scoreB.parkCount1km}개</div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-6 text-gray-400 text-sm">
                {locB ? '분석 실패' : '주소를 입력하거나 지도에서 위치 B를 선택하세요'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 상세 비교 테이블 */}
      {scoreA && scoreB && !scoreA.error && !scoreB.error && (
        <div className="mt-6 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-gray-800">상세 지표 비교</h2>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-green-600" /><span>위치 A</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-blue-600" /><span>위치 B</span></div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">지표</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-green-700">위치 A</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400">비교</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-blue-700">위치 B</th>
                </tr>
              </thead>
              <tbody>
                {compareItems.map((item, i) => (
                  <tr key={item.label} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-700">{item.label}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-sm font-bold ${
                        item.higherIsBetter
                          ? item.a > item.b ? 'text-green-700' : item.a < item.b ? 'text-red-500' : 'text-gray-600'
                          : item.a < item.b ? 'text-green-700' : item.a > item.b ? 'text-red-500' : 'text-gray-600'
                      }`}>{item.a}{item.unit}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center">
                        <CompareIcon a={item.a} b={item.b} higherIsBetter={item.higherIsBetter} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-sm font-bold ${
                        item.higherIsBetter
                          ? item.b > item.a ? 'text-blue-700' : item.b < item.a ? 'text-red-500' : 'text-gray-600'
                          : item.b < item.a ? 'text-blue-700' : item.b > item.a ? 'text-red-500' : 'text-gray-600'
                      }`}>{item.b}{item.unit}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 결론 */}
          <div className="px-6 py-4 bg-gradient-to-r from-green-50 to-blue-50 border-t border-gray-100">
            <h3 className="font-bold text-gray-800 mb-2 text-sm">📊 분석 결론</h3>
            <p className="text-sm text-gray-700 leading-relaxed">
              {scoreA.score > scoreB.score ? (
                <>
                  <strong className="text-green-700">위치 A</strong>가 <strong className="text-blue-700">위치 B</strong>보다
                  녹지 접근성이 <strong>{scoreA.score - scoreB.score}점</strong> 높습니다.
                  {scoreA.parkCount500m > scoreB.parkCount500m
                    ? ` 500m 내 공원도 ${scoreA.parkCount500m - scoreB.parkCount500m}개 더 많아 전반적으로 녹지 환경이 우수합니다.`
                    : ` 단, 500m 내 공원 수는 비슷합니다.`}
                </>
              ) : scoreA.score < scoreB.score ? (
                <>
                  <strong className="text-blue-700">위치 B</strong>가 <strong className="text-green-700">위치 A</strong>보다
                  녹지 접근성이 <strong>{scoreB.score - scoreA.score}점</strong> 높습니다.
                  {scoreB.parkCount500m > scoreA.parkCount500m
                    ? ` 500m 내 공원도 ${scoreB.parkCount500m - scoreA.parkCount500m}개 더 많아 전반적으로 녹지 환경이 우수합니다.`
                    : ` 단, 500m 내 공원 수는 비슷합니다.`}
                </>
              ) : (
                '두 위치의 녹지 접근성 점수가 동일합니다. 세부 지표를 비교하여 선택하세요.'
              )}
            </p>
          </div>
        </div>
      )}

      {/* 데이터 출처 */}
      <div className="mt-4 text-xs text-gray-400 text-center">
        공공데이터포털 전국도시공원정보표준데이터 + OSRM 보행 네트워크 분석
      </div>
    </div>
  );
}
