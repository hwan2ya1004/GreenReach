import { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Building2, AlertTriangle, TrendingUp, Download, MessageSquare, Send, Brain, Loader2, Database, Wifi, WifiOff, RefreshCw, ThumbsUp, ThumbsDown } from 'lucide-react';
import { getScoreColor, getScoreBgColor } from '../utils/accessibility';
import type { ChatMessage } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE
  || (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? 'https://greenreach-api.onrender.com'
    : 'http://localhost:8000');

// ─── 오프라인 폴백 데이터 (백엔드 없을 때 사용) ──────────────────────────────
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
  { district: '전주시', parkCount: 218, totalArea: 6230000, avgArea: 28577.1 },
  { district: '천안시', parkCount: 205, totalArea: 5870000, avgArea: 28634.1 },
  { district: '남양주시', parkCount: 198, totalArea: 4320000, avgArea: 21818.2 },
  { district: '안양시', parkCount: 187, totalArea: 3210000, avgArea: 17165.8 },
  { district: '강남구', parkCount: 175, totalArea: 2980000, avgArea: 17028.6 },
  { district: '서초구', parkCount: 162, totalArea: 3450000, avgArea: 21296.3 },
  { district: '송파구', parkCount: 158, totalArea: 2760000, avgArea: 17468.4 },
  { district: '노원구', parkCount: 145, totalArea: 2340000, avgArea: 16137.9 },
  { district: '은평구', parkCount: 138, totalArea: 1980000, avgArea: 14347.8 },
  { district: '마포구', parkCount: 125, totalArea: 1650000, avgArea: 13200.0 },
  { district: '종로구', parkCount: 118, totalArea: 2100000, avgArea: 17796.6 },
  { district: '중구', parkCount: 52, totalArea: 680000, avgArea: 13076.9 },
  { district: '동대문구', parkCount: 48, totalArea: 590000, avgArea: 12291.7 },
  { district: '중랑구', parkCount: 45, totalArea: 520000, avgArea: 11555.6 },
  { district: '성동구', parkCount: 42, totalArea: 480000, avgArea: 11428.6 },
  { district: '광진구', parkCount: 38, totalArea: 430000, avgArea: 11315.8 },
  { district: '동작구', parkCount: 35, totalArea: 390000, avgArea: 11142.9 },
  { district: '관악구', parkCount: 32, totalArea: 350000, avgArea: 10937.5 },
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

  // 지역명 추출
  const mentioned = FALLBACK_DISTRICTS.find(d => {
    const name = d.district;
    const short = name.replace(/(구|시|군)$/, '');
    return q.includes(name) || (short.length >= 2 && q.includes(short));
  });

  // 의도 분류 (키워드 기반)
  const isBest = /(최고|1위|가장 좋|제일 좋|우수|풍부|살기 좋|많은 곳|많은 지역)/.test(q);
  const isWorst = /(취약|최악|부족|없는|적은|열악|나쁜|꼴찌|개선)/.test(q);
  const isStats = /(전국|전체|통계|평균|현황|얼마나|몇 개|우리나라)/.test(q);
  const isRank = /(순위|랭킹|top|상위|순서)/.test(q);
  const isSimilar = /(비슷|유사|같은 수준)/.test(q);
  const isRecommend = /(이사|추천|살기|거주|아이|산책)/.test(q);

  // 1. 최고 지역
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

  // 2. 취약 지역
  if (isWorst && !mentioned) {
    const worst = scored[scored.length - 1];
    const bottom3 = scored.slice(-3).reverse().map((d, i) =>
      `  ${i + 1}. **${d.district}** — 공원 ${d.parkCount.toLocaleString()}개, ${(d.totalArea / 10000).toFixed(1)}ha`
    ).join('\n');
    const vulnerableCount = scored.filter(d => d.score < 50).length;
    return {
      answer: `⚠️ 전국에서 녹지 접근성이 가장 취약한 지역은 **${worst.district}**입니다.\n\n📊 **${worst.district} 상세 현황**\n• 공원 수: ${worst.parkCount.toLocaleString()}개\n• 총 녹지 면적: ${_areaDesc(worst.totalArea / 10000)}\n• AI 예측 등급: ${_gradeEmoji(worst.score)} **${_gradeLabel(worst.score)}**\n\n🔴 **녹지 취약 하위 3개 지역**\n${bottom3}\n\n📌 샘플 ${scored.length}개 지역 중 **${vulnerableCount}개 지역**이 녹지 취약 상태(50점 미만)입니다.\n\n💡 ※ 오프라인 모드 — 샘플 데이터 기반 분석입니다.`,
      intent: 'worst_district',
      confidence: 0.85,
    };
  }

  // 3. 전국 통계
  if (isStats && !mentioned) {
    const totalParks = FALLBACK_DISTRICTS.reduce((s, d) => s + d.parkCount, 0);
    const totalArea = FALLBACK_DISTRICTS.reduce((s, d) => s + d.totalArea, 0);
    const avgParks = (totalParks / FALLBACK_DISTRICTS.length).toFixed(1);
    const vulnerable = scored.filter(d => d.score < 50).length;
    const excellent = scored.filter(d => d.score >= 70).length;
    return {
      answer: `📊 **전국 녹지 현황 종합 분석** (샘플 데이터 기반)\n\n🌳 **공원 현황**\n• 총 공원 수: **${totalParks.toLocaleString()}개**\n• 총 녹지 면적: **${(totalArea / 10000).toFixed(0)}ha**\n• 지역당 평균 공원 수: ${avgParks}개\n\n🏙️ **지역 분포** (${scored.length}개 지역 분석)\n• 🟢 우수 지역 (70점 이상): ${excellent}개\n• 🟡 보통 지역 (50~69점): ${scored.length - vulnerable - excellent}개\n• 🔴 취약 지역 (50점 미만): ${vulnerable}개\n\n🏆 **공원 수 1위**: ${scored[0].district} (${scored[0].parkCount.toLocaleString()}개)\n⚠️ **녹지 최취약**: ${scored[scored.length - 1].district} (${scored[scored.length - 1].parkCount.toLocaleString()}개)\n\n💡 ※ 오프라인 모드 — 샘플 30개 지역 기반 분석입니다.`,
      intent: 'stats_overview',
      confidence: 0.82,
    };
  }

  // 4. 순위
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

  // 5. 이사 추천
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

  // 6. 유사 지역
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

  // 7. 특정 지역 상세
  if (mentioned) {
    const score = _computeBaseScore(mentioned, maxCount);
    return {
      answer: `📍 **${mentioned.district} 녹지 현황 분석**\n\n🌳 **공원 현황**\n• 공원 수: ${mentioned.parkCount.toLocaleString()}개\n• 총 녹지 면적: ${_areaDesc(mentioned.totalArea / 10000)}\n• 평균 공원 면적: ${(mentioned.avgArea / 10000).toFixed(2)}ha\n\n🤖 **AI 예측 결과**\n• 예측 등급: ${_gradeEmoji(score)} **${_gradeLabel(score)}** (기준 점수 ${score}점)\n\n💡 ${score >= 70 ? '현재 우수한 녹지 환경을 유지하고 있습니다.' : score >= 50 ? '평균적인 녹지 환경을 갖추고 있습니다.' : '녹지 공간 확충이 필요한 지역입니다.'}\n\n※ 오프라인 모드 — 샘플 데이터 기반 분석입니다.`,
      intent: 'district_detail',
      confidence: 0.80,
    };
  }

  // 8. 폴백
  return {
    answer: '죄송합니다, 질문을 정확히 이해하지 못했습니다. 😅\n\n다음과 같이 질문해보세요:\n• "전국에서 녹지가 가장 좋은 곳은?"\n• "녹지 취약 지역은 어디야?"\n• "강남구 현황 알려줘"\n• "공원이 가장 많은 곳 순위"\n• "전국 평균 통계 알려줘"\n• "이사 가기 좋은 녹지 지역 추천"\n\n※ 현재 오프라인 모드로 동작 중입니다.',
    intent: 'unknown',
    confidence: 0.0,
  };
}

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

