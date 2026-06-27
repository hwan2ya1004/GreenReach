import { Link } from 'react-router-dom';
import { MapPin, BarChart3, Brain, LayoutDashboard, ChevronRight, Leaf, Users, Star, Share2, Code2, Building2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const features = [
  {
    icon: <MapPin className="w-7 h-7 text-green-600" />,
    title: '실제 도보 거리 분석',
    desc: '직선거리가 아닌 실제 보행 경로 기반으로 가장 가까운 공원까지의 거리를 계산합니다.',
  },
  {
    icon: <BarChart3 className="w-7 h-7 text-green-600" />,
    title: '녹지 접근성 점수',
    desc: '거리·공원 밀도·면적을 종합한 0~100점 접근성 지수로 내 동네 녹지 환경을 한눈에 확인하세요.',
  },
  {
    icon: <Brain className="w-7 h-7 text-green-600" />,
    title: 'AI 녹지 어시스턴트',
    desc: 'RandomForest·KNN·TF-IDF 기반 질의응답 모델로 "전국에서 녹지가 가장 좋은 곳은?", "이사 추천 지역" 등을 물어보세요. (데모 단계)',
  },
  {
    icon: <LayoutDashboard className="w-7 h-7 text-green-600" />,
    title: '시군구 통계 대시보드',
    desc: '시군구 단위 공원 수·면적·1인당 녹지 면적을 비교한 통계 대시보드로 지역 간 녹지 격차를 한눈에 확인합니다.',
  },
];

const stats = [
  { value: '전국', label: '지역 분석 범위' },
  { value: '0~100', label: '접근성 점수 체계' },
  { value: '무료', label: 'B2C 무료 운영' },
];

function CountUp({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const duration = 1800;
          const startTime = performance.now();

          const tick = (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // easeOutExpo
            const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
            setCount(Math.floor(eased * target));
            if (progress < 1) requestAnimationFrame(tick);
          };

          requestAnimationFrame(tick);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [target]);

  return (
    <div ref={ref} className="text-3xl font-bold text-green-700">
      {count.toLocaleString()}{suffix}
    </div>
  );
}

// 부동산 앱 비교표
const comparisons = [
  { item: '녹지 접근성 점수', zigbang: '없음', dabang: '없음', hogaeng: '없음', asil: '없음', gr: '있음 ✓' },
  { item: '실제 도보 거리 기반', zigbang: '없음 (직선거리)', dabang: '없음', hogaeng: '없음', asil: '없음', gr: '있음 ✓' },
  { item: '전국 공원 데이터', zigbang: '일부', dabang: '일부', hogaeng: '일부', asil: '일부', gr: '16,999개 전국' },
  { item: 'AI 녹지 어시스턴트', zigbang: '없음', dabang: '없음', hogaeng: '없음', asil: '없음', gr: '있음 ✓' },
  { item: '무료 시민 서비스', zigbang: '없음', dabang: '없음', hogaeng: '없음', asil: '없음', gr: '있음 ✓' },
];

export default function Landing() {
  return (
    <div className="overflow-x-hidden">
      {/* 히어로 섹션 */}
      <section className="relative bg-gradient-to-br from-green-900 via-green-800 to-emerald-700 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-green-300 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-green-700/50 border border-green-500/30 rounded-full px-4 py-1.5 text-sm text-green-200 mb-6">
              <Leaf className="w-4 h-4" />
              <span>2026 KAMCO Startup TechBlaze 출품작</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
              내 주변 공원이<br />
              <span className="text-green-300">얼마나 가까운지,</span><br />
              데이터로 보여드립니다
            </h1>
            <p className="text-lg sm:text-xl text-green-100 mb-8 leading-relaxed">
              위치정보 기반으로 실제 도보 거리를 분석하여<br className="hidden sm:block" />
              녹지 접근성 점수를 제공하는 LBS 기반 시민 플랫폼
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                to="/map"
                className="inline-flex items-center justify-center gap-2 bg-white text-green-800 font-bold px-8 py-4 rounded-xl hover:bg-green-50 transition-colors text-lg shadow-lg"
              >
                <MapPin className="w-5 h-5" />
                내 위치 분석하기
                <ChevronRight className="w-5 h-5" />
              </Link>
              <Link
                to="/dashboard"
                className="inline-flex items-center justify-center gap-2 bg-green-700/50 border border-green-400/30 text-white font-semibold px-8 py-4 rounded-xl hover:bg-green-700 transition-colors text-lg"
              >
                <LayoutDashboard className="w-5 h-5" />
                시군구 대시보드
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 통계 배너 */}
      <section className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {/* 16,999개 카운트업 */}
            <div className="text-center">
              <CountUp target={16999} suffix="개" />
              <div className="text-sm text-gray-500 mt-1">전국 공원 데이터</div>
            </div>
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-3xl font-bold text-green-700">{s.value}</div>
                <div className="text-sm text-gray-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 문제 정의 섹션 */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              녹지 불평등, 데이터로 드러납니다
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              그린피스 2026년 6월 발표 자료 기준 — 서울 시민의 녹지 접근 현실
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-red-50 border border-red-100 rounded-xl p-6">
              <div className="text-4xl font-bold text-red-600 mb-2">24만 5천명</div>
              <div className="font-semibold text-gray-800 mb-2">WHO 권고 기준 300m 내 녹지 미접근</div>
              <div className="text-sm text-gray-600">서울 시민 중 WHO 권고 기준(300m) 내에서 녹지를 누리지 못하는 인구입니다.</div>
            </div>
            <div className="bg-orange-50 border border-orange-100 rounded-xl p-6">
              <div className="text-4xl font-bold text-orange-600 mb-2">420만명</div>
              <div className="font-semibold text-gray-800 mb-2">100m 기준으로 좁히면</div>
              <div className="text-sm text-gray-600">기준을 100m로 좁히면 서울 시민 420만 명이 녹지 접근 취약 상태에 놓입니다.</div>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-6">
              <div className="text-4xl font-bold text-blue-600 mb-2">0개</div>
              <div className="font-semibold text-gray-800 mb-2">부동산 앱의 녹지 접근성 지표</div>
              <div className="text-sm text-gray-600">직방·다방·호갱노노·아실 등 부동산 플랫폼은 학군·교통 점수는 제공하나 녹지 접근성 지표는 전무합니다.</div>
            </div>
          </div>
        </div>
      </section>

      {/* 핵심 기능 섹션 */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">GreenReach의 핵심 기능</h2>
            <p className="text-gray-600">위치정보 기술로 녹지 접근성을 정확하게 분석합니다</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f) => (
              <div key={f.title} className="bg-gray-50 rounded-xl p-6 hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-4">
                  {f.icon}
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 경쟁 비교 섹션 */}
      <section className="py-20 bg-green-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">기존 부동산 앱과의 차이</h2>
            <p className="text-gray-600">직방·다방·호갱노노·아실에는 없는 녹지 접근성 데이터, GreenReach가 채웁니다</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">구분</th>
                  <th className="text-center px-4 py-4 text-sm font-semibold text-gray-600">직방</th>
                  <th className="text-center px-4 py-4 text-sm font-semibold text-gray-600">다방</th>
                  <th className="text-center px-4 py-4 text-sm font-semibold text-gray-600">호갱노노</th>
                  <th className="text-center px-4 py-4 text-sm font-semibold text-gray-600">아실</th>
                  <th className="text-center px-4 py-4 text-sm font-bold text-green-700 bg-green-50">GreenReach ★</th>
                </tr>
              </thead>
              <tbody>
                {comparisons.map((row, i) => (
                  <tr key={row.item} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="px-6 py-4 text-sm font-medium text-gray-700">{row.item}</td>
                    <td className="px-4 py-4 text-sm text-center text-gray-500">{row.zigbang}</td>
                    <td className="px-4 py-4 text-sm text-center text-gray-500">{row.dabang}</td>
                    <td className="px-4 py-4 text-sm text-center text-gray-500">{row.hogaeng}</td>
                    <td className="px-4 py-4 text-sm text-center text-gray-500">{row.asil}</td>
                    <td className="px-4 py-4 text-sm text-center font-semibold text-green-700 bg-green-50/50">{row.gr}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-center text-xs text-gray-400 mt-4">
            * GreenReach의 녹지 접근성 점수 API를 부동산 플랫폼에 제공하여 B2B 수익 창출
          </p>
        </div>
      </section>

      {/* 타겟 고객 섹션 */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">누구를 위한 서비스인가요?</h2>
            <p className="text-gray-600">B2C 무료 운영으로 트래픽·데이터를 확보하고, B2B API 제휴로 수익을 창출합니다</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {/* B2C */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-8 border border-green-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="font-bold text-gray-900">시민 (B2C)</div>
                  <div className="text-sm text-gray-500">일반 시민 누구나 · 무료</div>
                </div>
              </div>
              <ul className="space-y-3 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>내 동네 녹지 점수 즉시 확인</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>이사 전 동네 녹지 환경 비교</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>아이·노인·반려동물 맞춤 공원 추천</span>
                </li>
              </ul>
              <div className="mt-4 text-xs text-green-700 bg-green-100 rounded-lg px-3 py-2">
                💡 무료 운영으로 사용자 행동·이동 경로 데이터 축적
              </div>
              <Link to="/map" className="mt-4 inline-flex items-center gap-2 bg-green-600 text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-green-700 transition-colors text-sm">
                내 위치 분석하기 <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            {/* B2B 1차: 부동산 플랫폼 */}
            <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-2xl p-8 border border-purple-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center">
                  <Code2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="font-bold text-gray-900">부동산 플랫폼 (B2B 1차)</div>
                  <div className="text-sm text-gray-500">직방·다방·호갱노노·아실 등</div>
                </div>
              </div>
              <ul className="space-y-3 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-purple-600 mt-0.5">✓</span>
                  <span>매물 페이지 내 "녹지 접근성 점수" API 제공</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600 mt-0.5">✓</span>
                  <span>"공원까지 도보 O분" 위젯 형태 연동</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600 mt-0.5">✓</span>
                  <span>전국 16,999개 공원 실시간 데이터 연동</span>
                </li>
              </ul>
              <div className="mt-4 text-xs text-purple-700 bg-purple-100 rounded-lg px-3 py-2">
                💡 구독 또는 사용량 기반 과금 (메인 수익모델)
              </div>
              <div className="mt-4 inline-flex items-center gap-2 bg-purple-100 text-purple-700 font-semibold px-5 py-2.5 rounded-lg text-sm">
                <Code2 className="w-4 h-4" />
                파일럿 API 제휴 추진 예정
              </div>
            </div>
            {/* B2B 2차: 건설사·시행사 + ESG */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-8 border border-blue-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="font-bold text-gray-900">건설사·ESG (B2B 2·3차)</div>
                  <div className="text-sm text-gray-500">건설사·시행사 / ESG 컨설팅사</div>
                </div>
              </div>
              <ul className="space-y-3 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">✓</span>
                  <span>신축 분양 마케팅 자료 — 녹지 접근성 데이터 근거</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">✓</span>
                  <span>ESG 공시 의무화 대응 환경 지표 제공</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">✓</span>
                  <span>탄소중립 정책 연계 녹지 환경 분석</span>
                </li>
              </ul>
              <div className="mt-4 text-xs text-blue-700 bg-blue-100 rounded-lg px-3 py-2">
                💡 ESG 공시 의무화·탄소중립 정책 확산으로 수요 증가
              </div>
              <Link to="/dashboard" className="mt-4 inline-flex items-center gap-2 bg-blue-600 text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors text-sm">
                대시보드 보기 <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* SNS 공유 유도 섹션 */}
      <section className="py-16 bg-green-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Share2 className="w-10 h-10 mx-auto mb-4 text-green-600" />
          <h2 className="text-2xl font-bold text-gray-900 mb-3">내 동네 녹지 점수는?</h2>
          <p className="text-gray-600 mb-8">
            "우리 동네 녹지 점수가 몇 점인지 알아?" — SNS 공유 한 번으로 이웃의 관심을 이끌어냅니다
          </p>
          <div className="grid sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
            {[
              { emoji: '👶', label: '영유아 부모', desc: '아이 산책시키기 좋은 공원 찾기' },
              { emoji: '🏠', label: '이사 예정자', desc: '이사 전 동네 녹지 환경 미리 확인' },
              { emoji: '🐕', label: '반려동물 보호자', desc: '반려동물 동반 가능 공원 탐색' },
            ].map((item) => (
              <div key={item.label} className="bg-white rounded-xl p-5 shadow-sm border border-green-100">
                <div className="text-3xl mb-2">{item.emoji}</div>
                <div className="font-semibold text-gray-800 text-sm mb-1">{item.label}</div>
                <div className="text-xs text-gray-500">{item.desc}</div>
              </div>
            ))}
          </div>
          <Link
            to="/map"
            className="mt-8 inline-flex items-center gap-2 bg-green-600 text-white font-bold px-8 py-3 rounded-xl hover:bg-green-700 transition-colors"
          >
            <Share2 className="w-4 h-4" />
            내 동네 점수 확인하고 공유하기
          </Link>
        </div>
      </section>

      {/* CTA 섹션 */}
      <section className="py-20 bg-gradient-to-r from-green-600 to-emerald-600 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <Star className="w-12 h-12 mx-auto mb-4 text-yellow-300" />
          <h2 className="text-3xl font-bold mb-4">지금 바로 내 동네 녹지 점수를 확인하세요</h2>
          <p className="text-green-100 mb-8 text-lg">
            전국 16,999개 공원 데이터로 실제 도보 접근성을 분석합니다
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/map"
              className="inline-flex items-center justify-center gap-2 bg-white text-green-800 font-bold px-8 py-4 rounded-xl hover:bg-green-50 transition-colors text-lg shadow-lg"
            >
              <MapPin className="w-5 h-5" />
              내 위치 분석 시작
            </Link>
            <Link
              to="/compare"
              className="inline-flex items-center justify-center gap-2 border-2 border-white/50 text-white font-semibold px-8 py-4 rounded-xl hover:bg-white/10 transition-colors text-lg"
            >
              동네 비교하기
            </Link>
          </div>
        </div>
      </section>

      {/* 푸터 */}
      <footer className="bg-gray-900 text-gray-400 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-white font-bold">
              <Leaf className="w-5 h-5 text-green-500" />
              <span>GreenReach · 그린리치</span>
            </div>
            <div className="text-sm text-center">
              위치정보 기반 도시 녹지 접근성 시민 플랫폼<br />
              공공데이터포털 · VWorld · OpenStreetMap 데이터 활용
            </div>
            <div className="text-sm flex flex-col items-end gap-1">
              <span>© 2026 GreenReach</span>
              <Link
                to="/feedback"
                className="text-xs text-gray-600 hover:text-gray-400 transition-colors flex items-center gap-1"
              >
                🔒 관리자
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
