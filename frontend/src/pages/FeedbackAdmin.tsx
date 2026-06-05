import { useState, useEffect, useCallback } from 'react';
import {
  Brain, ThumbsUp, ThumbsDown, RefreshCw, Lock, LogOut,
  BarChart2, MessageSquare, BookOpen, Loader2, AlertTriangle,
  CheckCircle, PlusCircle, Filter, ChevronLeft, ChevronRight,
  Wifi, WifiOff, Database, TreePine, MapPin,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? 'https://greenreach-api.onrender.com'
    : 'http://localhost:8000');

const ADMIN_PASSWORD =
  import.meta.env.VITE_ADMIN_PASSWORD || 'greenreach2026';

const SESSION_KEY = 'gr_admin_auth';

// ─── 의도 레이블 한글 매핑 ────────────────────────────────────────────────────
const INTENT_LABELS: Record<string, string> = {
  best_district: '🏆 최고 지역',
  worst_district: '⚠️ 취약 지역',
  stats_overview: '📊 전국 통계',
  top_parks: '🌳 공원 순위',
  ml_prediction: '🤖 AI 예측',
  similar_district: '🔍 유사 지역',
  district_detail: '📍 지역 상세',
  recommendation: '🏡 이사 추천',
  improvement: '🔧 개선 필요',
  unknown: '❓ 미분류',
};

const INTENT_COLORS: Record<string, string> = {
  best_district: '#16a34a',
  worst_district: '#dc2626',
  stats_overview: '#2563eb',
  top_parks: '#059669',
  ml_prediction: '#7c3aed',
  similar_district: '#0891b2',
  district_detail: '#d97706',
  recommendation: '#db2777',
  improvement: '#ea580c',
  unknown: '#9ca3af',
};

interface Feedback {
  id: number;
  question: string;
  answer: string;
  intent: string;
  confidence: number;
  rating: number;
  created_at: string;
}

interface FeedbackStats {
  total_feedbacks: number;
  positive: number;
  negative: number;
  corpus_size: number;
  intent_distribution: Record<string, number>;
  db_total?: number;
  db_positive?: number;
  db_negative?: number;
  db_intent_distribution?: Record<string, number>;
}

// ─── 비밀번호 게이트 ──────────────────────────────────────────────────────────
function PasswordGate({ onAuth }: { onAuth: () => void }) {
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      if (pw === ADMIN_PASSWORD) {
        sessionStorage.setItem(SESSION_KEY, '1');
        onAuth();
      } else {
        setError('비밀번호가 올바르지 않습니다.');
        setPw('');
      }
      setLoading(false);
    }, 400);
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mb-3">
            <Lock className="w-7 h-7 text-green-700" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">관리자 페이지</h1>
          <p className="text-sm text-gray-500 mt-1 text-center">
            AI 피드백 관리 · 모델 학습 제어
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              관리자 비밀번호
            </label>
            <input
              type="password"
              value={pw}
              onChange={(e) => { setPw(e.target.value); setError(''); }}
              placeholder="비밀번호 입력"
              autoFocus
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={!pw || loading}
            className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            {loading ? '확인 중...' : '입장'}
          </button>
        </form>

        <p className="text-xs text-gray-400 text-center mt-4">
          ※ 관리자 전용 페이지입니다
        </p>
      </div>
    </div>
  );
}

// ─── 시/도 목록 ───────────────────────────────────────────────────────────────
const SIDO_LIST = [
  '서울특별시', '부산광역시', '대구광역시', '인천광역시', '광주광역시',
  '대전광역시', '울산광역시', '세종특별자치시',
  '경기도', '강원특별자치도', '충청북도', '충청남도',
  '전북특별자치도', '전라남도', '경상북도', '경상남도', '제주특별자치도',
];

const RANK_COLORS = ['#16a34a', '#22c55e', '#4ade80', '#86efac', '#bbf7d0'];

interface RankDistrict {
  district: string;
  parkCount: number;
  totalArea: number;
  avgArea: number;
}

