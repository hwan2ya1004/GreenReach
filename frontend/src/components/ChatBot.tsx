import { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Send, Loader2, Brain, ThumbsUp, ThumbsDown, Wifi, WifiOff } from 'lucide-react';
import type { ChatMessage } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE
  || (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? 'https://greenreach-api.onrender.com'
    : 'http://localhost:8000');

// ─── 오프라인 폴백 데이터 ────────────────────────────────────────────────────
const FALLBACK_DISTRICTS = [
  { district: '화성시', parkCount: 592, totalArea: 7340000, avgArea: 12398.6 },
  { district: '평택시', parkCount: 535, totalArea: 8267000, avgArea: 15452.3 },
  { district: '창원시', parkCount: 469, totalArea: 18285000, avgArea: 38986.1 },
  { district: '청주시', parkCount: 432, totalArea: 15240000, avgArea: 35277.8 },
  { district: '용인시', parkCount: 340, totalArea: 7570000, avgArea: 22264.7 },
  { district: '수원시', parkCount: 335, totalArea: 7111000, avgArea: 21227.0 },
  { district: '고양시', parkCount: 281, totalArea: 6750000, avgArea: 24022.8 },
  { district: '성남시', parkCount: 265, totalArea: 5820000, avgArea: 21962.3 },
  { district: '부천시', parkCount: 248, totalArea: 3940000, avgArea: 15887.1 },
  { district: '안산시', parkCount: 231, totalArea: 4560000, avgArea: 19740.3 },
  { district: '강남구', parkCount: 175, totalArea: 2980000, avgArea: 17028.6 },
  { district: '서초구', parkCount: 162, totalArea: 3450000, avgArea: 21296.3 },
  { district: '송파구', parkCount: 158, totalArea: 2760000, avgArea: 17468.4 },
  { district: '노원구', parkCount: 145, totalArea: 2340000, avgArea: 16137.9 },
  { district: '마포구', parkCount: 125, totalArea: 1650000, avgArea: 13200.0 },
  { district: '종로구', parkCount: 118, totalArea: 2100000, avgArea: 17796.6 },
  { district: '금천구', parkCount: 28, totalArea: 290000, avgArea: 10357.1 },
  { district: '구로구', parkCount: 25, totalArea: 260000, avgArea: 10400.0 },
];

type FallbackDistrict = typeof FALLBACK_DISTRICTS[0];

function _computeBaseScore(d: FallbackDistrict, maxCount: number): number {
  const countScore = Math.min(50, Math.round((d.parkCount / Math.max(maxCount, 1)) * 50));
  const areaScore = Math.min(30, Math.round(Math.log10(d.totalArea + 1) * 8));
  const avgScore = Math.min(20, Math.round(Math.log10(d.avgArea + 1) * 5));
  return Math.min(99, Math.max(1, countScore + areaScore + avgScore));
}

function _gradeEmoji(score: number): string {
  return score >= 70 ? '🟢' : score >= 50 ? '🟡' : '🔴';
}

function _gradeLabel(score: number): string {
  return score >= 70 ? '우수' : score >= 50 ? '보통' : '취약';
}

function _areaDesc(ha: number): string {
  if (ha >= 100) return `${ha.toFixed(0)}ha (여의도 공원의 약 ${(ha / 22.9).toFixed(1)}배)`;
  if (ha >= 10) return `${ha.toFixed(1)}ha (축구장 약 ${(ha * 1.4).toFixed(0)}개 규모)`;
  if (ha >= 1) return `${ha.toFixed(2)}ha`;
  return `${(ha * 10000).toFixed(0)}㎡`;
}

