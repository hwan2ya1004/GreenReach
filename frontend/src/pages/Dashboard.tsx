import { useState } from 'react';
import { MapPin, Code2, ChevronRight, Zap, BarChart3, Building2, CheckCircle2, Copy, Check, Mail, Phone } from 'lucide-react';

// ─── API 응답 시뮬레이션 데이터 ──────────────────────────────────────────────
const DEMO_ADDRESSES = [
  {
    address: '서울 강남구 역삼동 737',
    lat: 37.4979,
    lng: 127.0276,
    score: 82,
    grade: 'A',
    nearestPark: '역삼공원',
    walkMin: 4,
    parkCount: 8,
    totalArea: 124500,
  },
  {
    address: '부산 해운대구 우동 1480',
    lat: 35.1631,
    lng: 129.1639,
    score: 74,
    grade: 'B',
    nearestPark: '해운대해수욕장공원',
    walkMin: 6,
    parkCount: 6,
    totalArea: 98700,
  },
  {
    address: '경기 수원시 팔달구 인계동 1119',
    lat: 37.2636,
    lng: 127.0286,
    score: 55,
    grade: 'C',
    nearestPark: '인계근린공원',
    walkMin: 12,
    parkCount: 3,
    totalArea: 52000,
  },
  {
    address: '제주특별자치도 제주시 연동 2777',
    lat: 33.4996,
    lng: 126.5312,
    score: 38,
    grade: 'F',
    nearestPark: '연동근린공원',
    walkMin: 19,
    parkCount: 2,
    totalArea: 28500,
  },
];