// ─── AI 챗봇 응답 (백엔드 ML API → 오프라인 폴백) ───────────────────────────
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
    return {
      answer: data.answer ?? '응답을 받지 못했습니다.',
      intent: data.intent,
      confidence: data.confidence,
    };
  } catch {
    // 백엔드 연결 실패 → 프론트엔드 내장 ML 폴백으로 자동 전환
    const offline = generateOfflineResponse(question);
    return offline;
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
      content: '안녕하세요! 그린리치 AI 녹지 어시스턴트입니다. 전국 녹지 접근성에 대해 무엇이든 물어보세요.\n\n예: "전국에서 녹지가 가장 좋은 곳은?" 또는 "강남구 현황 알려줘"\n\n🤖 RandomForest + KNN + TF-IDF 기반 모델 구조로 동작합니다.\n⚠️ 현재 UI·모델 구조 설계 완료 단계이며, 실제 응답은 데모 수준입니다. 향후 사용자 데이터 축적 후 고도화 예정입니다.',
      timestamp: new Date(),
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState<Record<string, 1 | 0>>({});
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

  // ─── 피드백 전송 함수 ────────────────────────────────────────────────────────
  const handleFeedback = async (msg: ChatMessage, rating: 1 | 0) => {
    if (feedbackSent[msg.id] !== undefined) return; // 이미 피드백 보낸 메시지

    // 이 AI 메시지 바로 앞의 user 메시지 찾기
    const msgIndex = chatMessages.findIndex(m => m.id === msg.id);
    const userMsg = msgIndex > 0 ? chatMessages[msgIndex - 1] : null;
    const question = userMsg?.content ?? '';

    // 낙관적 UI 업데이트 (즉시 반영)
    setFeedbackSent(prev => ({ ...prev, [msg.id]: rating }));

    // 서버 온라인일 때만 API 호출
    if (serverOnline) {
      try {
        await fetch(`${API_BASE}/api/ai/feedback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question,
            answer: msg.content,
            intent: (msg as any).intent ?? 'unknown',
            confidence: (msg as any).confidence ?? 0,
            rating,
          }),
          signal: AbortSignal.timeout(3000),
        });
      } catch {
        // 피드백 전송 실패해도 UI는 유지 (사용자 경험 우선)
      }
    }
  };

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
                disabled={chatLoading}
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

        {/* 서버 오프라인 안내 */}
        {serverOnline === false && (
          <div className="mx-4 mt-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 flex items-center gap-2 text-sm text-blue-700">
            <Brain className="w-4 h-4 flex-shrink-0 text-blue-500" />
            <span>백엔드 오프라인 — <strong>프론트엔드 내장 AI</strong>로 자동 전환되어 정상 동작합니다. 😊</span>
            <button onClick={checkServerStatus} className="ml-auto text-xs underline hover:no-underline flex-shrink-0">재확인</button>
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
                {/* 신뢰도 + 피드백 버튼 (AI 응답에만) */}
                {msg.role === 'assistant' && msg.id !== '0' && (msg as any).confidence > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <div className="flex items-center gap-1.5">
                      <Brain className="w-3 h-3 text-purple-400" />
                      <span className="text-xs text-gray-400">
                        의도: {(msg as any).intent} · 신뢰도 {Math.round((msg as any).confidence * 100)}%
                      </span>
                      {/* 👍👎 피드백 버튼 */}
                      <div className="ml-auto flex items-center gap-1">
                        {feedbackSent[msg.id] === undefined ? (
                          <>
                            <span className="text-xs text-gray-300 mr-0.5">도움됐나요?</span>
                            <button
                              onClick={() => handleFeedback(msg, 1)}
                              className="p-1 rounded-md hover:bg-green-50 text-gray-300 hover:text-green-500 transition-colors"
                              title="도움됐어요 — AI가 이 질문 패턴을 학습합니다"
                            >
                              <ThumbsUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleFeedback(msg, 0)}
                              className="p-1 rounded-md hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors"
                              title="별로예요 — 개선을 위해 기록됩니다"
                            >
                              <ThumbsDown className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            feedbackSent[msg.id] === 1
                              ? 'bg-green-50 text-green-600'
                              : 'bg-red-50 text-red-500'
                          }`}>
                            {feedbackSent[msg.id] === 1 ? '👍 학습 반영됨' : '👎 기록됨'}
                          </span>
                        )}
                      </div>
                    </div>
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
