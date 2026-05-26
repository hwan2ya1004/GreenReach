import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar } from 'recharts';
import { ArrowLeftRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { DISTRICT_STATS } from '../data/districtStats';
import { getScoreColor, getScoreBgColor } from '../utils/accessibility';

const DISTRICTS = DISTRICT_STATS.map((d) => d.district).sort();

export default function Compare() {
  const [districtA, setDistrictA] = useState('강남구');
  const [districtB, setDistrictB] = useState('금천구');

  const statA = DISTRICT_STATS.find((d) => d.district === districtA)!;
  const statB = DISTRICT_STATS.find((d) => d.district === districtB)!;

  const barData = [
    { name: '접근성 점수', A: statA.avgScore, B: statB.avgScore, max: 100 },
    { name: '공원 수', A: statA.parkCount, B: statB.parkCount, max: 15 },
    { name: '1인당 녹지(㎡)', A: Math.round(statA.greenAreaPerCapita), B: Math.round(statB.greenAreaPerCapita), max: 40 },
    { name: '취약지역(%)', A: statA.vulnerableRatio, B: statB.vulnerableRatio, max: 50 },
  ];

  const radarData = [
    { subject: '접근성', A: statA.avgScore, B: statB.avgScore },
    { subject: '공원밀도', A: Math.min(100, statA.parkCount * 8), B: Math.min(100, statB.parkCount * 8) },
    { subject: '1인당녹지', A: Math.min(100, statA.greenAreaPerCapita * 2.5), B: Math.min(100, statB.greenAreaPerCapita * 2.5) },
    { subject: '취약지역↓', A: 100 - statA.vulnerableRatio * 2, B: 100 - statB.vulnerableRatio * 2 },
    { subject: '인구규모', A: Math.min(100, statA.population / 7000), B: Math.min(100, statB.population / 7000) },
  ];

  const compareItems = [
    { label: '녹지 접근성 점수', keyA: statA.avgScore, keyB: statB.avgScore, unit: '점', higherIsBetter: true },
    { label: '공원 수', keyA: statA.parkCount, keyB: statB.parkCount, unit: '개', higherIsBetter: true },
    { label: '총 녹지 면적', keyA: Math.round(statA.totalArea / 10000), keyB: Math.round(statB.totalArea / 10000), unit: 'ha', higherIsBetter: true },
    { label: '1인당 녹지 면적', keyA: statA.greenAreaPerCapita, keyB: statB.greenAreaPerCapita, unit: '㎡', higherIsBetter: true },
    { label: '인구', keyA: Math.round(statA.population / 10000), keyB: Math.round(statB.population / 10000), unit: '만명', higherIsBetter: false },
    { label: '취약 지역 비율', keyA: statA.vulnerableRatio, keyB: statB.vulnerableRatio, unit: '%', higherIsBetter: false },
  ];

  function CompareIcon({ a, b, higherIsBetter }: { a: number; b: number; higherIsBetter: boolean }) {
    if (a === b) return <Minus className="w-4 h-4 text-gray-400" />;
    const aWins = higherIsBetter ? a > b : a < b;
    if (aWins) return <TrendingUp className="w-4 h-4 text-green-600" />;
    return <TrendingDown className="w-4 h-4 text-red-500" />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">동네 녹지 환경 비교</h1>
        <p className="text-gray-600">두 자치구의 녹지 접근성을 비교하여 이사 전 환경을 확인하세요</p>
      </div>

      {/* 구 선택 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="flex-1 w-full">
            <label className="block text-sm font-medium text-gray-700 mb-2">비교 구 A</label>
            <select
              value={districtA}
              onChange={(e) => setDistrictA(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 bg-green-50"
            >
              {DISTRICTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-center">
            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
              <ArrowLeftRight className="w-5 h-5 text-gray-500" />
            </div>
          </div>
          <div className="flex-1 w-full">
            <label className="block text-sm font-medium text-gray-700 mb-2">비교 구 B</label>
            <select
              value={districtB}
              onChange={(e) => setDistrictB(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-blue-50"
            >
              {DISTRICTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 점수 카드 */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-2xl shadow-sm border border-green-100 p-6 text-center">
          <div className="text-lg font-bold text-gray-800 mb-3">{districtA}</div>
          <div
            className="text-5xl font-bold mb-2"
            style={{ color: getScoreColor(statA.avgScore) }}
          >
            {statA.avgScore}
          </div>
          <div className="text-sm text-gray-500">접근성 점수</div>
          <div className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold ${getScoreBgColor(statA.avgScore)}`}>
            {statA.avgScore >= 70 ? '우수' : statA.avgScore >= 55 ? '보통' : '취약'}
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-blue-100 p-6 text-center">
          <div className="text-lg font-bold text-gray-800 mb-3">{districtB}</div>
          <div
            className="text-5xl font-bold mb-2"
            style={{ color: getScoreColor(statB.avgScore) }}
          >
            {statB.avgScore}
          </div>
          <div className="text-sm text-gray-500">접근성 점수</div>
          <div className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold ${getScoreBgColor(statB.avgScore)}`}>
            {statB.avgScore >= 70 ? '우수' : statB.avgScore >= 55 ? '보통' : '취약'}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* 레이더 차트 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-bold text-gray-800 mb-4">종합 비교 (레이더)</h2>
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
              <Radar name={districtA} dataKey="A" stroke="#16a34a" fill="#16a34a" fillOpacity={0.2} />
              <Radar name={districtB} dataKey="B" stroke="#2563eb" fill="#2563eb" fillOpacity={0.2} />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-6 mt-2 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-600" />
              <span>{districtA}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-600" />
              <span>{districtB}</span>
            </div>
          </div>
        </div>

        {/* 막대 차트 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-bold text-gray-800 mb-4">항목별 비교</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={barData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={80} />
              <Tooltip />
              <Bar dataKey="A" name={districtA} fill="#16a34a" radius={[0, 4, 4, 0]} />
              <Bar dataKey="B" name={districtB} fill="#2563eb" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 상세 비교 테이블 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-800">상세 지표 비교</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left px-6 py-3 text-sm font-semibold text-gray-600">지표</th>
              <th className="text-center px-6 py-3 text-sm font-semibold text-green-700">{districtA}</th>
              <th className="text-center px-6 py-3 text-sm font-semibold text-gray-400">비교</th>
              <th className="text-center px-6 py-3 text-sm font-semibold text-blue-700">{districtB}</th>
            </tr>
          </thead>
          <tbody>
            {compareItems.map((item, i) => (
              <tr key={item.label} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                <td className="px-6 py-4 text-sm font-medium text-gray-700">{item.label}</td>
                <td className="px-6 py-4 text-center">
                  <span className={`text-sm font-bold ${
                    item.higherIsBetter
                      ? item.keyA > item.keyB ? 'text-green-700' : item.keyA < item.keyB ? 'text-red-500' : 'text-gray-600'
                      : item.keyA < item.keyB ? 'text-green-700' : item.keyA > item.keyB ? 'text-red-500' : 'text-gray-600'
                  }`}>
                    {item.keyA}{item.unit}
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                  <div className="flex justify-center">
                    <CompareIcon a={item.keyA} b={item.keyB} higherIsBetter={item.higherIsBetter} />
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={`text-sm font-bold ${
                    item.higherIsBetter
                      ? item.keyB > item.keyA ? 'text-blue-700' : item.keyB < item.keyA ? 'text-red-500' : 'text-gray-600'
                      : item.keyB < item.keyA ? 'text-blue-700' : item.keyB > item.keyA ? 'text-red-500' : 'text-gray-600'
                  }`}>
                    {item.keyB}{item.unit}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 결론 */}
      <div className="mt-6 bg-gradient-to-r from-green-50 to-blue-50 rounded-2xl p-6 border border-green-100">
        <h3 className="font-bold text-gray-800 mb-3">📊 분석 결론</h3>
        <div className="text-sm text-gray-700 leading-relaxed">
          {statA.avgScore > statB.avgScore ? (
            <p>
              <strong className="text-green-700">{districtA}</strong>가 <strong className="text-blue-700">{districtB}</strong>보다
              녹지 접근성이 <strong>{statA.avgScore - statB.avgScore}점</strong> 높습니다.
              {statA.greenAreaPerCapita > statB.greenAreaPerCapita
                ? ` 1인당 녹지 면적도 ${(statA.greenAreaPerCapita - statB.greenAreaPerCapita).toFixed(1)}㎡ 더 넓어 전반적으로 녹지 환경이 우수합니다.`
                : ` 다만 1인당 녹지 면적은 ${districtB}가 더 넓습니다.`}
            </p>
          ) : statA.avgScore < statB.avgScore ? (
            <p>
              <strong className="text-blue-700">{districtB}</strong>가 <strong className="text-green-700">{districtA}</strong>보다
              녹지 접근성이 <strong>{statB.avgScore - statA.avgScore}점</strong> 높습니다.
              {statB.greenAreaPerCapita > statA.greenAreaPerCapita
                ? ` 1인당 녹지 면적도 ${(statB.greenAreaPerCapita - statA.greenAreaPerCapita).toFixed(1)}㎡ 더 넓어 전반적으로 녹지 환경이 우수합니다.`
                : ` 다만 1인당 녹지 면적은 ${districtA}가 더 넓습니다.`}
            </p>
          ) : (
            <p>두 구의 녹지 접근성 점수가 동일합니다. 세부 지표를 비교하여 선택하세요.</p>
          )}
        </div>
      </div>
    </div>
  );
}