const GRADE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  A: { label: '매우 우수', color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' },
  B: { label: '우수', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  C: { label: '보통', color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200' },
  D: { label: '미흡', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
  F: { label: '취약', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
};

const PRICING_PLANS = [
  {
    name: '스타터',
    price: '월 29만원',
    unit: '월 10,000 API 호출 (하루 약 330개 매물)',
    target: '소규모 부동산 앱 · 스타트업에 적합',
    features: [
      '주소를 입력하면 녹지 점수(0~100점)를 즉시 반환하는 API',
      '가장 가까운 공원까지 실제 도보 몇 분인지 계산',
      'API 연동 방법을 단계별로 설명한 개발자 가이드 제공',
      '연동 중 문제 발생 시 이메일로 기술 지원',
    ],
    highlight: false,
    cta: '무료 체험 신청',
  },
  {
    name: '비즈니스',
    price: '월 99만원',
    unit: '월 100,000 API 호출 (하루 약 3,300개 매물)',
    target: '직방·다방 규모의 중대형 플랫폼에 적합',
    features: [
      '스타터 플랜 전체 포함',
      '공공데이터포털 최신 공원 정보를 실시간으로 반영',
      '매물 페이지에 삽입되는 녹지 점수 카드의 색상·크기를 플랫폼 디자인에 맞게 변경 가능',
      '담당 개발자가 직접 연동을 도와주는 1:1 기술 지원',
      '서비스 가용성 99.9% 보장 (SLA 계약)',
    ],
    highlight: true,
    cta: '파일럿 제휴 신청',
  },
  {
    name: '엔터프라이즈',
    price: '별도 협의',
    unit: '무제한 API 호출',
    target: '대형 건설사 · 포털 · 금융사에 적합',
    features: [
      '비즈니스 플랜 전체 포함',
      '자사 서버에 직접 설치하는 전용 인프라 구축',
      'GreenReach 로고 없이 자사 브랜드 이름으로 서비스 제공 (예: "직방 녹지 지수"로 표시)',
      '경쟁사에는 제공하지 않는 전국 데이터 독점 공급 계약',
      '프로젝트 매니저가 도입 전 과정을 전담 관리',
    ],
    highlight: false,
    cta: '영업팀 문의',
  },
];

const EFFECT_STATS = [
  { value: '16,999개', label: '전국 공원 데이터', sub: '공공데이터포털 기준' },
  { value: '0~100점', label: '표준화된 접근성 점수', sub: '거리·밀도·면적 종합' },
  { value: '< 200ms', label: 'API 응답 속도', sub: '평균 응답 시간' },
  { value: '99.9%', label: '서비스 가용성', sub: 'SLA 기준' },
];

// ─── 코드 복사 버튼 ───────────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={handleCopy}
      className="absolute top-3 right-3 p-1.5 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition-colors"
      title="복사"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

// ─── 점수 게이지 ──────────────────────────────────────────────────────────────
function ScoreGauge({ score, grade }: { score: number; grade: string }) {
  const cfg = GRADE_CONFIG[grade] ?? GRADE_CONFIG['C'];
  const barColor =
    grade === 'A' ? 'bg-green-500' :
    grade === 'B' ? 'bg-blue-500' :
    grade === 'C' ? 'bg-yellow-500' :
    grade === 'D' ? 'bg-orange-500' : 'bg-red-500';

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`text-5xl font-bold ${cfg.color}`}>{score}</div>
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div
          className={`${barColor} h-2.5 rounded-full transition-all duration-700`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
        {grade}등급 · {cfg.label}
      </span>
    </div>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [inputAddress, setInputAddress] = useState('');
  const [demoResult, setDemoResult] = useState<typeof DEMO_ADDRESSES[0] | null>(null);
  const [loading, setLoading] = useState(false);

  const selected = DEMO_ADDRESSES[selectedIdx];

  const apiRequestCode = `GET https://greenreach-api.onrender.com/api/score
  ?lat=${selected.lat}
  &lng=${selected.lng}
  &radius=1000

Authorization: Bearer YOUR_API_KEY`;

  const apiResponseCode = JSON.stringify({
    address: selected.address,
    score: selected.score,
    grade: selected.grade,
    nearest_park: selected.nearestPark,
    walk_minutes: selected.walkMin,
    park_count_1km: selected.parkCount,
    total_green_area_m2: selected.totalArea,
    data_source: 'data.go.kr 전국도시공원정보표준데이터',
    updated_at: '2026-06-27T12:00:00Z',
  }, null, 2);

  const handleDemoSearch = () => {
    if (!inputAddress.trim()) return;
    setLoading(true);
    setTimeout(() => {
      // 입력 주소에서 키워드 매칭
      const matched = DEMO_ADDRESSES.find(d =>
        d.address.includes(inputAddress.replace(/\s/g, '').slice(0, 3))
      ) ?? DEMO_ADDRESSES[Math.floor(Math.random() * DEMO_ADDRESSES.length)];
      setDemoResult(matched);
      setLoading(false);
    }, 800);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

      {/* ── 헤더 ── */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 bg-purple-100 text-purple-700 text-sm font-semibold px-4 py-1.5 rounded-full mb-4">
          <Code2 className="w-4 h-4" />
          B2B API 파트너 데모
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
          녹지 접근성 점수 API,<br />
          <span className="text-green-600">매물 페이지에 바로 붙이세요</span>
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          직방·다방·호갱노노·아실 등 부동산 플랫폼에 GreenReach API를 연동하면<br />
          매물 주소 기반 녹지 접근성 점수를 즉시 제공할 수 있습니다.
        </p>
      </div>

      {/* ── 지표 배너 ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
        {EFFECT_STATS.map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 text-center">
            <div className="text-2xl font-bold text-green-700 mb-1">{s.value}</div>
            <div className="text-sm font-semibold text-gray-800">{s.label}</div>
            <div className="text-xs text-gray-400 mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* ── 라이브 API 데모 ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-10">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-500" />
          <h2 className="font-bold text-gray-900 text-lg">라이브 API 데모</h2>
          <span className="ml-auto text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">실시간 시연</span>
        </div>

        <div className="p-6 grid lg:grid-cols-2 gap-8">
          {/* 왼쪽: 주소 선택 + 요청 코드 */}
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">① 매물 주소 선택 (샘플)</label>
              <div className="space-y-2">
                {DEMO_ADDRESSES.map((d, i) => (
                  <button
                    key={i}
                    onClick={() => { setSelectedIdx(i); setDemoResult(null); }}
                    className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all ${
                      selectedIdx === i
                        ? 'border-green-500 bg-green-50 text-green-800 font-semibold'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{d.address}</span>
                      <span className={`ml-auto text-xs font-bold px-1.5 py-0.5 rounded ${GRADE_CONFIG[d.grade]?.bg} ${GRADE_CONFIG[d.grade]?.color}`}>
                        {d.grade}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">② API 요청 코드</label>
              <div className="relative bg-gray-900 rounded-xl p-4 text-xs font-mono text-green-400 leading-relaxed overflow-x-auto">
                <CopyButton text={apiRequestCode} />
                <pre className="whitespace-pre-wrap pr-8">{apiRequestCode}</pre>
              </div>
            </div>
          </div>

          {/* 오른쪽: API 응답 + 위젯 미리보기 */}
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">③ API 응답 (JSON)</label>
              <div className="relative bg-gray-900 rounded-xl p-4 text-xs font-mono text-blue-300 leading-relaxed overflow-x-auto max-h-52 overflow-y-auto">
                <CopyButton text={apiResponseCode} />
                <pre className="whitespace-pre-wrap pr-8">{apiResponseCode}</pre>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">④ 매물 페이지 위젯 미리보기</label>
              {/* 부동산 앱 매물 카드 시뮬레이션 */}
              <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                {/* 가짜 매물 헤더 */}
                <div className="bg-gray-100 px-4 py-3 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-semibold text-gray-700 truncate">{selected.address}</span>
                </div>
                {/* GreenReach 위젯 영역 */}
                <div className={`px-4 py-4 border-t ${GRADE_CONFIG[selected.grade]?.border} ${GRADE_CONFIG[selected.grade]?.bg}`}>
                  <div className="flex items-center gap-1.5 mb-3">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">🌿 GreenReach 녹지 접근성</span>
                  </div>
                  <div className="flex items-center gap-6">
                    <ScoreGauge score={selected.score} grade={selected.grade} />
                    <div className="flex-1 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">가장 가까운 공원</span>
                        <span className="font-semibold text-gray-800">{selected.nearestPark}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">도보 거리</span>
                        <span className="font-semibold text-gray-800">약 {selected.walkMin}분</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">반경 1km 공원 수</span>
                        <span className="font-semibold text-gray-800">{selected.parkCount}개</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-gray-400 text-right">Powered by GreenReach API</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 직접 주소 입력 데모 ── */}
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl border border-green-100 p-6 mb-10">
        <h2 className="font-bold text-gray-900 text-lg mb-1 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-green-600" />
          직접 주소로 테스트해보기
        </h2>
        <p className="text-sm text-gray-500 mb-4">전국 주소를 입력하면 녹지 접근성 점수를 즉시 확인할 수 있습니다 (데모)</p>
        <div className="flex gap-3">
          <input
            type="text"
            value={inputAddress}
            onChange={(e) => setInputAddress(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleDemoSearch()}
            placeholder="예: 강남구 역삼동, 해운대구 우동, 제주시 연동..."
            className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
          />
          <button
            onClick={handleDemoSearch}
            disabled={loading || !inputAddress.trim()}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm flex items-center gap-2"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                분석 중
              </span>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                점수 조회
              </>
            )}
          </button>
        </div>

        {demoResult && (
          <div className={`mt-4 rounded-xl border p-4 ${GRADE_CONFIG[demoResult.grade]?.bg} ${GRADE_CONFIG[demoResult.grade]?.border}`}>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className={`text-4xl font-bold ${GRADE_CONFIG[demoResult.grade]?.color}`}>{demoResult.score}</div>
                <div className={`text-xs font-bold ${GRADE_CONFIG[demoResult.grade]?.color}`}>{demoResult.grade}등급</div>
              </div>
              <div className="flex-1 text-sm space-y-1">
                <div className="font-semibold text-gray-800">{demoResult.address}</div>
                <div className="text-gray-600">가장 가까운 공원: <strong>{demoResult.nearestPark}</strong> (도보 {demoResult.walkMin}분)</div>
                <div className="text-gray-600">반경 1km 내 공원 {demoResult.parkCount}개 · 총 녹지 {(demoResult.totalArea / 10000).toFixed(1)}ha</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 도입 효과 ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-10">
        <h2 className="font-bold text-gray-900 text-lg mb-6 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-purple-600" />
          부동산 플랫폼 도입 시 기대 효과
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              emoji: '🏠',
              title: '매물 차별화',
              desc: '학군·교통 점수에 이어 "녹지 접근성 점수"를 추가해 경쟁 플랫폼과 차별화된 매물 정보를 제공합니다.',
              highlight: '타 플랫폼 0개 → GreenReach 연동 즉시 제공',
            },
            {
              emoji: '👶',
              title: '핵심 타겟 공략',
              desc: '영유아 부모·이사 예정자·반려동물 보호자 등 녹지 환경을 중시하는 고가치 사용자층을 공략합니다.',
              highlight: '이사 결정 요인 중 녹지 환경 3위 (KB부동산 2025)',
            },
            {
              emoji: '📊',
              title: '데이터 신뢰성',
              desc: '공공데이터포털 전국도시공원정보표준데이터 기반으로 전국 16,999개 공원을 실시간 연동합니다.',
              highlight: '정부 공공데이터 기반 · 법적 신뢰성 확보',
            },
          ].map((item) => (
            <div key={item.title} className="bg-gray-50 rounded-xl p-5">
              <div className="text-3xl mb-3">{item.emoji}</div>
              <h3 className="font-bold text-gray-900 mb-2">{item.title}</h3>
              <p className="text-sm text-gray-600 mb-3 leading-relaxed">{item.desc}</p>
              <div className="text-xs bg-green-100 text-green-700 rounded-lg px-3 py-2 font-medium">
                💡 {item.highlight}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 요금제 ── */}
      <div className="mb-10">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">API 요금제</h2>
          <p className="text-gray-500">파일럿 기간 중 스타터 플랜 3개월 무료 제공</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {PRICING_PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl border p-6 flex flex-col ${
                plan.highlight
                  ? 'border-green-500 bg-green-50 shadow-lg shadow-green-100 relative'
                  : 'border-gray-200 bg-white'
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                  추천
                </div>
              )}
              <div className="mb-4">
                <div className="font-bold text-gray-900 text-lg">{plan.name}</div>
                <div className={`text-2xl font-bold mt-1 ${plan.highlight ? 'text-green-700' : 'text-gray-900'}`}>
                  {plan.price}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{plan.unit}</div>
                <div className={`mt-2 text-xs px-2.5 py-1 rounded-lg font-medium ${plan.highlight ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                  👤 {plan.target}
                </div>
              </div>
              <ul className="space-y-2.5 flex-1 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                    <CheckCircle2 className={`w-4 h-4 flex-shrink-0 mt-0.5 ${plan.highlight ? 'text-green-600' : 'text-gray-400'}`} />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 ${
                  plan.highlight
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                }`}
              >
                {plan.cta}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── CTA ── */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl p-8 text-white text-center">
        <h2 className="text-2xl font-bold mb-2">파일럿 API 제휴 문의</h2>
        <p className="text-green-100 mb-6">
          3개월 무료 파일럿으로 시작하세요. 기술 연동부터 데이터 검증까지 전담 지원합니다.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="mailto:contact@greenreach.kr"
            className="inline-flex items-center justify-center gap-2 bg-white text-green-800 font-bold px-6 py-3 rounded-xl hover:bg-green-50 transition-colors"
          >
            <Mail className="w-4 h-4" />
            이메일 문의
          </a>
          <a
            href="tel:010-0000-0000"
            className="inline-flex items-center justify-center gap-2 border-2 border-white/50 text-white font-semibold px-6 py-3 rounded-xl hover:bg-white/10 transition-colors"
          >
            <Phone className="w-4 h-4" />
            전화 상담
          </a>
        </div>
        <p className="text-green-200 text-xs mt-4">
          현재 파일럿 파트너사 모집 중 · 선착순 3개사 무료 제공
        </p>
      </div>

    </div>
  );
}
