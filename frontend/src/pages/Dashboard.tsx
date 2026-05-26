import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Building2, AlertTriangle, TrendingUp, Download, MessageSquare, Send, Brain } from 'lucide-react';
import { DISTRICT_STATS, VULNERABLE_ZONES } from '../data/districtStats';
import { getScoreColor, getScoreBgColor } from '../utils/accessibility';
import type { ChatMessage } from '../types';

// AI 챗봇 응답 로직
function generateAIResponse(question: string): string {
  const q = question.toLowerCase();

  if (q.includes('가장') && (q.includes('좋') || q.includes('높') || q.includes('우수'))) {
    const best = [...DISTRICT_STATS].sort((a, b) => b.avgScore - a.avgScore)[0];
    return `서울에서 녹지 접근성이 가장 우수한 구는 **${best.district}**입니다. 평균 접근성 점수 ${best.avgScore}점으로, 1인당 녹지 면적이 ${best.greenAreaPerCapita}㎡에 달합니다.`;
  }

  if (q.includes('가장') && (q.includes('나쁘') || q.includes('낮') || q.includes('취약') || q.includes('최하'))) {
    const worst = [...DISTRICT_STATS].sort((a, b) => a.avgScore - b.avgScore)[0];
    return `서울에서 녹지 접근성이 가장 취약한 구는 **${worst.district}**입니다. 평균 접근성 점수 ${worst.avgScore}점으로, 취약 지역 비율이 ${worst.vulnerableRatio}%에 달합니다. 즉각적인 녹지 확충이 필요합니다.`;
  }

  if (q.includes('강남') || q.includes('서초') || q.includes('송파')) {
    const district = DISTRICT_STATS.find(d => q.includes(d.district.replace('구', '')));
    if (district) {
      return `**${district.district}**의 녹지 접근성 점수는 ${district.avgScore}점입니다. 공원 수 ${district.parkCount}개, 1인당 녹지 면적 ${district.greenAreaPerCapita}㎡로 ${district.avgScore >= 70 ? '우수한 편' : '개선이 필요한'}입니다.`;
    }
  }

  // 특정 구 검색
  for (const stat of DISTRICT_STATS) {
    if (q.includes(stat.district) || q.includes(stat.district.replace('구', ''))) {
      return `**${stat.district}**의 녹지 현황:\n• 접근성 점수: ${stat.avgScore}점\n• 공원 수: ${stat.parkCount}개\n• 1인당 녹지 면적: ${stat.greenAreaPerCapita}㎡\n• 취약 지역 비율: ${stat.vulnerableRatio}%\n\n${stat.avgScore >= 70 ? '전반적으로 양호한 녹지 환경입니다.' : stat.avgScore >= 55 ? '일부 지역 개선이 필요합니다.' : '녹지 접근성 개선이 시급합니다.'}`;
    }
  }

  if (q.includes('취약') || q.includes('위험') || q.includes('개선')) {
    const topVulnerable = VULNERABLE_ZONES.filter(z => z.riskLevel === 'high').slice(0, 3);
    return `현재 녹지 접근성 취약 지역 TOP 3:\n${topVulnerable.map((z, i) => `${i + 1}. ${z.district} ${z.dong} (점수: ${z.score}점, 고령화율: ${z.elderlyRatio}%)`).join('\n')}\n\n이 지역들은 AI 예측 모델에서 향후 녹지 수요가 급증할 것으로 예측됩니다.`;
  }

  if (q.includes('평균') || q.includes('서울')) {
    const avg = Math.round(DISTRICT_STATS.reduce((s, d) => s + d.avgScore, 0) / DISTRICT_STATS.length);
    return `서울시 전체 평균 녹지 접근성 점수는 **${avg}점**입니다. 25개 자치구 중 70점 이상 우수 구는 ${DISTRICT_STATS.filter(d => d.avgScore >= 70).length}개, 50점 미만 취약 구는 ${DISTRICT_STATS.filter(d => d.avgScore < 50).length}개입니다.`;
  }

  if (q.includes('공원') && q.includes('추천')) {
    return `공원 추천은 **내 동네 분석** 페이지에서 확인하세요! 현재 위치 기반으로 아이 동반, 반려동물, 장애인 접근 가능 여부를 필터링하여 맞춤 공원을 추천해드립니다.`;
  }

  return `죄송합니다, 질문을 이해하지 못했습니다. 다음과 같이 질문해보세요:\n• "서울에서 녹지가 가장 좋은 구는?"\n• "금천구 녹지 현황 알려줘"\n• "취약 지역 어디야?"\n• "서울 평균 점수는?"`;
}