function generateOfflineResponse(question: string): { answer: string; intent: string; confidence: number } {
  const q = question.toLowerCase();
  const maxCount = Math.max(...FALLBACK_DISTRICTS.map(d => d.parkCount));
  const scored = [...FALLBACK_DISTRICTS]
    .map(d => ({ ...d, score: _computeBaseScore(d, maxCount) }))
    .sort((a, b) => b.score - a.score);

  const mentioned = FALLBACK_DISTRICTS.find(d => {
    const name = d.district;
    const short = name.replace(/(구|시|군)$/, '');
    return q.includes(name) || (short.length >= 2 && q.includes(short));
  });

  const isBest = /(최고|1위|가장 좋|제일 좋|우수|풍부|살기 좋|많은 곳|많은 지역)/.test(q);
  const isWorst = /(취약|최악|부족|없는|적은|열악|나쁜|꼴찌|개선)/.test(q);
  const isStats = /(전국|전체|통계|평균|현황|얼마나|몇 개|우리나라)/.test(q);
  const isRank = /(순위|랭킹|top|상위|순서)/.test(q);
  const isRecommend = /(이사|추천|살기|거주|아이|산책)/.test(q);
  const isSimilar = /(비슷|유사|같은 수준)/.test(q);

  if (isBest && !mentioned) {
    const best = scored[0];
    const top3 = scored.slice(0, 3).map((d, i) =>
      `  ${i + 1}위. **${d.district}** — 공원 ${d.parkCount.toLocaleString()}개, ${(d.totalArea / 10000).toFixed(0)}ha`
    ).join('\n');
    return {
      answer: `🏆 전국 녹지 접근성 **1위 지역은 ${best.district}**입니다!\n\n📊 **${best.district} 상세 현황**\n• 공원 수: ${best.parkCount.toLocaleString()}개\n• 총 녹지 면적: ${_areaDesc(best.totalArea / 10000)}\n• 평균 공원 면적: ${(best.avgArea / 10000).toFixed(2)}ha\n• AI 예측 등급: ${_gradeEmoji(best.score)} **${_gradeLabel(best.score)}**\n\n🥇 **TOP 3 지역**\n${top3}\n\n💡 ※ 오프라인 모드 — 샘플 데이터 기반 분석입니다.`,
      intent: 'best_district',
      confidence: 0.85,
    };
  }

  if (isWorst && !mentioned) {
    const worst = scored[scored.length - 1];
    const bottom3 = scored.slice(-3).reverse().map((d, i) =>
      `  ${i + 1}. **${d.district}** — 공원 ${d.parkCount.toLocaleString()}개, ${(d.totalArea / 10000).toFixed(1)}ha`
    ).join('\n');
    return {
      answer: `⚠️ 녹지 접근성이 가장 취약한 지역은 **${worst.district}**입니다.\n\n📊 **${worst.district} 상세 현황**\n• 공원 수: ${worst.parkCount.toLocaleString()}개\n• 총 녹지 면적: ${_areaDesc(worst.totalArea / 10000)}\n• AI 예측 등급: ${_gradeEmoji(worst.score)} **${_gradeLabel(worst.score)}**\n\n🔴 **녹지 취약 하위 3개 지역**\n${bottom3}\n\n💡 ※ 오프라인 모드 — 샘플 데이터 기반 분석입니다.`,
      intent: 'worst_district',
      confidence: 0.85,
    };
  }

  if (isStats && !mentioned) {
    const totalParks = FALLBACK_DISTRICTS.reduce((s, d) => s + d.parkCount, 0);
    const totalArea = FALLBACK_DISTRICTS.reduce((s, d) => s + d.totalArea, 0);
    const avgParks = (totalParks / FALLBACK_DISTRICTS.length).toFixed(1);
    const vulnerable = scored.filter(d => d.score < 50).length;
    const excellent = scored.filter(d => d.score >= 70).length;
    return {
      answer: `📊 **전국 녹지 현황 종합 분석** (샘플 데이터 기반)\n\n🌳 **공원 현황**\n• 총 공원 수: **${totalParks.toLocaleString()}개**\n• 총 녹지 면적: **${(totalArea / 10000).toFixed(0)}ha**\n• 지역당 평균 공원 수: ${avgParks}개\n\n🏙️ **지역 분포** (${scored.length}개 지역 분석)\n• 🟢 우수 지역 (70점 이상): ${excellent}개\n• 🟡 보통 지역 (50~69점): ${scored.length - vulnerable - excellent}개\n• 🔴 취약 지역 (50점 미만): ${vulnerable}개\n\n💡 ※ 오프라인 모드 — 샘플 데이터 기반 분석입니다.`,
      intent: 'stats_overview',
      confidence: 0.82,
    };
  }

  if (isRank && !mentioned) {
    const top5 = [...FALLBACK_DISTRICTS].sort((a, b) => b.parkCount - a.parkCount).slice(0, 5);
    const lines = top5.map((d, i) =>
      `  ${i + 1}위. **${d.district}** — ${d.parkCount.toLocaleString()}개 공원 / ${_areaDesc(d.totalArea / 10000)}`
    ).join('\n');
    return {
      answer: `🌳 **공원이 가장 많은 지역 TOP 5**\n\n${lines}\n\n💡 ※ 오프라인 모드 — 샘플 데이터 기반 순위입니다.`,
      intent: 'top_parks',
      confidence: 0.80,
    };
  }

  if (isRecommend && !mentioned) {
    const top5 = [...FALLBACK_DISTRICTS].sort((a, b) => b.parkCount - a.parkCount).slice(0, 5);
    const lines = top5.map((d, i) =>
      `  ${i + 1}. **${d.district}** — 공원 ${d.parkCount.toLocaleString()}개 · ${(d.totalArea / 10000).toFixed(0)}ha`
    ).join('\n');
    return {
      answer: `🏡 **녹지 환경 기준 거주 추천 지역 TOP 5**\n\n${lines}\n\n💡 공원 수가 많을수록 일상적인 녹지 접근성이 높습니다.\n특정 지역 상세 정보는 "강남구 현황 알려줘"처럼 질문해보세요!\n\n※ 오프라인 모드 — 샘플 데이터 기반 추천입니다.`,
      intent: 'recommendation',
      confidence: 0.78,
    };
  }

  if (isSimilar && mentioned) {
    const target = { ...mentioned, score: _computeBaseScore(mentioned, maxCount) };
    const similar = FALLBACK_DISTRICTS
      .filter(d => d.district !== mentioned.district)
      .map(d => ({
        ...d,
        score: _computeBaseScore(d, maxCount),
        diff: Math.abs(d.parkCount - mentioned.parkCount) + Math.abs(d.totalArea - mentioned.totalArea) / 100000,
      }))
      .sort((a, b) => a.diff - b.diff)
      .slice(0, 3);
    const lines = similar.map((d, i) =>
      `  ${i + 1}. **${d.district}** — 공원 ${d.parkCount.toLocaleString()}개 · ${(d.totalArea / 10000).toFixed(1)}ha`
    ).join('\n');
    return {
      answer: `🔍 **${mentioned.district}**와 녹지 환경이 유사한 지역\n\n📌 기준: 공원 ${mentioned.parkCount.toLocaleString()}개 · ${(mentioned.totalArea / 10000).toFixed(1)}ha · ${_gradeEmoji(target.score)} ${_gradeLabel(target.score)}\n\n🗺️ **유사 지역 TOP 3**\n${lines}\n\n💡 ※ 오프라인 모드 — 샘플 데이터 기반 분석입니다.`,
      intent: 'similar_district',
      confidence: 0.78,
    };
  }

  if (mentioned) {
    const score = _computeBaseScore(mentioned, maxCount);
    return {
      answer: `📍 **${mentioned.district} 녹지 현황 분석**\n\n🌳 **공원 현황**\n• 공원 수: ${mentioned.parkCount.toLocaleString()}개\n• 총 녹지 면적: ${_areaDesc(mentioned.totalArea / 10000)}\n• 평균 공원 면적: ${(mentioned.avgArea / 10000).toFixed(2)}ha\n\n🤖 **AI 예측 결과**\n• 예측 등급: ${_gradeEmoji(score)} **${_gradeLabel(score)}** (기준 점수 ${score}점)\n\n💡 ${score >= 70 ? '현재 우수한 녹지 환경을 유지하고 있습니다.' : score >= 50 ? '평균적인 녹지 환경을 갖추고 있습니다.' : '녹지 공간 확충이 필요한 지역입니다.'}\n\n※ 오프라인 모드 — 샘플 데이터 기반 분석입니다.`,
      intent: 'district_detail',
      confidence: 0.80,
    };
  }

  return {
    answer: '죄송합니다, 질문을 정확히 이해하지 못했습니다. 😅\n\n다음과 같이 질문해보세요:\n• "전국에서 녹지가 가장 좋은 곳은?"\n• "녹지 취약 지역은 어디야?"\n• "강남구 현황 알려줘"\n• "공원이 가장 많은 곳 순위"\n• "이사 가기 좋은 녹지 지역 추천"\n\n※ 현재 오프라인 모드로 동작 중입니다.',
    intent: 'unknown',
    confidence: 0.0,
  };
}

