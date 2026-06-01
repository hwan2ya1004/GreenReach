import { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Building2, AlertTriangle, TrendingUp, Download, MessageSquare, Send, Brain, Loader2, Database, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { getScoreColor, getScoreBgColor } from '../utils/accessibility';
import type { ChatMessage } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

// ─── 타입 ─────────────────────────────────────────────────────────────────────
interface DistrictStat {
  district: string;
  parkCount: number;
  totalArea: number;
  avgArea: number;
  score?: number;
}

// ─── 간단한 마크다운 렌더러 ──────────────────────────────────────────────────
function MarkdownText({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (line.trim() === '') return <div key={i} className="h-1" />;

        // 굵은 텍스트 파싱 (**text**)
        const renderInline = (str: string) => {
          const parts = str.split(/(\*\*[^*]+\*\*)/g);
          return parts.map((part, j) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={j} className="font-bold">{part.slice(2, -2)}</strong>;
            }
            return <span key={j}>{part}</span>;
          });
        };

        // 불릿 포인트 (• 또는 -)
        if (line.trim().startsWith('•') || line.trim().startsWith('-')) {
          const content = line.trim().replace(/^[•\-]\s*/, '');
          return (
            <div key={i} className="flex items-start gap-1.5 ml-1">
              <span className="text-green-500 mt-0.5 flex-shrink-0">•</span>
              <span>{renderInline(content)}</span>
            </div>
          );
        }

        // 번호 목록 (1. 2. 3.)
        const numMatch = line.trim().match(/^(\d+)\.\s+(.+)/);
        if (numMatch) {
          return (
            <div key={i} className="flex items-start gap-1.5 ml-1">
              <span className="text-green-600 font-bold flex-shrink-0 w-4">{numMatch[1]}.</span>
              <span>{renderInline(numMatch[2])}</span>
            </div>
          );
        }

        return <div key={i}>{renderInline(line)}</div>;
      })}
    </div>
  );
}

// ─── 공원 수/면적 기반 접근성 점수 추정 ──────────────────────────────────────
function estimateScore(stat: DistrictStat, maxCount: number, maxArea: number): number {
  const countScore = Math.min(60, Math.round((stat.parkCount / maxCount) * 60));
  const areaScore = Math.min(25, Math.round((stat.totalArea / maxArea) * 25));
  const avgArea = stat.avgArea ?? 0;
  const avgScore =
    avgArea >= 100000 ? 15 :
    avgArea >= 50000  ? 12 :
    avgArea >= 10000  ? 9  :
    avgArea >= 3000   ? 6  :
    avgArea >= 1000   ? 3  : 1;
  return Math.min(99, Math.max(1, countScore + areaScore + avgScore));
}

