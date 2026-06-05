import { Link } from 'react-router-dom';
import { MapPin, BarChart3, Brain, FileText, ChevronRight, Leaf, Users, Building2, Star } from 'lucide-react';
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
    title: 'AI 취약지 예측',
    desc: '인구 밀도, 고령화율, 보행 데이터를 학습하여 향후 녹지 수요 급증 지역을 사전에 예측합니다.',
  },
  {
    icon: <FileText className="w-7 h-7 text-green-600" />,
    title: '지자체 리포트 자동화',
    desc: '수작업 2~3주 → 자동 생성 1일. 구 단위 녹지 현황 보고서를 데이터 기반으로 자동 생성합니다.',
  },
];

const stats = [
  { value: '전국', label: '지역 분석 범위' },
  { value: '0~100', label: '접근성 점수 체계' },
  { value: '무료', label: '공공데이터 기반' },
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

const comparisons = [
  { item: '대상', lx: '전문가·부동산업자', smap: '서울시 공무원', gr: '전국 일반 시민' },
  { item: '지역', lx: '전국', smap: '서울만', gr: '전국 (서울 외 포함)' },
  { item: '접근성 분석', lx: '직선거리', smap: '제한적', gr: '실제 도보 경로' },
  { item: '시민용 앱', lx: '없음', smap: '없음', gr: '있음 ✓' },
  { item: 'AI 취약지 예측', lx: '없음', smap: '없음', gr: '있음 ✓' },
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
              <span>2026 LBS 스타트업 챌린지 출품작</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
              내 주변 공원이<br />
              <span className="text-green-300">얼마나 가까운지,</span><br />
              데이터로 보여드립니다
            </h1>
            <p className="text-lg sm:text-xl text-green-100 mb-8 leading-relaxed">
              위치정보(LBS) 기반으로 실제 도보 거리를 분석하여<br className="hidden sm:block" />
              녹지 접근성 점수를 제공하는 시민 플랫폼
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
                <Building2 className="w-5 h-5" />
                지자체 대시보드
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
              데이터는 이미 있었습니다
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              없었던 건 그것을 시민의 일상으로 연결하는 사람이었습니다.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-red-50 border border-red-100 rounded-xl p-6">
              <div className="text-4xl font-bold text-red-600 mb-2">40%</div>
              <div className="font-semibold text-gray-800 mb-2">도보 10분 내 공원 접근 불가</div>
              <div className="text-sm text-gray-600">전국 도시 인구의 상당수가 공원에 쉽게 접근하지 못하고 있습니다.</div>
            </div>
            <div className="bg-orange-50 border border-orange-100 rounded-xl p-6">
              <div className="text-4xl font-bold text-orange-600 mb-2">2~3주</div>
              <div className="font-semibold text-gray-800 mb-2">지자체 수작업 보고서 작성</div>
              <div className="text-sm text-gray-600">담당자가 엑셀로 수작업 작성. 직선거리 기준이라 실제 접근성 미반영.</div>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-6">
              <div className="text-4xl font-bold text-blue-600 mb-2">0개</div>
              <div className="font-semibold text-gray-800 mb-2">국내 시민용 공원 접근성 앱</div>
              <div className="text-sm text-gray-600">앱스토어 전수 조사 결과, 공원 접근성 점수를 제공하는 앱이 단 하나도 없습니다.</div>
            </div>
          </div>
        </div>
      </section>

      {/* 핵심 기능 섹션 */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">GreenReach의 핵심 기능</h2>
            <p className="text-gray-600">위치정보(LBS) 기술로 녹지 접근성을 정확하게 분석합니다</p>
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
            <h2 className="text-3xl font-bold text-gray-900 mb-4">기존 서비스와의 차이</h2>
            <p className="text-gray-600">GreenReach는 기존 서비스가 해결하지 못한 공백을 채웁니다</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">구분</th>
                  <th className="text-center px-6 py-4 text-sm font-semibold text-gray-600">LX공사</th>
                  <th className="text-center px-6 py-4 text-sm font-semibold text-gray-600">서울 S-MAP</th>
                  <th className="text-center px-6 py-4 text-sm font-bold text-green-700 bg-green-50">GreenReach ★</th>
                </tr>
              </thead>
              <tbody>
                {comparisons.map((row, i) => (
                  <tr key={row.item} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="px-6 py-4 text-sm font-medium text-gray-700">{row.item}</td>
                    <td className="px-6 py-4 text-sm text-center text-gray-500">{row.lx}</td>
                    <td className="px-6 py-4 text-sm text-center text-gray-500">{row.smap}</td>
                    <td className="px-6 py-4 text-sm text-center font-semibold text-green-700 bg-green-50/50">{row.gr}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 타겟 고객 섹션 */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">누구를 위한 서비스인가요?</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-8 border border-green-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="font-bold text-gray-900">시민 (B2C)</div>
                  <div className="text-sm text-gray-500">일반 시민 누구나</div>
                </div>
              </div>
              <ul className="space-y-3 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>내 동네 녹지 점수가 몇 점인지 직관적으로 확인</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>이사 전 동네 녹지 환경 비교 (강동구 vs 송파구)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>아이·노인·반려동물 동반 맞춤 공원 추천</span>
                </li>
              </ul>
              <Link to="/map" className="mt-6 inline-flex items-center gap-2 bg-green-600 text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-green-700 transition-colors text-sm">
                내 위치 분석하기 <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-8 border border-blue-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="font-bold text-gray-900">지자체 (B2G)</div>
                  <div className="text-sm text-gray-500">구청 도시계획과·환경과</div>
                </div>
              </div>
              <ul className="space-y-3 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">✓</span>
                  <span>수작업 2~3주 → 자동 생성 1일로 단축</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">✓</span>
                  <span>데이터 기반 녹지 민원 대응 근거 자료</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">✓</span>
                  <span>신규 공원 조성 예산 신청 데이터 뒷받침</span>
                </li>
              </ul>
              <Link to="/dashboard" className="mt-6 inline-flex items-center gap-2 bg-blue-600 text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors text-sm">
                대시보드 보기 <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 정책 연계 섹션 */}
      <section className="py-16 bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold mb-3">정책 트렌드와 완벽히 연계</h2>
            <p className="text-gray-400">지금이 GreenReach가 존재해야 할 정확한 시점입니다</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: '🌿', title: '2030 탄소중립', desc: '도시 내 녹지 확충 의무화 → 지자체 녹지 데이터 수요 급증' },
              { icon: '🏙️', title: '15분 도시 정책', desc: '도보 생활권 서비스 접근성 이슈화 → GreenReach 정책 수혜' },
              { icon: '👴', title: '고령화 사회', desc: '노인 보행 가능 공원 접근성 수요 증가' },
              { icon: '📊', title: '공공데이터 개방', desc: '공공데이터 품질이 서비스화 가능한 수준으로 정비 완료' },
            ].map((item) => (
              <div key={item.title} className="bg-gray-800 rounded-xl p-5">
                <div className="text-3xl mb-3">{item.icon}</div>
                <div className="font-semibold text-white mb-2">{item.title}</div>
                <div className="text-sm text-gray-400">{item.desc}</div>
              </div>
            ))}
          </div>
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
              <span>© 2026 GreenReach. 2026 LBS 스타트업 챌린지</span>
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