async function fetchMLResponse(question: string): Promise<{ answer: string; intent?: string; confidence?: number }> {
  try {
    const res = await fetch(`${API_BASE}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error('API 오류');
    const data = await res.json();
    return { answer: data.answer ?? '응답을 받지 못했습니다.', intent: data.intent, confidence: data.confidence };
  } catch {
    return generateOfflineResponse(question);
  }
}

// ─── 간단한 마크다운 렌더러 ──────────────────────────────────────────────────
function MarkdownText({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-0.5">
      {lines.map((line, i) => {
        if (line.trim() === '') return <div key={i} className="h-1" />;
        const renderInline = (str: string) => {
          const parts = str.split(/(\*\*[^*]+\*\*)/g);
          return parts.map((part, j) =>
            part.startsWith('**') && part.endsWith('**')
              ? <strong key={j} className="font-bold">{part.slice(2, -2)}</strong>
              : <span key={j}>{part}</span>
          );
        };
        if (line.trim().startsWith('•') || line.trim().startsWith('-')) {
          const content = line.trim().replace(/^[•\-]\s*/, '');
          return (
            <div key={i} className="flex items-start gap-1 ml-1">
              <span className="text-green-500 mt-0.5 flex-shrink-0 text-xs">•</span>
              <span className="text-xs">{renderInline(content)}</span>
            </div>
          );
        }
        const numMatch = line.trim().match(/^(\d+)\.\s+(.+)/);
        if (numMatch) {
          return (
            <div key={i} className="flex items-start gap-1 ml-1">
              <span className="text-green-600 font-bold flex-shrink-0 w-3 text-xs">{numMatch[1]}.</span>
              <span className="text-xs">{renderInline(numMatch[2])}</span>
            </div>
          );
        }
        return <div key={i} className="text-xs">{renderInline(line)}</div>;
      })}
    </div>
  );
}

// ─── 메인 플로팅 챗봇 컴포넌트 ───────────────────────────────────────────────
export default function ChatBot() {
  const [open, setOpen] = useState(false);
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '0',
      role: 'assistant',
      content: '안녕하세요! 🌿 그린리치 AI 어시스턴트입니다.\n\n전국 녹지 접근성에 대해 무엇이든 물어보세요!\n\n• "전국에서 녹지가 가장 좋은 곳은?"\n• "강남구 현황 알려줘"\n• "이사 가기 좋은 녹지 지역 추천"',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState<Record<string, 1 | 0>>({});
  const [unread, setUnread] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // 서버 상태 확인
  useEffect(() => {
    fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) })
      .then(r => setServerOnline(r.ok))
      .catch(() => setServerOnline(false));
  }, []);

  // 채팅 스크롤
  useEffect(() => {
    if (open) chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, open]);

  // 열면 읽지 않은 메시지 초기화
  useEffect(() => {
    if (open) setUnread(0);
  }, [open]);

  const handleSend = async (overrideQ?: string) => {
    const question = (overrideQ ?? input).trim();
    if (!question || loading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: question,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    const { answer, intent, confidence } = await fetchMLResponse(question);

    const aiMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: answer,
      timestamp: new Date(),
      // @ts-ignore
      intent,
      confidence,
    };
    setMessages(prev => [...prev, aiMsg]);
    setLoading(false);

    // 닫혀 있으면 읽지 않은 메시지 카운트
    if (!open) setUnread(prev => prev + 1);
  };

  const handleFeedback = async (msg: ChatMessage, rating: 1 | 0) => {
    if (feedbackSent[msg.id] !== undefined) return;
    setFeedbackSent(prev => ({ ...prev, [msg.id]: rating }));
    if (serverOnline) {
      try {
        const msgIndex = messages.findIndex(m => m.id === msg.id);
        const question = msgIndex > 0 ? messages[msgIndex - 1].content : '';
        await fetch(`${API_BASE}/api/ai/feedback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question, answer: msg.content, intent: (msg as any).intent ?? 'unknown', confidence: (msg as any).confidence ?? 0, rating }),
          signal: AbortSignal.timeout(3000),
        });
      } catch { /* 무시 */ }
    }
  };

  const QUICK_QUESTIONS = [
    { label: '🏆 녹지 1위 지역', query: '녹지가 가장 좋은 곳은?' },
    { label: '⚠️ 취약 지역', query: '녹지 취약 지역은 어디야?' },
    { label: '🌳 공원 순위 TOP5', query: '공원이 가장 많은 곳 순위' },
    { label: '🏡 이사 추천', query: '이사 가기 좋은 녹지 지역 추천' },
  ];

  return (
    <>
      {/* ── 채팅창 ── */}
      {open && (
        <div className="fixed bottom-24 right-4 sm:right-6 z-50 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
          style={{ maxHeight: '520px' }}>
          {/* 헤더 */}
          <div className="bg-green-600 px-4 py-3 flex items-center gap-2">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1">
              <div className="text-white font-bold text-sm">AI 녹지 어시스턴트</div>
              <div className="flex items-center gap-1 text-green-200 text-xs">
                {serverOnline === true
                  ? <><Wifi className="w-2.5 h-2.5" /> 온라인</>
                  : serverOnline === false
                  ? <><WifiOff className="w-2.5 h-2.5" /> 오프라인 (내장 AI 동작 중)</>
                  : '연결 확인 중...'}
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 메시지 영역 */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50" style={{ minHeight: 0 }}>
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs ${
                  msg.role === 'user'
                    ? 'bg-green-600 text-white rounded-br-sm'
                    : 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-sm'
                }`}>
                  {msg.role === 'assistant'
                    ? <MarkdownText text={msg.content} />
                    : <span>{msg.content}</span>}

                  {/* 피드백 버튼 */}
                  {msg.role === 'assistant' && msg.id !== '0' && (msg as any).confidence > 0 && (
                    <div className="mt-1.5 pt-1.5 border-t border-gray-100 flex items-center gap-1">
                      <span className="text-gray-300 text-xs flex-1">도움됐나요?</span>
                      {feedbackSent[msg.id] === undefined ? (
                        <>
                          <button onClick={() => handleFeedback(msg, 1)} className="p-0.5 rounded hover:bg-green-50 text-gray-300 hover:text-green-500 transition-colors">
                            <ThumbsUp className="w-3 h-3" />
                          </button>
                          <button onClick={() => handleFeedback(msg, 0)} className="p-0.5 rounded hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors">
                            <ThumbsDown className="w-3 h-3" />
                          </button>
                        </>
                      ) : (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${feedbackSent[msg.id] === 1 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                          {feedbackSent[msg.id] === 1 ? '👍' : '👎'}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white rounded-2xl rounded-bl-sm px-3 py-2 shadow-sm border border-gray-100 flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin text-green-500" />
                  <span className="text-xs text-gray-400">분석 중...</span>
                  <div className="flex gap-0.5 ml-0.5">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="w-1 h-1 bg-green-300 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* 빠른 질문 */}
          <div className="px-3 py-2 border-t border-gray-100 bg-white flex gap-1.5 flex-wrap">
            {QUICK_QUESTIONS.map(({ label, query }) => (
              <button
                key={label}
                onClick={() => handleSend(query)}
                disabled={loading}
                className="text-xs bg-gray-100 hover:bg-green-100 text-gray-600 hover:text-green-700 px-2 py-1 rounded-full transition-colors disabled:opacity-50"
              >
                {label}
              </button>
            ))}
          </div>

          {/* 입력창 */}
          <div className="px-3 py-2.5 border-t border-gray-100 bg-white flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="녹지에 대해 무엇이든 물어보세요"
              disabled={loading}
              className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
            />
            <button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white p-2 rounded-xl transition-colors"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      )}

      {/* ── 플로팅 버튼 ── */}
      <button
        onClick={() => setOpen(prev => !prev)}
        className={`fixed bottom-5 right-4 sm:right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ${
          open ? 'bg-gray-600 hover:bg-gray-700' : 'bg-green-600 hover:bg-green-700'
        }`}
        title="AI 녹지 어시스턴트"
      >
        {open
          ? <X className="w-6 h-6 text-white" />
          : <MessageSquare className="w-6 h-6 text-white" />}

        {/* 읽지 않은 메시지 뱃지 */}
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unread}
          </span>
        )}
      </button>
    </>
  );
}
