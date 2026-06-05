import { useState, useEffect, useCallback } from 'react';
import {
  Brain, ThumbsUp, ThumbsDown, RefreshCw, Lock, LogOut,
  BarChart2, MessageSquare, BookOpen, Loader2, AlertTriangle,
  CheckCircle, PlusCircle, Filter, ChevronLeft, ChevronRight,
  Wifi, WifiOff, Database,
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
            <div className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-4 bg-white rounded-lg p-3 border border-purple-100">
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