interface ParkMarker {
  id: string;
  name: string;
  type: string;
  address: string;
  lat: number;
  lng: number;
  area: number;
  score?: number;
  grade?: string;
  parkCount500m?: number;
  parkCount1km?: number;
}

const GRADE_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  A: { bg: 'bg-green-100', text: 'text-green-700', label: 'A' },
  B: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'B' },
  C: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'C' },
  D: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'D' },
  F: { bg: 'bg-red-100', text: 'text-red-600', label: 'F' },
};

// ─── 공원 순위 섹션 컴포넌트 ─────────────────────────────────────────────────
function ParkRankingSection({ adminKey }: { adminKey: string }) {
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [districtList, setDistrictList] = useState<RankDistrict[]>([]);
  const [rankData, setRankData] = useState<RankDistrict[]>([]);
  const [parkMarkers, setParkMarkers] = useState<ParkMarker[]>([]);
  const [rankLoading, setRankLoading] = useState(false);
  const [rankMode, setRankMode] = useState<'national' | 'city' | 'district'>('national');
  const [mapCenter, setMapCenter] = useState<[number, number]>([36.5, 127.5]);
  const [mapZoom, setMapZoom] = useState(7);
  const [selectedPark, setSelectedPark] = useState<ParkMarker | null>(null);

  const headers = { 'Content-Type': 'application/json', 'x-admin-key': adminKey };

  const loadRanking = async (city: string, district: string) => {
    setRankLoading(true);
    setParkMarkers([]);
    setSelectedPark(null);
    try {
      const params = new URLSearchParams();
      if (city) params.set('city', city);
      if (district) params.set('district', district);
      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`${API_BASE}/api/admin/park-ranking${qs}`, {
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
      });
      if (res.ok) {
        const data = await res.json();
        setRankData(data.districts || []);
        setRankMode(data.mode || 'national');
        if (data.parks && data.parks.length > 0) {
          setParkMarkers(data.parks);
          const lats = data.parks.map((p: ParkMarker) => p.lat);
          const lngs = data.parks.map((p: ParkMarker) => p.lng);
          const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
          const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
          setMapCenter([centerLat, centerLng]);
          setMapZoom(13);
        } else if (city && !district) {
          setMapZoom(9);
        } else if (!city) {
          setMapCenter([36.5, 127.5]);
          setMapZoom(7);
        }
        // 구/군 목록 저장 (시 선택 시)
        if (city && !district) {
          setDistrictList(data.districts || []);
        }
      }
    } catch {
      // 무시
    } finally {
      setRankLoading(false);
    }
  };

  useEffect(() => {
    loadRanking('', '');
  }, []);

  const handleCityChange = (city: string) => {
    setSelectedCity(city);
    setSelectedDistrict('');
    setDistrictList([]);
    loadRanking(city, '');
  };

  const handleDistrictChange = (city: string, district: string) => {
    setSelectedDistrict(district);
    loadRanking(city, district);
  };

  const top15 = rankData.slice(0, 15);
  const maxCount = rankData.length > 0 ? rankData[0].parkCount : 1;

  const chartData = top15.map((d, i) => ({
    name: d.district,
    parkCount: d.parkCount,
    fill: i < 3 ? RANK_COLORS[i] : i < 5 ? RANK_COLORS[3] : RANK_COLORS[4],
  }));

  const modeLabel =
    rankMode === 'district' && selectedDistrict
      ? `${selectedCity} ${selectedDistrict} 내 동별`
      : rankMode === 'city' && selectedCity
      ? `${selectedCity} 내 구/군별`
      : '전국 시/도별';

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
      {/* 섹션 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="font-bold text-gray-800 flex items-center gap-2">
          <TreePine className="w-4 h-4 text-green-600" />
          공원 순위 분석
          <span className="text-xs font-normal text-gray-400">— {modeLabel}</span>
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          <MapPin className="w-3.5 h-3.5 text-gray-400" />
          {/* 시/도 선택 */}
          <select
            value={selectedCity}
            onChange={(e) => handleCityChange(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
          >
            <option value="">🗺️ 전국 시/도별</option>
            {SIDO_LIST.map((sido) => (
              <option key={sido} value={sido}>{sido}</option>
            ))}
          </select>
          {/* 구/군 선택 (시 선택 후 표시) */}
          {selectedCity && districtList.length > 0 && (
            <select
              value={selectedDistrict}
              onChange={(e) => handleDistrictChange(selectedCity, e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
            >
              <option value="">🏙️ 구/군 선택 (동 단위)</option>
              {districtList.map((d) => (
                <option key={d.district} value={d.district}>{d.district}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => loadRanking(selectedCity, selectedDistrict)}
            className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
            title="새로고침"
          >
            <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
          </button>
        </div>
      </div>

      {/* 브레드크럼 */}
      <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-4">
        <button
          onClick={() => { setSelectedCity(''); setSelectedDistrict(''); setDistrictList([]); loadRanking('', ''); }}
          className={`hover:text-green-600 transition-colors ${!selectedCity ? 'text-green-600 font-semibold' : ''}`}
        >
          전국
        </button>
        {selectedCity && (
          <>
            <span>›</span>
            <button
              onClick={() => { setSelectedDistrict(''); loadRanking(selectedCity, ''); }}
              className={`hover:text-green-600 transition-colors ${selectedCity && !selectedDistrict ? 'text-green-600 font-semibold' : ''}`}
            >
              {selectedCity}
            </button>
          </>
        )}
        {selectedDistrict && (
          <>
            <span>›</span>
            <span className="text-green-600 font-semibold">{selectedDistrict}</span>
          </>
        )}
      </div>

      {rankLoading ? (
        <div className="flex items-center justify-center h-48 gap-2 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">순위 불러오는 중...</span>
        </div>
      ) : rankData.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          데이터가 없습니다
        </div>
      ) : (
        <>
          <div className="grid lg:grid-cols-2 gap-6 mb-6">
            {/* 바 차트 */}
            <div>
              <p className="text-xs text-gray-400 mb-3">상위 15개 지역 공원 수</p>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 70 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-40} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [`${v}개`, '공원 수']} />
                  <Bar
                    dataKey="parkCount"
                    radius={[4, 4, 0, 0]}
                    onClick={(data) => {
                      if (rankMode === 'city') handleDistrictChange(selectedCity, data.name);
                    }}
                    style={{ cursor: rankMode === 'city' ? 'pointer' : 'default' }}
                  >
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {rankMode === 'city' && (
                <p className="text-xs text-gray-400 text-center mt-1">막대 클릭 시 동 단위로 드릴다운</p>
              )}
            </div>

            {/* 순위 테이블 */}
            <div>
              <p className="text-xs text-gray-400 mb-3">전체 {rankData.length}개 지역 순위</p>
              <div className="overflow-y-auto max-h-72 rounded-xl border border-gray-100">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 w-8">순위</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">지역</th>
                      <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500">공원 수</th>
                      <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500">총 면적</th>
                      <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500">비율</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankData.map((d, i) => (
                      <tr
                        key={d.district}
                        className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} ${rankMode === 'city' ? 'cursor-pointer hover:bg-green-50' : ''}`}
                        onClick={() => rankMode === 'city' && handleDistrictChange(selectedCity, d.district)}
                      >
                        <td className="px-3 py-2 text-xs text-gray-400 font-medium">
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
                        </td>
                        <td className="px-3 py-2 text-sm font-medium text-gray-800">{d.district}</td>
                        <td className="px-3 py-2 text-center text-sm font-bold text-green-700">
                          {d.parkCount.toLocaleString()}개
                        </td>
                        <td className="px-3 py-2 text-center text-xs text-gray-500">
                          {(d.totalArea / 10000).toFixed(1)}ha
                        </td>
                        <td className="px-3 py-2 text-center">
                          <div className="flex items-center gap-1">
                            <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                              <div
                                className="bg-green-500 h-1.5 rounded-full"
                                style={{ width: `${Math.round((d.parkCount / maxCount) * 100)}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-400 w-8 text-right">
                              {Math.round((d.parkCount / maxCount) * 100)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 지도 (동 단위 선택 시 공원 마커 표시) */}
          {rankMode === 'district' && parkMarkers.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {selectedCity} {selectedDistrict} 공원 위치 ({parkMarkers.length}개)
                {selectedPark && (
                  <span className="ml-2 text-green-600 font-semibold">— {selectedPark.name} 선택됨</span>
                )}
              </p>
              <div className="rounded-xl overflow-hidden border border-gray-200" style={{ height: 380 }}>
                <ParkMap
                  center={mapCenter}
                  zoom={mapZoom}
                  parks={parkMarkers}
                  selectedPark={selectedPark}
                  onSelectPark={setSelectedPark}
                />
              </div>
              {/* 공원 목록 테이블 (점수 순) */}
              {parkMarkers.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs text-gray-400 mb-2">공원 녹지 점수 순위 (상위 {Math.min(parkMarkers.length, 50)}개)</p>
                  <div className="overflow-y-auto max-h-64 rounded-xl border border-gray-100">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-gray-50">
                        <tr>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 w-8">순위</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">공원명</th>
                          <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500 w-16">등급</th>
                          <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500 w-16">점수</th>
                          <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500 w-20">면적</th>
                          <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500 w-20">500m내</th>
                          <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500 w-20">1km내</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parkMarkers.slice(0, 50).map((park, i) => {
                          const gs = GRADE_STYLE[park.grade ?? 'F'] ?? GRADE_STYLE['F'];
                          return (
                            <tr
                              key={park.id}
                              className={`cursor-pointer transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-green-50`}
                              onClick={() => setSelectedPark(park)}
                            >
                              <td className="px-3 py-2 text-xs text-gray-400 font-medium">
                                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
                              </td>
                              <td className="px-3 py-2 text-sm font-medium text-gray-800 max-w-[160px] truncate">{park.name}</td>
                              <td className="px-3 py-2 text-center">
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${gs.bg} ${gs.text}`}>
                                  {gs.label}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-center text-sm font-bold text-gray-700">
                                {park.score ?? '-'}
                              </td>
                              <td className="px-3 py-2 text-center text-xs text-gray-500">
                                {park.area > 0 ? `${(park.area / 10000).toFixed(1)}ha` : '-'}
                              </td>
                              <td className="px-3 py-2 text-center text-xs text-gray-500">
                                {park.parkCount500m != null ? `${park.parkCount500m}개` : '-'}
                              </td>
                              <td className="px-3 py-2 text-center text-xs text-gray-500">
                                {park.parkCount1km != null ? `${park.parkCount1km}개` : '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {selectedPark && (
                <div className="mt-2 bg-green-50 border border-green-100 rounded-lg px-4 py-2.5 text-sm flex items-start gap-3">
                  <TreePine className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-green-800 flex items-center gap-2">
                      {selectedPark.name}
                      {selectedPark.grade && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${GRADE_STYLE[selectedPark.grade]?.bg} ${GRADE_STYLE[selectedPark.grade]?.text}`}>
                          {selectedPark.grade}등급 {selectedPark.score}점
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {selectedPark.type} · {selectedPark.area > 0 ? `${(selectedPark.area / 10000).toFixed(2)}ha` : '면적 미상'}
                      {selectedPark.parkCount500m !== undefined && ` · 500m내 ${selectedPark.parkCount500m}개 · 1km내 ${selectedPark.parkCount1km}개`}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5 truncate">{selectedPark.address}</div>
                  </div>
                  <button onClick={() => setSelectedPark(null)} className="ml-auto text-xs text-gray-400 hover:text-gray-600 flex-shrink-0">✕</button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Leaflet 지도 컴포넌트 ────────────────────────────────────────────────────
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Leaflet 기본 마커 아이콘 수정
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function createParkIcon(score?: number, area?: number) {
  // 점수 기반 색상 (점수 없으면 면적 기반 폴백)
  let color: string;
  let size: number;
  if (score !== undefined) {
    color = score >= 80 ? '#15803d'   // A: 진한 초록
          : score >= 65 ? '#16a34a'   // B: 초록
          : score >= 50 ? '#ca8a04'   // C: 노랑
          : score >= 35 ? '#ea580c'   // D: 주황
          : '#dc2626';                // F: 빨강
    size = score >= 80 ? 26 : score >= 65 ? 22 : score >= 50 ? 18 : 14;
  } else {
    const a = area ?? 0;
    size = a >= 50000 ? 28 : a >= 10000 ? 22 : 16;
    color = a >= 50000 ? '#15803d' : a >= 10000 ? '#16a34a' : '#4ade80';
  }
  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;background:${color};border:2px solid white;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function MapUpdater({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom]);
  return null;
}

function ParkMap({
  center, zoom, parks, selectedPark: _selectedPark, onSelectPark,
}: {
  center: [number, number];
  zoom: number;
  parks: ParkMarker[];
  selectedPark: ParkMarker | null;
  onSelectPark: (p: ParkMarker) => void;
}) {
  return (
    <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapUpdater center={center} zoom={zoom} />
      {parks.map((park) => (
        <Marker
          key={park.id}
          position={[park.lat, park.lng]}
          icon={createParkIcon(park.score, park.area)}
          eventHandlers={{ click: () => onSelectPark(park) }}
        >
          <Popup>
            <div style={{ minWidth: 140 }}>
              <div style={{ fontWeight: 700, color: '#15803d', marginBottom: 2 }}>{park.name}</div>
              <div style={{ color: '#6b7280', fontSize: 11 }}>{park.type}</div>
              {park.area > 0 && <div style={{ fontSize: 11 }}>{(park.area / 10000).toFixed(2)}ha</div>}
              {park.score !== undefined && (
                <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{
                    background: park.grade === 'A' ? '#dcfce7' : park.grade === 'B' ? '#d1fae5' : park.grade === 'C' ? '#fef9c3' : park.grade === 'D' ? '#ffedd5' : '#fee2e2',
                    color: park.grade === 'A' ? '#15803d' : park.grade === 'B' ? '#065f46' : park.grade === 'C' ? '#854d0e' : park.grade === 'D' ? '#9a3412' : '#991b1b',
                    fontWeight: 700, fontSize: 12, padding: '1px 6px', borderRadius: 4,
                  }}>{park.grade}</span>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{park.score}점</span>
                </div>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

// ─── 메인 관리 대시보드 ───────────────────────────────────────────────────────
function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [retrainLoading, setRetrainLoading] = useState(false);
  const [retrainMsg, setRetrainMsg] = useState('');
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);

  // 필터 상태
  const [ratingFilter, setRatingFilter] = useState<'all' | '1' | '0'>('all');
  const [intentFilter, setIntentFilter] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  // 코퍼스 추가 모달
  const [addModal, setAddModal] = useState(false);
  const [addQuestion, setAddQuestion] = useState('');
  const [addIntent, setAddIntent] = useState('best_district');
  const [addLoading, setAddLoading] = useState(false);
  const [addMsg, setAddMsg] = useState('');

  const adminKey = ADMIN_PASSWORD;

  const headers = {
    'Content-Type': 'application/json',
    'x-admin-key': adminKey,
  };

  // 서버 상태 확인
  useEffect(() => {
    fetch(`${API_BASE}/health`)
      .then((r) => r.json())
      .then((d) => setServerOnline(d.status === 'ok'))
      .catch(() => setServerOnline(false));
  }, []);

  // 통계 로드
  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/ai/feedback/stats`, { headers });
      if (res.ok) setStats(await res.json());
    } catch {
      // 무시
    } finally {
      setLoading(false);
    }
  }, []);

  // 피드백 목록 로드
  const loadFeedbacks = useCallback(async () => {
    setFeedbackLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
      });
      if (ratingFilter !== 'all') params.set('rating', ratingFilter);
      if (intentFilter) params.set('intent', intentFilter);

      const res = await fetch(`${API_BASE}/api/admin/feedback/list?${params}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setFeedbacks(data.feedbacks || []);
        setTotalCount(data.total || 0);
      }
    } catch {
      // 무시
    } finally {
      setFeedbackLoading(false);
    }
  }, [page, ratingFilter, intentFilter]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadFeedbacks(); }, [loadFeedbacks]);

  // 모델 재학습
  const handleRetrain = async () => {
    setRetrainLoading(true);
    setRetrainMsg('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/feedback/retrain`, {
        method: 'POST',
        headers,
      });
      if (res.ok) {
        const data = await res.json();
        setRetrainMsg(`✅ ${data.message}`);
        loadStats();
      } else {
        setRetrainMsg('❌ 재학습 실패');
      }
    } catch {
      setRetrainMsg('❌ 서버 연결 오류');
    } finally {
      setRetrainLoading(false);
      setTimeout(() => setRetrainMsg(''), 4000);
    }
  };

  // 코퍼스 수동 추가
  const handleAddToCorpus = async () => {
    if (!addQuestion.trim()) return;
    setAddLoading(true);
    setAddMsg('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/feedback/add-to-corpus`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ question: addQuestion, intent: addIntent }),
      });
      if (res.ok) {
        const data = await res.json();
        setAddMsg(`✅ ${data.message}`);
        setAddQuestion('');
        loadStats();
      } else {
        setAddMsg('❌ 추가 실패');
      }
    } catch {
      setAddMsg('❌ 서버 연결 오류');
    } finally {
      setAddLoading(false);
    }
  };

  // 차트 데이터 준비
  const chartData = stats
    ? Object.entries(
        stats.db_intent_distribution || stats.intent_distribution || {}
      )
        .map(([intent, count]) => ({
          name: INTENT_LABELS[intent] || intent,
          intent,
          count,
        }))
        .sort((a, b) => b.count - a.count)
    : [];

  const totalFeedbacks = stats?.db_total ?? stats?.total_feedbacks ?? 0;
  const positiveFeedbacks = stats?.db_positive ?? stats?.positive ?? 0;
  const negativeFeedbacks = stats?.db_negative ?? stats?.negative ?? 0;
  const positiveRate =
    totalFeedbacks > 0 ? Math.round((positiveFeedbacks / totalFeedbacks) * 100) : 0;

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Brain className="w-6 h-6 text-purple-600" />
            AI 피드백 관리
          </h1>
          <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
            <span
              className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                serverOnline === true
                  ? 'bg-green-100 text-green-700'
                  : serverOnline === false
                  ? 'bg-red-100 text-red-600'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              {serverOnline === true ? (
                <Wifi className="w-3 h-3" />
              ) : serverOnline === false ? (
                <WifiOff className="w-3 h-3" />
              ) : (
                <Loader2 className="w-3 h-3 animate-spin" />
              )}
              {serverOnline === true
                ? '서버 연결됨'
                : serverOnline === false
                ? '서버 오프라인'
                : '확인 중'}
            </span>
            <Database className="w-3.5 h-3.5 text-gray-400" />
            관리자 전용 페이지
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRetrain}
            disabled={retrainLoading}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors"
          >
            {retrainLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            모델 재학습
          </button>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-4 py-2 rounded-xl text-sm transition-colors"
          >
            <LogOut className="w-4 h-4" />
            로그아웃
          </button>
        </div>
      </div>

      {/* 재학습 결과 메시지 */}
      {retrainMsg && (
        <div className="mb-4 bg-purple-50 border border-purple-200 rounded-xl px-4 py-3 text-sm text-purple-800 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          {retrainMsg}
        </div>
      )}

      {/* 통계 카드 */}
      {loading ? (
        <div className="flex items-center justify-center h-32 gap-2 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">통계 불러오는 중...</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              {
                label: '총 피드백',
                value: `${totalFeedbacks}개`,
                color: 'text-gray-800',
                bg: 'bg-gray-50',
                icon: <MessageSquare className="w-5 h-5 text-gray-500" />,
              },
              {
                label: '👍 긍정',
                value: `${positiveFeedbacks}개`,
                color: 'text-green-700',
                bg: 'bg-green-50',
                icon: <ThumbsUp className="w-5 h-5 text-green-500" />,
              },
              {
                label: '👎 부정',
                value: `${negativeFeedbacks}개`,
                color: 'text-red-600',
                bg: 'bg-red-50',
                icon: <ThumbsDown className="w-5 h-5 text-red-400" />,
              },
              {
                label: '긍정률',
                value: `${positiveRate}%`,
                color: positiveRate >= 70 ? 'text-green-700' : positiveRate >= 50 ? 'text-yellow-600' : 'text-red-600',
                bg: positiveRate >= 70 ? 'bg-green-50' : positiveRate >= 50 ? 'bg-yellow-50' : 'bg-red-50',
                icon: <BarChart2 className="w-5 h-5 text-blue-500" />,
              },
            ].map((item) => (
              <div key={item.label} className={`${item.bg} rounded-xl p-4 flex items-center gap-3`}>
                {item.icon}
                <div>
                  <div className={`text-2xl font-bold ${item.color}`}>{item.value}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{item.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* 코퍼스 현황 카드 */}
          <div className="bg-purple-50 border border-purple-100 rounded-xl px-5 py-4 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BookOpen className="w-5 h-5 text-purple-600" />
              <div>
                <div className="text-sm font-semibold text-purple-800">
                  TF-IDF 학습 코퍼스
                </div>
                <div className="text-xs text-purple-600 mt-0.5">
                  현재 <strong>{stats?.corpus_size ?? 0}개</strong> 문장이 학습에 사용되고 있습니다
                </div>
              </div>
            </div>
            <button
              onClick={() => setAddModal(true)}
              className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              문장 추가
            </button>
          </div>

          {/* 공원 순위 분석 섹션 */}
          <ParkRankingSection adminKey={adminKey} />

          {/* 의도별 분포 차트 */}
          {chartData.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
              <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-blue-600" />
                의도별 피드백 분포
              </h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10 }}
                    angle={-35}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [`${v}개`, '피드백 수']} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry) => (
                      <Cell
                        key={entry.intent}
                        fill={INTENT_COLORS[entry.intent] || '#9ca3af'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      {/* 피드백 목록 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* 필터 헤더 */}
        <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center gap-3">
          <h2 className="font-bold text-gray-800 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-purple-600" />
            피드백 목록
            <span className="text-xs text-gray-400 font-normal">({totalCount}개)</span>
          </h2>
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            <Filter className="w-3.5 h-3.5 text-gray-400" />
            {/* 평가 필터 */}
            {(['all', '1', '0'] as const).map((v) => (
              <button
                key={v}
                onClick={() => { setRatingFilter(v); setPage(0); }}
                className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
                  ratingFilter === v
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {v === 'all' ? '전체' : v === '1' ? '👍 긍정' : '👎 부정'}
              </button>
            ))}
            {/* 의도 필터 */}
            <select
              value={intentFilter}
              onChange={(e) => { setIntentFilter(e.target.value); setPage(0); }}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-purple-400"
            >
              <option value="">모든 의도</option>
              {Object.entries(INTENT_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <button
              onClick={loadFeedbacks}
              className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
              title="새로고침"
            >
              <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* 테이블 */}
        {feedbackLoading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">불러오는 중...</span>
          </div>
        ) : feedbacks.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            피드백 데이터가 없습니다
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 w-8">#</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">질문</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 w-32">의도</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 w-20">신뢰도</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 w-20">평가</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 w-36">시간</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 w-24">학습 추가</th>
                </tr>
              </thead>
              <tbody>
                {feedbacks.map((fb, i) => (
                  <FeedbackRow
                    key={fb.id}
                    fb={fb}
                    index={page * PAGE_SIZE + i + 1}
                    onAddToCorpus={(q, intent) => {
                      setAddQuestion(q);
                      setAddIntent(intent || 'best_district');
                      setAddModal(true);
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} / {totalCount}개
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              </button>
              <span className="text-xs text-gray-600 font-medium">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 코퍼스 추가 모달 */}
      {addModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-purple-600" />
              학습 코퍼스에 문장 추가
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">질문 문장</label>
                <input
                  type="text"
                  value={addQuestion}
                  onChange={(e) => setAddQuestion(e.target.value)}
                  placeholder="예: 공원이 제일 많은 곳 어디야?"
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">의도 분류</label>
                <select
                  value={addIntent}
                  onChange={(e) => setAddIntent(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {Object.entries(INTENT_LABELS).filter(([k]) => k !== 'unknown').map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              {addMsg && (
                <div className={`text-sm rounded-lg px-3 py-2 ${
                  addMsg.startsWith('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                }`}>
                  {addMsg}
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => { setAddModal(false); setAddMsg(''); setAddQuestion(''); }}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2.5 rounded-xl text-sm transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleAddToCorpus}
                disabled={!addQuestion.trim() || addLoading}
                className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
              >
                {addLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
                {addLoading ? '추가 중...' : '추가 및 재학습'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 피드백 행 컴포넌트 ───────────────────────────────────────────────────────
function FeedbackRow({
  fb,
  index,
  onAddToCorpus,
}: {
  fb: Feedback;
  index: number;
  onAddToCorpus: (question: string, intent: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const intentLabel = INTENT_LABELS[fb.intent] || fb.intent;
  const intentColor = INTENT_COLORS[fb.intent] || '#9ca3af';

  const formattedDate = fb.created_at
    ? new Date(fb.created_at).toLocaleString('ko-KR', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '-';

  return (
    <>
      <tr
        className={`cursor-pointer transition-colors ${
          index % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-50/50 hover:bg-gray-100'
        }`}
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-4 py-3 text-xs text-gray-400">{index}</td>
        <td className="px-4 py-3 text-sm text-gray-800 max-w-xs">
          <div className="truncate">{fb.question}</div>
        </td>
        <td className="px-4 py-3 text-center">
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium text-white"
            style={{ background: intentColor }}
          >
            {intentLabel}
          </span>
        </td>
        <td className="px-4 py-3 text-center text-xs text-gray-600">
          {fb.confidence > 0 ? `${Math.round(fb.confidence * 100)}%` : '-'}
        </td>
        <td className="px-4 py-3 text-center">
          {fb.rating === 1 ? (
            <span className="text-green-600 font-bold text-base">👍</span>
          ) : (
            <span className="text-red-500 font-bold text-base">👎</span>
          )}
        </td>
        <td className="px-4 py-3 text-center text-xs text-gray-500">{formattedDate}</td>
        <td className="px-4 py-3 text-center">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddToCorpus(fb.question, fb.intent);
            }}
            className="text-xs bg-purple-50 hover:bg-purple-100 text-purple-700 px-2 py-1 rounded-lg transition-colors font-medium"
            title="이 질문을 학습 코퍼스에 추가"
          >
            + 학습
          </button>
        </td>
      </tr>
      {/* 확장 행: AI 응답 미리보기 */}
      {expanded && fb.answer && (
        <tr className="bg-purple-50/50">
          <td colSpan={7} className="px-6 py-3">
            <div className="text-xs text-gray-500 font-semibold mb-1">AI 응답 미리보기</div>
            <div className="text-sm text-gray-700 whitespace-pre-wrap bg-white rounded-lg p-3 border border-purple-100 max-h-60 overflow-y-auto">
              {fb.answer}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────
export default function FeedbackAdmin() {
  const [authed, setAuthed] = useState(
    () => sessionStorage.getItem(SESSION_KEY) === '1'
  );

  const handleLogout = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setAuthed(false);
  };

  if (!authed) {
    return <PasswordGate onAuth={() => setAuthed(true)} />;
  }

  return <AdminDashboard onLogout={handleLogout} />;
}