// ─── AI 챗봇 응답 (백엔드 ML API 호출) ──────────────────────────────────────
async function fetchMLResponse(question: string): Promise<{ answer: string; intent?: string; confidence?: number }> {
  try {
    const res = await fetch(`${API_BASE}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    });
    if (!res.ok) throw new Error('API 오류');
    const data = await res.json();
    return {
      answer: data.answer ?? '응답을 받지 못했습니다.',
      intent: data.intent,
      confidence: data.confidence,
    };
  } catch {
    return {
      answer: '⚠️ 서버에 연결할 수 없습니다.\n\n백엔드 서버가 실행 중인지 확인해주세요:\n```\npython -m uvicorn backend.main:app --port 8000\n```',
    };
  }
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [stats, setStats] = useState<DistrictStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: '0',
      role: 'assistant',
      content: '안녕하세요! 그린리치 AI 어시스턴트입니다. 전국 녹지 접근성에 대해 무엇이든 물어보세요.\n\n예: "전국에서 녹지가 가장 좋은 곳은?" 또는 "강남구 현황 알려줘"\n\n🤖 scikit-learn ML 모델 (RandomForest + KNN + TF-IDF) 기반으로 분석합니다.',
      timestamp: new Date(),
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // 서버 상태 확인
  const checkServerStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) });
      setServerOnline(res.ok);
    } catch {
      setServerOnline(false);
    }
  };

  // 백엔드 API에서 실제 데이터 로드
  const loadData = () => {
    setLoading(true);
    setError('');
    fetch(`${API_BASE}/api/districts/stats`)
      .then(r => r.json())
      .then(data => {
        const rawStats: DistrictStat[] = (data.districts || []).map((d: DistrictStat) => ({
          ...d,
          avgArea: d.avgArea ?? (d.parkCount > 0 ? d.totalArea / d.parkCount : 0),
        }));
        const maxCount = Math.max(...rawStats.map(d => d.parkCount), 1);
        const maxArea = Math.max(...rawStats.map(d => d.totalArea), 1);
        const withScores = rawStats.map(d => ({
          ...d,
          score: estimateScore(d, maxCount, maxArea),
        }));
        setStats(withScores);
        setServerOnline(true);
        setLoading(false);
      })
      .catch(() => {
        setError('서버에서 데이터를 불러올 수 없습니다.');
        setServerOnline(false);
        setLoading(false);
      });
  };

  useEffect(() => {
    checkServerStatus();
    loadData();
  }, []);

  // 채팅 스크롤 자동 이동
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatLoading]);

  const sortedStats = [...stats].sort((a, b) => b.parkCount - a.parkCount);
  const top20 = sortedStats.slice(0, 20);
  const selectedStat = selectedDistrict ? stats.find(d => d.district === selectedDistrict) : null;

  const totalParks = stats.reduce((s, d) => s + d.parkCount, 0);
  const totalArea = stats.reduce((s, d) => s + d.totalArea, 0);
  const vulnerableCount = stats.filter(d => (d.score ?? 0) < 50).length;

  const handleSendChat = async (overrideQuestion?: string) => {
    const question = (overrideQuestion ?? chatInput).trim();
    if (!question || chatLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: question,
      timestamp: new Date(),
    };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);

    const { answer, intent, confidence } = await fetchMLResponse(question);

    const aiMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: answer,
      timestamp: new Date(),
      // @ts-ignore - 추가 메타데이터
      intent,
      confidence,
    };
    setChatMessages(prev => [...prev, aiMsg]);
    setChatLoading(false);
  };

  const handleDownloadReport = () => {
    const district = selectedDistrict ?? '전국 전체';
    const content = selectedStat
      ? `GreenReach 녹지 접근성 리포트\n\n지역: ${selectedStat.district}\n공원 수: ${selectedStat.parkCount}개\n총 녹지 면적: ${(selectedStat.totalArea / 10000).toFixed(1)}ha\n평균 공원 면적: ${(selectedStat.avgArea / 10000).toFixed(2)}ha\n\n생성일: ${new Date().toLocaleDateString('ko-KR')}\n© 2026 GreenReach`
      : `GreenReach 전국 녹지 접근성 종합 리포트\n\n생성일: ${new Date().toLocaleDateString('ko-KR')}\n총 공원 수: ${totalParks.toLocaleString()}개\n총 녹지 면적: ${(totalArea / 10000).toFixed(0)}ha\n\n${sortedStats.slice(0, 30).map((d, i) => `${i + 1}. ${d.district}: ${d.parkCount}개 공원`).join('\n')}\n\n© 2026 GreenReach`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GreenReach_${district}_리포트_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-gray-500">
        <Loader2 className="w-6 h-6 animate-spin text-green-600" />
        <span>공공데이터 불러오는 중... (전국 공원 16,999개)</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <WifiOff className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="text-red-700 font-semibold">{error}</p>
          <p className="text-red-500 text-sm mt-1 mb-4">백엔드 서버가 실행 중인지 확인하세요.</p>
          <div className="bg-gray-900 text-green-400 text-xs rounded-lg p-3 text-left font-mono mb-4 max-w-md mx-auto">
            <div className="text-gray-400 mb-1"># 백엔드 서버 시작</div>
            <div>python -m uvicorn backend.main:app --port 8000</div>
          </div>
          <button
            onClick={loadData}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm mx-auto transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-blue-600" />
            지자체 녹지 현황 대시보드
          </h1>
          <p className="text-gray-500 mt-1 text-sm flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-green-600" />
            공공데이터포털 전국도시공원정보표준데이터 실시간 연동 · {stats.length}개 지역
            {/* 서버 상태 표시 */}
            <span className={`ml-2 flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
              serverOnline === true ? 'bg-green-100 text-green-700' :
              serverOnline === false ? 'bg-red-100 text-red-600' :
              'bg-gray-100 text-gray-500'
            }`}>
              {serverOnline === true ? <Wifi className="w-3 h-3" /> :
               serverOnline === false ? <WifiOff className="w-3 h-3" /> :
               <Loader2 className="w-3 h-3 animate-spin" />}
              {serverOnline === true ? '서버 연결됨' :
               serverOnline === false ? '서버 오프라인' : '확인 중'}
            </span>
          </p>
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
          { label: '전국 총 공원 수', value: `${totalParks.toLocaleString()}개`, color: 'text-green-700', bg: 'bg-green-50', sub: '공공데이터 기준' },
          { label: '총 녹지 면적', value: `${(totalArea / 10000).toFixed(0)}ha`, color: 'text-blue-700', bg: 'bg-blue-50', sub: '전국 합산' },
          { label: '분석 지역 수', value: `${stats.length}개`, color: 'text-purple-700', bg: 'bg-purple-50', sub: '구/군/시 단위' },
          { label: '녹지 취약 지역', value: `${vulnerableCount}개`, color: 'text-red-600', bg: 'bg-red-50', sub: '점수 50점 미만' },
        ].map((item) => (
          <div key={item.label} className={`${item.bg} rounded-xl p-4`}>
            <div className={`text-2xl font-bold ${item.color}`}>{item.value}</div>
            <div className="text-sm text-gray-700 mt-0.5 font-medium">{item.label}</div>
            <div className="text-xs text-gray-400 mt-0.5">{item.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* 공원 수 차트 (상위 20개) */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-bold text-gray-800 mb-1 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-600" />
            지역별 공원 수 (상위 20개)
          </h2>
          <p className="text-xs text-gray-400 mb-4">공공데이터포털 전국도시공원정보표준데이터 기준</p>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={top20} margin={{ top: 5, right: 10, left: -20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="district"
                tick={{ fontSize: 10 }}
                angle={-45}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value) => [`${value}개`, '공원 수']}
                labelStyle={{ fontWeight: 'bold' }}
              />
              <Bar dataKey="parkCount" radius={[4, 4, 0, 0]} onClick={(data) => setSelectedDistrict(data.district)}>
                {top20.map((entry) => (
                  <Cell
                    key={entry.district}
                    fill={getScoreColor(entry.score ?? 50)}
                    opacity={selectedDistrict === null || selectedDistrict === entry.district ? 1 : 0.4}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-gray-400 text-center mt-2">막대를 클릭하면 상세 정보를 확인할 수 있습니다</p>
        </div>

        {/* 우측 패널 */}
        <div className="space-y-4">
          {/* 선택된 지역 상세 */}
          {selectedStat ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-800">{selectedStat.district} 상세</h3>
                <button onClick={() => setSelectedDistrict(null)} className="text-xs text-gray-400 hover:text-gray-600">닫기</button>
              </div>
              <div className="text-center mb-4">
                <div className="text-4xl font-bold text-green-700">{selectedStat.parkCount}</div>
                <div className="text-sm text-gray-500 mt-1">개 공원</div>
                <div className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-semibold ${getScoreBgColor(selectedStat.score ?? 50)}`}>
                  {(selectedStat.score ?? 0) >= 70 ? '우수' : (selectedStat.score ?? 0) >= 50 ? '보통' : '취약'}
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">공원 수</span><span className="font-medium">{selectedStat.parkCount}개</span></div>
                <div className="flex justify-between"><span className="text-gray-500">총 녹지 면적</span><span className="font-medium">{(selectedStat.totalArea / 10000).toFixed(1)}ha</span></div>
                <div className="flex justify-between"><span className="text-gray-500">평균 공원 면적</span><span className="font-medium">{(selectedStat.avgArea / 10000).toFixed(2)}ha</span></div>
              </div>
              {/* AI에게 물어보기 버튼 */}
              <button
                onClick={() => handleSendChat(`${selectedStat.district} 현황 알려줘`)}
                disabled={chatLoading || !serverOnline}
                className="mt-3 w-full text-xs bg-purple-50 hover:bg-purple-100 text-purple-700 py-2 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
              >
                <Brain className="w-3 h-3" />
                AI에게 {selectedStat.district} 분석 요청
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-bold text-gray-800 mb-3">공원 수 TOP 5</h3>
              <div className="space-y-2">
                {sortedStats.slice(0, 5).map((d, i) => (
                  <div key={d.district} className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 rounded-lg p-1.5" onClick={() => setSelectedDistrict(d.district)}>
                    <span className="text-sm font-bold text-gray-400 w-4">{i + 1}</span>
                    <span className="text-sm font-medium text-gray-800 flex-1 truncate">{d.district}</span>
                    <span className="text-sm font-bold text-green-700">{d.parkCount}개</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI 취약지 예측 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
              <Brain className="w-4 h-4 text-purple-600" />
              녹지 취약 지역 TOP 5
            </h3>
            <div className="space-y-2">
              {[...stats]
                .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
                .slice(0, 5)
                .map((zone) => (
                  <div
                    key={zone.district}
                    className="flex items-center gap-2 cursor-pointer hover:bg-red-50 rounded-lg p-1 transition-colors"
                    onClick={() => handleSendChat(`${zone.district} 현황 알려줘`)}
                  >
                    <div className="w-2 h-2 rounded-full flex-shrink-0 bg-red-500" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-800 truncate">{zone.district}</div>
                      <div className="text-xs text-gray-500">공원 {zone.parkCount}개 · {(zone.totalArea / 10000).toFixed(1)}ha</div>
                    </div>
                    <div className="text-xs font-bold text-red-600 flex-shrink-0">{zone.score}점</div>
                  </div>
                ))}
            </div>
            <div className="mt-3 text-xs text-gray-400 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              클릭하면 AI 분석을 요청합니다
            </div>
          </div>
        </div>
      </div>

      {/* 전체 지역 테이블 */}
      <div className="mt-6 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-800">전국 지역별 녹지 현황 ({stats.length}개 지역)</h2>
          <span className="text-xs text-gray-400">클릭하여 상세 보기</span>
        </div>
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">순위</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">지역</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">공원 수</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">총 면적</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">평균 면적</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">등급</th>
              </tr>
            </thead>
            <tbody>
              {sortedStats.map((d, i) => (
                <tr
                  key={d.district}
                  className={`cursor-pointer transition-colors ${selectedDistrict === d.district ? 'bg-green-50' : i % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-50/50 hover:bg-gray-100'}`}
                  onClick={() => setSelectedDistrict(d.district === selectedDistrict ? null : d.district)}
                >
                  <td className="px-4 py-3 text-sm text-gray-500">{i + 1}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-800">{d.district}</td>
                  <td className="px-4 py-3 text-center text-sm font-bold text-green-700">{d.parkCount}개</td>
                  <td className="px-4 py-3 text-center text-sm text-gray-600">{(d.totalArea / 10000).toFixed(1)}ha</td>
                  <td className="px-4 py-3 text-center text-sm text-gray-600">{(d.avgArea / 10000).toFixed(2)}ha</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${getScoreBgColor(d.score ?? 50)}`}>
                      {(d.score ?? 0) >= 70 ? '우수' : (d.score ?? 0) >= 50 ? '보통' : '취약'}
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
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">scikit-learn ML</span>
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">실제 DB 연동</span>
            {/* 서버 상태 뱃지 */}
            <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${
              serverOnline ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
            }`}>
              {serverOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {serverOnline ? '온라인' : '오프라인'}
            </span>
          </div>
        </div>

        {/* 서버 오프라인 경고 */}
        {serverOnline === false && (
          <div className="mx-4 mt-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 flex items-center gap-2 text-sm text-amber-700">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>백엔드 서버가 오프라인입니다. AI 응답이 제한될 수 있습니다.</span>
            <button onClick={checkServerStatus} className="ml-auto text-xs underline hover:no-underline">재확인</button>
          </div>
        )}

        <div className="h-72 overflow-y-auto p-4 space-y-3 bg-gray-50">
          {chatMessages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                msg.role === 'user'
                  ? 'bg-green-600 text-white rounded-br-sm'
                  : 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-sm'
              }`}>
                {msg.role === 'assistant' ? (
                  <MarkdownText text={msg.content} />
                ) : (
                  <span>{msg.content}</span>
                )}
                {/* 신뢰도 표시 (AI 응답에만) */}
                {msg.role === 'assistant' && (msg as any).confidence > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-1.5">
                    <Brain className="w-3 h-3 text-purple-400" />
                    <span className="text-xs text-gray-400">
                      의도: {(msg as any).intent} · 신뢰도 {Math.round((msg as any).confidence * 100)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
          {chatLoading && (
            <div className="flex justify-start">
              <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm border border-gray-100 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-500" />
                <span className="text-xs text-gray-400">ML 모델 분석 중...</span>
                <div className="flex gap-0.5 ml-1">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-1.5 h-1.5 bg-purple-300 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="p-4 border-t border-gray-100">
          <div className="flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
              placeholder="예: 전국에서 녹지가 가장 좋은 곳은?"
              disabled={chatLoading}
              className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
            />
            <button
              onClick={() => handleSendChat()}
              disabled={chatLoading || !chatInput.trim()}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white p-2.5 rounded-xl transition-colors"
            >
              {chatLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
          {/* 빠른 질문 버튼 */}
          <div className="flex gap-2 mt-2 flex-wrap">
          {[
              { label: '🏆 녹지 가장 좋은 곳?', query: '녹지가 가장 좋은 곳은?' },
              { label: '⚠️ 취약 지역은?', query: '녹지 취약 지역은 어디야?' },
              { label: '🌳 공원 순위 TOP 5', query: '공원이 가장 많은 곳 순위' },
              { label: '📊 전국 평균 통계', query: '전국 평균 통계 알려줘' },
              { label: '🤖 AI 예측 결과', query: 'AI 예측 결과 알려줘' },
              { label: '🔍 강남구 유사 지역', query: '강남구와 비슷한 지역은?' },
              { label: '🏡 이사 추천 지역', query: '이사 가기 좋은 녹지 지역 추천' },
              { label: '🔧 개선 필요 지역', query: '녹지 개선이 필요한 곳은?' },
            ].map(({ label, query }) => (
              <button
                key={label}
                onClick={() => handleSendChat(query)}
                disabled={chatLoading}
                className="text-xs bg-gray-100 hover:bg-green-100 text-gray-600 hover:text-green-700 px-3 py-1 rounded-full transition-colors disabled:opacity-50"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