export default function Dashboard() {
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: '0',
      role: 'assistant',
      content: '안녕하세요! 그린리치 AI 어시스턴트입니다. 서울시 녹지 접근성에 대해 무엇이든 물어보세요.\n\n예: "서울에서 녹지가 가장 좋은 구는?" 또는 "강남구 녹지 현황 알려줘"',
      timestamp: new Date(),
    },
  ]);
  const [chatInput, setChatInput] = useState('');

  const sortedDistricts = [...DISTRICT_STATS].sort((a, b) => b.avgScore - a.avgScore);
  const selectedStat = selectedDistrict ? DISTRICT_STATS.find(d => d.district === selectedDistrict) : null;

  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: chatInput,
      timestamp: new Date(),
    };
    const aiMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: generateAIResponse(chatInput),
      timestamp: new Date(),
    };
    setChatMessages(prev => [...prev, userMsg, aiMsg]);
    setChatInput('');
  };

  const handleDownloadReport = () => {
    const district = selectedDistrict ?? '서울시 전체';
    const stats = selectedStat ?? null;
    const content = stats
      ? `GreenReach 녹지 접근성 리포트\n\n구: ${stats.district}\n접근성 점수: ${stats.avgScore}점\n공원 수: ${stats.parkCount}개\n총 녹지 면적: ${(stats.totalArea / 10000).toFixed(0)}ha\n1인당 녹지 면적: ${stats.greenAreaPerCapita}㎡\n인구: ${(stats.population / 10000).toFixed(0)}만명\n취약 지역 비율: ${stats.vulnerableRatio}%\n\n생성일: ${new Date().toLocaleDateString('ko-KR')}\n© 2026 GreenReach`
      : `GreenReach 서울시 녹지 접근성 종합 리포트\n\n생성일: ${new Date().toLocaleDateString('ko-KR')}\n\n${sortedDistricts.map((d, i) => `${i + 1}. ${d.district}: ${d.avgScore}점`).join('\n')}\n\n© 2026 GreenReach`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GreenReach_${district}_리포트_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-blue-600" />
            지자체 녹지 현황 대시보드
          </h1>
          <p className="text-gray-600 mt-1">서울시 25개 자치구 녹지 접근성 현황 및 AI 취약지 예측</p>
        </div>
        <button
          onClick={handleDownloadReport}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2.5 rounded-xl transition-colors text-sm"
        >
          <Download className="w-4 h-4" />
          리포트 다운로드
        </button>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: '서울 평균 점수', value: `${Math.round(DISTRICT_STATS.reduce((s, d) => s + d.avgScore, 0) / DISTRICT_STATS.length)}점`, color: 'text-green-700', bg: 'bg-green-50' },
          { label: '취약 구 수', value: `${DISTRICT_STATS.filter(d => d.avgScore < 50).length}개`, color: 'text-red-600', bg: 'bg-red-50' },
          { label: '고위험 취약지', value: `${VULNERABLE_ZONES.filter(z => z.riskLevel === 'high').length}개 동`, color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: '분석 공원 수', value: '70+개', color: 'text-blue-700', bg: 'bg-blue-50' },
        ].map((item) => (
          <div key={item.label} className={`${item.bg} rounded-xl p-4`}>
            <div className={`text-2xl font-bold ${item.color}`}>{item.value}</div>
            <div className="text-sm text-gray-600 mt-1">{item.label}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* 구별 점수 차트 */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-600" />
            자치구별 녹지 접근성 점수
          </h2>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={sortedDistricts} margin={{ top: 5, right: 10, left: -20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="district"
                tick={{ fontSize: 10 }}
                angle={-45}
                textAnchor="end"
                interval={0}
              />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value) => [`${value}점`, '접근성 점수']}
                labelStyle={{ fontWeight: 'bold' }}
              />
              <Bar dataKey="avgScore" radius={[4, 4, 0, 0]} onClick={(data) => setSelectedDistrict(data.district)}>
                {sortedDistricts.map((entry) => (
                  <Cell
                    key={entry.district}
                    fill={getScoreColor(entry.avgScore)}
                    opacity={selectedDistrict === null || selectedDistrict === entry.district ? 1 : 0.4}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-gray-400 text-center mt-2">막대를 클릭하면 상세 정보를 확인할 수 있습니다</p>
        </div>

        {/* 구 상세 / 취약지 목록 */}
        <div className="space-y-4">
          {/* 선택된 구 상세 */}
          {selectedStat ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-800">{selectedStat.district} 상세</h3>
                <button onClick={() => setSelectedDistrict(null)} className="text-xs text-gray-400 hover:text-gray-600">닫기</button>
              </div>
              <div className="text-center mb-4">
                <div className="text-4xl font-bold" style={{ color: getScoreColor(selectedStat.avgScore) }}>
                  {selectedStat.avgScore}
                </div>
                <div className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-semibold ${getScoreBgColor(selectedStat.avgScore)}`}>
                  {selectedStat.avgScore >= 70 ? '우수' : selectedStat.avgScore >= 55 ? '보통' : '취약'}
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">공원 수</span><span className="font-medium">{selectedStat.parkCount}개</span></div>
                <div className="flex justify-between"><span className="text-gray-500">총 녹지 면적</span><span className="font-medium">{(selectedStat.totalArea / 10000).toFixed(0)}ha</span></div>
                <div className="flex justify-between"><span className="text-gray-500">1인당 녹지</span><span className="font-medium">{selectedStat.greenAreaPerCapita}㎡</span></div>
                <div className="flex justify-between"><span className="text-gray-500">인구</span><span className="font-medium">{(selectedStat.population / 10000).toFixed(0)}만명</span></div>
                <div className="flex justify-between"><span className="text-gray-500">취약 지역 비율</span><span className="font-medium text-red-600">{selectedStat.vulnerableRatio}%</span></div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-bold text-gray-800 mb-3">순위 TOP 5</h3>
              <div className="space-y-2">
                {sortedDistricts.slice(0, 5).map((d, i) => (
                  <div key={d.district} className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 rounded-lg p-1.5" onClick={() => setSelectedDistrict(d.district)}>
                    <span className="text-sm font-bold text-gray-400 w-4">{i + 1}</span>
                    <span className="text-sm font-medium text-gray-800 flex-1">{d.district}</span>
                    <span className="text-sm font-bold" style={{ color: getScoreColor(d.avgScore) }}>{d.avgScore}점</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI 취약지 예측 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
              <Brain className="w-4 h-4 text-purple-600" />
              AI 취약지 예측 TOP 5
            </h3>
            <div className="space-y-2">
              {VULNERABLE_ZONES.slice(0, 5).map((zone) => (
                <div key={zone.id} className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${zone.riskLevel === 'high' ? 'bg-red-500' : 'bg-orange-400'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-gray-800 truncate">{zone.district} {zone.dong}</div>
                    <div className="text-xs text-gray-500">점수 {zone.score}점 · 고령화 {zone.elderlyRatio}%</div>
                  </div>
                  <div className="text-xs font-bold text-red-600 flex-shrink-0">+{zone.predictedDemand}%</div>
                </div>
              ))}
            </div>
            <div className="mt-3 text-xs text-gray-400 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              AI 예측 수요 증가율 기준
            </div>
          </div>
        </div>
      </div>

      {/* 전체 구 목록 테이블 */}
      <div className="mt-6 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-800">서울시 25개 자치구 전체 현황</h2>
          <span className="text-xs text-gray-400">클릭하여 상세 보기</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">순위</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">자치구</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">접근성 점수</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">공원 수</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">1인당 녹지</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">취약 비율</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">등급</th>
              </tr>
            </thead>
            <tbody>
              {sortedDistricts.map((d, i) => (
                <tr
                  key={d.district}
                  className={`cursor-pointer transition-colors ${selectedDistrict === d.district ? 'bg-green-50' : i % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-50/50 hover:bg-gray-100'}`}
                  onClick={() => setSelectedDistrict(d.district === selectedDistrict ? null : d.district)}
                >
                  <td className="px-4 py-3 text-sm text-gray-500">{i + 1}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-800">{d.district}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm font-bold" style={{ color: getScoreColor(d.avgScore) }}>{d.avgScore}</span>
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-gray-600">{d.parkCount}개</td>
                  <td className="px-4 py-3 text-center text-sm text-gray-600">{d.greenAreaPerCapita}㎡</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-medium ${d.vulnerableRatio >= 35 ? 'text-red-600' : d.vulnerableRatio >= 25 ? 'text-orange-600' : 'text-gray-600'}`}>
                      {d.vulnerableRatio}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${getScoreBgColor(d.avgScore)}`}>
                      {d.avgScore >= 70 ? '우수' : d.avgScore >= 55 ? '보통' : '취약'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI 챗봇 */}
      <div className="mt-6 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-purple-600" />
          <h2 className="font-bold text-gray-800">AI 녹지 어시스턴트</h2>
          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full ml-auto">Beta</span>
        </div>
        <div className="h-64 overflow-y-auto p-4 space-y-3 bg-gray-50">
          {chatMessages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-line ${
                msg.role === 'user'
                  ? 'bg-green-600 text-white rounded-br-sm'
                  : 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-sm'
              }`}>
                {msg.content}
              </div>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-gray-100">
          <div className="flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
              placeholder="예: 서울에서 녹지가 가장 좋은 구는?"
              className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <button
              onClick={handleSendChat}
              className="bg-green-600 hover:bg-green-700 text-white p-2.5 rounded-xl transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <div className="flex gap-2 mt-2 flex-wrap">
            {['가장 좋은 구는?', '취약 지역 어디야?', '강남구 현황', '서울 평균 점수'].map((q) => (
              <button
                key={q}
                onClick={() => { setChatInput(q); }}
                className="text-xs bg-gray-100 hover:bg-green-100 text-gray-600 hover:text-green-700 px-3 py-1 rounded-full transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
