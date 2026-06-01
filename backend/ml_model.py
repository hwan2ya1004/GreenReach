"""
GreenReach ML 모델 모듈
scikit-learn 기반 녹지 접근성 분석 AI

- RandomForestClassifier: 취약지 등급 분류 (우수/보통/취약)
- KNeighborsRegressor: 유사 지역 추천
- TF-IDF 앙상블 + 키워드 사전 + 지역명 추출: 자연어 질문 의도 분류 (AI 챗봇)
"""
from __future__ import annotations

import math
import re
import random
from typing import Any

import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.neighbors import NearestNeighbors
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import StandardScaler
from sklearn.metrics.pairwise import cosine_similarity

# ─── 전역 모델 캐시 ──────────────────────────────────────────────────────────
_rf_model: RandomForestClassifier | None = None
_knn_model: NearestNeighbors | None = None
_knn_districts: list[dict] | None = None
_scaler: StandardScaler | None = None

# TF-IDF 앙상블 (word + char_wb)
_tfidf_word: TfidfVectorizer | None = None
_tfidf_char: TfidfVectorizer | None = None
_intent_labels: list[str] = []
_intent_corpus: list[str] = []


# ─── 1. 특성 추출 ─────────────────────────────────────────────────────────────

def extract_features(districts: list[dict]) -> np.ndarray:
    """
    지역 통계 데이터 → ML 특성 벡터 변환
    특성: [공원수, 총면적(ha), 평균면적(ha), 공원수 로그, 면적 로그, 공원밀도 추정]
    """
    features = []
    for d in districts:
        park_count = d.get("parkCount", 0)
        total_area = d.get("totalArea", 0.0)
        avg_area = d.get("avgArea", 0.0)

        log_count = math.log1p(park_count)
        log_total = math.log1p(total_area / 10000)
        log_avg = math.log1p(avg_area / 10000)
        density = park_count / max(total_area / 1_000_000, 0.001)

        features.append([
            park_count,
            total_area / 10000,
            avg_area / 10000,
            log_count,
            log_total,
            log_avg,
            density,
        ])
    return np.array(features, dtype=float)


def assign_label(score: float) -> int:
    """점수 → 클래스 레이블 (0=취약, 1=보통, 2=우수)"""
    if score >= 70:
        return 2
    elif score >= 50:
        return 1
    else:
        return 0


# ─── 2. 점수 계산 (ML 학습용 기준 점수) ──────────────────────────────────────

def compute_base_score(d: dict, max_count: int) -> float:
    """공원 수/면적 기반 기준 점수 계산 (학습 레이블 생성용)"""
    park_count = d.get("parkCount", 0)
    total_area = d.get("totalArea", 0.0)
    avg_area = d.get("avgArea", 0.0)

    count_score = min(50, round((park_count / max(max_count, 1)) * 50))
    area_score = min(30, round(math.log10(total_area + 1) * 8))
    avg_score = min(20, round(math.log10(avg_area + 1) * 5))
    return min(99, max(1, count_score + area_score + avg_score))


# ─── 3. RandomForest 모델 학습 ────────────────────────────────────────────────

def train_rf_model(districts: list[dict]) -> RandomForestClassifier:
    """RandomForestClassifier 학습"""
    global _rf_model, _scaler

    if not districts:
        raise ValueError("학습 데이터가 없습니다.")

    max_count = max(d.get("parkCount", 0) for d in districts)
    X = extract_features(districts)
    y = np.array([assign_label(compute_base_score(d, max_count)) for d in districts])

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    rf = RandomForestClassifier(
        n_estimators=200,
        max_depth=8,
        min_samples_split=2,
        min_samples_leaf=1,
        random_state=42,
        class_weight="balanced",
    )
    rf.fit(X_scaled, y)

    _rf_model = rf
    _scaler = scaler
    return rf


def predict_grade(district_stat: dict) -> dict:
    """단일 지역 → ML 등급 예측"""
    global _rf_model, _scaler
    if _rf_model is None or _scaler is None:
        return {"grade": 1, "grade_label": "보통", "ml_score": 50, "probabilities": [0.2, 0.6, 0.2]}

    X = extract_features([district_stat])
    X_scaled = _scaler.transform(X)
    grade = int(_rf_model.predict(X_scaled)[0])
    proba = _rf_model.predict_proba(X_scaled)[0].tolist()

    label_map = {0: "취약", 1: "보통", 2: "우수"}
    ml_score = round(proba[0] * 20 + proba[1] * 55 + proba[2] * 90)

    return {
        "grade": grade,
        "grade_label": label_map[grade],
        "ml_score": ml_score,
        "probabilities": {
            "취약": round(proba[0] * 100, 1),
            "보통": round(proba[1] * 100, 1),
            "우수": round(proba[2] * 100, 1),
        },
    }


# ─── 4. KNN 유사 지역 추천 ────────────────────────────────────────────────────

def train_knn_model(districts: list[dict]) -> NearestNeighbors:
    """KNN 모델 학습 (유사 지역 추천용)"""
    global _knn_model, _knn_districts, _scaler

    if not districts:
        raise ValueError("학습 데이터가 없습니다.")

    X = extract_features(districts)
    if _scaler is not None:
        X_scaled = _scaler.transform(X)
    else:
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)
        _scaler = scaler

    knn = NearestNeighbors(n_neighbors=min(6, len(districts)), metric="euclidean")
    knn.fit(X_scaled)

    _knn_model = knn
    _knn_districts = districts
    return knn


def find_similar_districts(target_district: str, districts: list[dict], top_k: int = 5) -> list[dict]:
    """특정 지역과 녹지 환경이 유사한 지역 TOP K 반환"""
    global _knn_model, _knn_districts, _scaler

    if _knn_model is None or _knn_districts is None:
        return []

    target = next((d for d in districts if d.get("district") == target_district), None)
    if target is None:
        return []

    X_target = extract_features([target])
    if _scaler is not None:
        X_target = _scaler.transform(X_target)

    distances, indices = _knn_model.kneighbors(X_target, n_neighbors=min(top_k + 1, len(_knn_districts)))

    results = []
    for dist, idx in zip(distances[0], indices[0]):
        d = _knn_districts[idx]
        if d.get("district") == target_district:
            continue
        results.append({
            **d,
            "similarity_score": round(max(0, 100 - dist * 10), 1),
        })
        if len(results) >= top_k:
            break

    return results


# ─── 5. 자연어 의도 분류 (TF-IDF 앙상블 + 키워드 사전) ──────────────────────

# 의도별 학습 문장 (대폭 확장 - 다양한 자연어 표현 커버)
INTENT_CORPUS = {
    "best_district": [
        # 직접적 표현
        "가장 좋은 곳", "녹지 최고", "공원 많은 곳", "가장 우수한 지역",
        "녹지 1위", "공원 제일 많은", "최고 점수", "녹지 가장 좋은",
        "어디가 제일 좋아", "녹지 환경 최고", "공원 가장 많은 지역",
        "녹지 접근성 높은 곳", "공원 풍부한 지역", "녹지 최상위",
        # 자연어 표현
        "어디가 살기 좋아", "살기 좋은 동네", "공원 많은 동네 추천",
        "녹지 풍부한 곳 알려줘", "공원 제일 많은 지역 어디야",
        "어디가 녹지가 제일 많아", "공원 많은 곳 추천해줘",
        "녹지 환경 좋은 곳 어디야", "공원 많은 지역 알려줘",
        "어디가 공원이 제일 많아", "녹지 최고인 곳",
        "공원 가장 많은 곳 어디", "살기 좋은 곳 추천",
        "녹지 접근성 가장 좋은 지역", "공원 풍부한 동네",
        "어디가 제일 살기 좋을까", "녹지 환경 최고인 지역",
        "공원 많은 곳 어디야", "녹지 좋은 동네 어디",
        "가장 살기 좋은 지역", "공원 제일 많은 동네",
        "녹지 가장 풍부한 곳", "공원 많은 지역 순위 1위",
        "녹지가 가장 좋은 곳은", "녹지 가장 좋은 곳은",
        "공원이 가장 많은 곳은", "녹지 환경이 가장 좋은 곳",
    ],
    "worst_district": [
        # 직접적 표현
        "가장 나쁜 곳", "취약 지역", "녹지 부족", "공원 없는 곳",
        "최하위 지역", "녹지 최악", "공원 적은 곳", "취약한 지역",
        "녹지 접근성 낮은", "공원 부족한 지역", "녹지 열악",
        "개선 필요", "녹지 취약", "공원 가장 적은",
        "취약 지역은", "취약 지역 어디", "취약한 곳",
        "취약 지역 알려줘", "취약 지역 보여줘",
        # 자연어 표현
        "공원 없는 동네 어디야", "녹지 부족한 곳 알려줘",
        "어디가 공원이 제일 없어", "녹지 열악한 지역",
        "공원 적은 동네 어디야", "녹지 가장 나쁜 곳",
        "어디가 녹지가 제일 없어", "공원 부족한 곳 어디",
        "녹지 취약한 지역 어디야", "공원 없는 지역 알려줘",
        "어디가 제일 녹지가 없어", "녹지 환경 나쁜 곳",
        "공원 가장 적은 지역", "녹지 접근성 낮은 곳 어디야",
        "어디가 공원이 없어", "녹지 부족한 동네",
        "공원 없는 곳 어디야", "녹지 최하위 지역",
        "어디가 제일 살기 안 좋아", "녹지 환경 최악인 곳",
        "녹지 취약 지역 알려줘", "취약 지역 현황",
        "녹지 부족한 지역 어디야", "공원 제일 없는 곳",
        "녹지가 가장 부족한 곳은", "공원이 가장 없는 곳은",
        "어디가 제일 취약해", "녹지 취약 지역은 어디야",
    ],
    "stats_overview": [
        # 직접적 표현
        "전국 통계", "평균 얼마", "전체 현황", "전국 공원 수",
        "총 면적", "전국 평균", "전체 공원", "통계 알려줘",
        "전국 현황", "전체 통계", "공원 총계", "전국 분석",
        "전체 데이터", "요약 알려줘",
        # 자연어 표현
        "전국에 공원이 몇 개야", "전국 공원 현황 알려줘",
        "우리나라 공원 통계", "전국 녹지 현황 어때",
        "전체적으로 어때", "전국 평균이 어떻게 돼",
        "우리나라 녹지 상황", "전국 공원 몇 개나 있어",
        "전체 현황 요약해줘", "전국 녹지 통계 알려줘",
        "우리나라 전체 공원 수", "전국 공원 면적 얼마야",
        "전체 데이터 보여줘", "전국 현황 어떻게 돼",
        "우리나라 공원 얼마나 있어", "전국 녹지 면적",
        "전체 공원 통계 알려줘", "전국 분석 결과",
        "전국 평균 통계", "전국 녹지 평균",
        "우리나라 전체 녹지 현황", "전국 공원 통계 요약",
    ],
    "top_parks": [
        # 직접적 표현
        "공원 많은 TOP", "상위 지역", "공원 순위", "많은 순서",
        "공원 랭킹", "TOP 3", "TOP 5", "상위 5개",
        "공원 많은 순", "순위 알려줘", "공원 많은 지역 순위",
        # 자연어 표현
        "공원 많은 순서대로 알려줘", "공원 순위 알려줘",
        "어디가 공원 많은지 순서대로", "공원 많은 지역 TOP 5",
        "녹지 순위 알려줘", "공원 랭킹 알려줘",
        "공원 많은 곳 순위", "상위 지역 알려줘",
        "공원 많은 순서 알려줘", "녹지 많은 순위",
        "공원 순위 TOP 10", "공원 많은 지역 순서",
        "어디가 공원 많아 순서대로", "공원 랭킹 보여줘",
        "공원이 가장 많은 곳 순위", "녹지 많은 지역 순서대로",
    ],
    "ml_prediction": [
        # 직접적 표현
        "AI 예측", "머신러닝", "ML 분석", "예측 점수",
        "AI 분석", "인공지능 예측", "AI 점수", "예측 결과",
        "ML 점수", "AI가 분석한", "인공지능 분석",
        # 자연어 표현
        "AI가 뭐라고 해", "인공지능이 분석하면",
        "머신러닝으로 분석해줘", "AI 예측 결과 알려줘",
        "AI가 어떻게 예측해", "ML 모델 결과 알려줘",
        "인공지능 분석 결과", "AI 점수 알려줘",
        "머신러닝 예측 결과", "AI가 분석한 결과",
        "인공지능으로 분석해줘", "AI 예측 어때",
        "ML 분석 결과 보여줘", "AI 예측 점수 알려줘",
        "AI 예측 결과", "머신러닝 분석 결과",
        "AI로 분석해줘", "인공지능 예측 결과 알려줘",
    ],
    "similar_district": [
        # 직접적 표현
        "비슷한 지역", "유사한 곳", "같은 수준", "비슷한 환경",
        "유사 지역", "비슷한 녹지", "같은 환경", "유사한 녹지",
        "비슷한 공원", "같은 수준 지역",
        # 자연어 표현
        "비슷한 곳 어디야", "유사한 지역 알려줘",
        "같은 수준인 곳 어디야", "비슷한 환경인 곳",
        "어디가 비슷해", "유사한 녹지 환경 지역",
        "같은 수준 지역 알려줘", "비슷한 공원 환경",
        "어디랑 비슷해", "유사한 곳 추천해줘",
        "비슷한 수준 지역 어디야", "같은 환경인 곳 알려줘",
        "어디가 비슷한 수준이야", "유사 지역 추천",
        "비슷한 녹지 환경 어디야",
        "와 비슷한 지역", "랑 비슷한 곳",
        "와 유사한 지역", "랑 유사한 곳",
        "비슷한 곳 추천", "유사한 환경 지역 추천",
    ],
    "district_detail": [
        # 직접적 표현
        "현황 알려줘", "어떤가요", "공원 몇 개", "녹지 현황",
        "상세 정보", "자세히", "공원 정보", "녹지 정보",
        "어떻게 돼", "알려줘", "현황은",
        # 자연어 표현
        "공원 몇 개야", "녹지 어때", "공원 얼마나 있어",
        "녹지 현황 알려줘", "공원 정보 알려줘",
        "어떤 공원 있어", "공원 면적 얼마야",
        "녹지 면적 어떻게 돼", "공원 몇 개 있어",
        "녹지 상황 어때", "공원 현황 알려줘",
        "어떤 상황이야", "녹지 얼마나 있어",
        "공원 어떻게 돼", "녹지 정보 알려줘",
        "공원 상황 어때", "녹지 몇 개야",
        "현황 어때", "어떤지 알려줘",
        "공원 몇 개 있는지", "녹지 상황은",
    ],
    "recommendation": [
        # 이사/거주 추천
        "이사 가기 좋은 곳", "살기 좋은 동네 추천",
        "녹지 좋은 곳으로 이사", "공원 많은 곳 이사",
        "어디로 이사 가면 좋아", "녹지 환경 좋은 동네",
        "공원 가까운 동네 추천", "자연 환경 좋은 곳",
        "아이 키우기 좋은 곳", "산책하기 좋은 동네",
        "공원 많은 곳 추천해줘", "녹지 풍부한 동네 추천",
        "어디가 살기 좋을까", "이사 추천 지역",
        "녹지 환경 추천", "공원 많은 지역 추천",
    ],
    "improvement": [
        # 개선/정책 관련
        "개선이 필요한 곳", "녹지 확충 필요", "공원 부족 지역 개선",
        "정책 필요한 곳", "녹지 투자 필요", "공원 늘려야 할 곳",
        "녹지 개선 필요 지역", "공원 확충 필요한 곳",
        "어디가 개선이 필요해", "녹지 정책 필요한 지역",
        "공원 부족해서 개선 필요", "녹지 투자 우선 지역",
        "개선 우선순위 지역", "녹지 확충 우선 지역",
    ],
}

# 의도별 핵심 키워드 사전 (보조 매칭용)
INTENT_KEYWORDS = {
    "best_district": [
        "최고", "최상", "1위", "제일 좋", "가장 좋", "우수", "풍부", "많은",
        "살기 좋", "추천", "좋은 동네", "좋은 곳", "좋은 지역",
    ],
    "worst_district": [
        "최악", "최하", "꼴찌", "제일 나쁜", "가장 나쁜", "취약", "부족", "없는",
        "적은", "열악", "나쁜 곳", "나쁜 동네", "살기 안 좋",
    ],
    "stats_overview": [
        "전국", "전체", "통계", "평균", "총", "현황", "얼마나", "몇 개",
        "우리나라", "전반적", "요약",
    ],
    "top_parks": [
        "순위", "랭킹", "TOP", "상위", "순서", "1등", "2등", "3등",
        "많은 순", "높은 순",
    ],
    "ml_prediction": [
        "AI", "인공지능", "머신러닝", "ML", "예측", "분석", "점수",
        "모델", "딥러닝", "알고리즘",
    ],
    "similar_district": [
        "비슷", "유사", "같은 수준", "비교", "닮은", "유사한",
    ],
    "district_detail": [
        "현황", "정보", "상세", "자세히", "어때", "어떻게",
    ],
    "recommendation": [
        "이사", "추천", "살기", "거주", "아이", "산책", "자연",
    ],
    "improvement": [
        "개선", "확충", "투자", "정책", "늘려", "부족",
    ],
}


def _keyword_score(question: str) -> dict[str, float]:
    """키워드 사전 기반 의도별 점수 계산"""
    scores = {intent: 0.0 for intent in INTENT_KEYWORDS}
    q_lower = question.lower()
    for intent, keywords in INTENT_KEYWORDS.items():
        for kw in keywords:
            if kw in q_lower:
                scores[intent] += 1.0
    # 정규화
    total = sum(scores.values())
    if total > 0:
        scores = {k: v / total for k, v in scores.items()}
    return scores


def build_tfidf_model() -> None:
    """TF-IDF 앙상블 벡터라이저 학습 (word + char_wb)"""
    global _tfidf_word, _tfidf_char, _intent_labels, _intent_corpus

    corpus = []
    labels = []
    for intent, sentences in INTENT_CORPUS.items():
        for s in sentences:
            corpus.append(s)
            labels.append(intent)

    # Word-level TF-IDF
    word_vec = TfidfVectorizer(
        analyzer="word",
        ngram_range=(1, 2),
        min_df=1,
        sublinear_tf=True,
        token_pattern=r"(?u)\b\w+\b",
    )
    word_vec.fit(corpus)

    # Char-level TF-IDF (형태소 변형에 강함)
    char_vec = TfidfVectorizer(
        analyzer="char_wb",
        ngram_range=(2, 4),
        min_df=1,
        sublinear_tf=True,
    )
    char_vec.fit(corpus)

    _tfidf_word = word_vec
    _tfidf_char = char_vec
    _intent_labels = labels
    _intent_corpus = corpus


def classify_intent(question: str) -> tuple[str, float]:
    """
    질문 → 의도 분류 (TF-IDF 앙상블 + 키워드 사전 하이브리드)
    반환: (intent, confidence)
    """
    global _tfidf_word, _tfidf_char, _intent_labels, _intent_corpus

    if _tfidf_word is None or _tfidf_char is None:
        build_tfidf_model()

    # 1. Word TF-IDF 유사도
    q_word = _tfidf_word.transform([question])
    corpus_word = _tfidf_word.transform(_intent_corpus)
    sims_word = cosine_similarity(q_word, corpus_word)[0]

    # 2. Char TF-IDF 유사도
    q_char = _tfidf_char.transform([question])
    corpus_char = _tfidf_char.transform(_intent_corpus)
    sims_char = cosine_similarity(q_char, corpus_char)[0]

    # 3. 앙상블 (word 40% + char 60%)
    sims_ensemble = 0.4 * sims_word + 0.6 * sims_char

    # 의도별 최고 유사도 집계
    intent_scores: dict[str, float] = {}
    for idx, label in enumerate(_intent_labels):
        if label not in intent_scores or sims_ensemble[idx] > intent_scores[label]:
            intent_scores[label] = float(sims_ensemble[idx])

    # 4. 키워드 사전 보정 (TF-IDF 점수에 키워드 점수 20% 가중)
    kw_scores = _keyword_score(question)
    for intent in intent_scores:
        intent_scores[intent] = intent_scores[intent] * 0.8 + kw_scores.get(intent, 0.0) * 0.2

    best_intent = max(intent_scores, key=lambda k: intent_scores[k])
    best_score = intent_scores[best_intent]

    # 유사도가 너무 낮으면 unknown으로 폴백
    if best_score < 0.05:
        return "unknown", best_score

    # 신뢰도가 낮으면 (0.05~0.12) district_detail로 폴백
    if best_score < 0.12:
        return "district_detail", best_score

    return best_intent, best_score


# ─── 6. 지역명 추출 (축약형 포함) ────────────────────────────────────────────

def extract_mentioned_district(question: str, districts: list[dict]) -> dict | None:
    """
    질문에서 지역명 추출 (정확한 이름 + 축약형 모두 지원)
    예: "강남구" → 강남구, "강남" → 강남구, "수원" → 수원시
    """
    # 1순위: 정확한 지역명 매칭 (긴 이름 우선)
    sorted_districts = sorted(districts, key=lambda d: len(d.get("district", "")), reverse=True)
    for d in sorted_districts:
        name = d.get("district", "")
        if name in question:
            return d

    # 2순위: 축약형 매칭 (구/시/군 제거한 이름, 긴 것 우선)
    for d in sorted_districts:
        name = d.get("district", "")
        short = re.sub(r"(구|시|군)$", "", name)
        if len(short) >= 2 and short in question:
            return d

    # 3순위: 앞 3글자 이상 매칭 (오탐 방지를 위해 3글자 이상만)
    for d in sorted_districts:
        name = d.get("district", "")
        if len(name) >= 4:
            prefix = name[:3]
            if prefix in question:
                return d

    return None


# ─── 7. 응답 품질 향상을 위한 헬퍼 함수 ──────────────────────────────────────

def _grade_emoji(grade_label: str) -> str:
    """등급에 따른 이모지 반환"""
    return {"우수": "🟢", "보통": "🟡", "취약": "🔴"}.get(grade_label, "⚪")


def _area_description(area_ha: float) -> str:
    """면적을 직관적인 설명으로 변환"""
    if area_ha >= 100:
        return f"{area_ha:.0f}ha (여의도 공원의 약 {area_ha/22.9:.1f}배)"
    elif area_ha >= 10:
        return f"{area_ha:.1f}ha (축구장 약 {area_ha*1.4:.0f}개 규모)"
    elif area_ha >= 1:
        return f"{area_ha:.2f}ha (축구장 약 {area_ha*1.4:.1f}개 규모)"
    else:
        return f"{area_ha*10000:.0f}㎡"


def _park_count_description(count: int) -> str:
    """공원 수를 직관적인 설명으로 변환"""
    if count >= 500:
        return f"{count:,}개 (매우 풍부한 수준)"
    elif count >= 200:
        return f"{count:,}개 (풍부한 수준)"
    elif count >= 100:
        return f"{count:,}개 (보통 수준)"
    elif count >= 50:
        return f"{count:,}개 (다소 부족한 수준)"
    else:
        return f"{count:,}개 (부족한 수준)"


def _get_improvement_advice(grade_label: str, park_count: int, total_area_ha: float) -> str:
    """등급에 따른 개선 조언 생성"""
    if grade_label == "우수":
        return "현재 우수한 녹지 환경을 유지하고, 공원 시설 품질 향상에 집중하면 좋습니다."
    elif grade_label == "보통":
        if park_count < 100:
            return "소규모 근린공원 추가 조성으로 접근성을 높일 수 있습니다."
        else:
            return "기존 공원의 면적 확장 및 시설 개선을 통해 녹지 질을 높일 수 있습니다."
    else:  # 취약
        return "녹지 공간 확충이 시급합니다. 유휴 부지를 활용한 소공원 조성과 가로수 확대를 권장합니다."


def _get_living_tip(grade_label: str, district_name: str) -> str:
    """거주 관련 팁 생성"""
    if grade_label == "우수":
        return f"🏡 {district_name}은(는) 녹지 환경이 우수해 산책, 운동, 아이 양육에 적합한 지역입니다."
    elif grade_label == "보통":
        return f"🏡 {district_name}은(는) 평균적인 녹지 환경을 갖추고 있어 일상적인 공원 이용에 무리가 없습니다."
    else:
        return f"🏡 {district_name}은(는) 녹지가 다소 부족한 편입니다. 인근 지역 공원을 활용하는 것을 권장합니다."


# ─── 8. AI 챗봇 응답 생성 ────────────────────────────────────────────────────

def generate_ml_response(question: str, districts: list[dict]) -> dict:
    """
    ML 기반 AI 챗봇 응답 생성
    반환: {answer, intent, confidence, data}
    """
    if not districts:
        return {
            "answer": "데이터를 불러오는 중입니다. 잠시 후 다시 질문해주세요.",
            "intent": "unknown",
            "confidence": 0.0,
            "data": None,
        }

    # 의도 분류 (confidence 포함)
    intent, confidence = classify_intent(question)

    # 점수 계산
    max_count = max(d.get("parkCount", 0) for d in districts)
    scored = sorted(
        [{"score": compute_base_score(d, max_count), **d} for d in districts],
        key=lambda x: x["score"],
        reverse=True,
    )

    # 지역명 추출 (축약형 포함)
    mentioned_district = extract_mentioned_district(question, districts)

    # ── 의도별 응답 생성 ──────────────────────────────────────────────────────

    # 1. 최고 녹지 지역
    if intent == "best_district" and not mentioned_district:
        best = scored[0]
        pred = predict_grade(best)
        top3 = scored[:3]
        top3_lines = "\n".join(
            f"  {i+1}위. **{d['district']}** — 공원 {d['parkCount']:,}개, {d['totalArea']/10000:.0f}ha"
            for i, d in enumerate(top3)
        )
        answer = (
            f"🏆 전국 녹지 접근성 **1위 지역은 {best['district']}**입니다!\n\n"
            f"📊 **{best['district']} 상세 현황**\n"
            f"• 공원 수: {_park_count_description(best['parkCount'])}\n"
            f"• 총 녹지 면적: {_area_description(best['totalArea']/10000)}\n"
            f"• 평균 공원 면적: {best['avgArea']/10000:.2f}ha\n"
            f"• AI 예측 등급: {_grade_emoji(pred['grade_label'])} **{pred['grade_label']}** (ML 점수 {pred['ml_score']}점)\n"
            f"• 우수 확률: {pred['probabilities']['우수']}%\n\n"
            f"🥇 **TOP 3 지역**\n{top3_lines}\n\n"
            f"{_get_living_tip(pred['grade_label'], best['district'])}"
        )
        return {"answer": answer, "intent": intent, "confidence": round(confidence, 3), "data": best}

    # 2. 최악 녹지 지역
    elif intent == "worst_district" and not mentioned_district:
        worst = scored[-1]
        pred = predict_grade(worst)
        bottom3 = scored[-3:][::-1]
        bottom3_lines = "\n".join(
            f"  {i+1}. **{d['district']}** — 공원 {d['parkCount']:,}개, {d['totalArea']/10000:.1f}ha"
            for i, d in enumerate(bottom3)
        )
        vulnerable_count = sum(1 for d in scored if d["score"] < 50)
        answer = (
            f"⚠️ 전국에서 녹지 접근성이 가장 취약한 지역은 **{worst['district']}**입니다.\n\n"
            f"📊 **{worst['district']} 상세 현황**\n"
            f"• 공원 수: {_park_count_description(worst['parkCount'])}\n"
            f"• 총 녹지 면적: {_area_description(worst['totalArea']/10000)}\n"
            f"• AI 예측 등급: {_grade_emoji(pred['grade_label'])} **{pred['grade_label']}** (ML 점수 {pred['ml_score']}점)\n"
            f"• 취약 확률: {pred['probabilities']['취약']}%\n\n"
            f"🔴 **녹지 취약 하위 3개 지역**\n{bottom3_lines}\n\n"
            f"📌 현재 전국 {len(districts)}개 지역 중 **{vulnerable_count}개 지역**이 녹지 취약 상태(50점 미만)입니다.\n\n"
            f"💡 {_get_improvement_advice(pred['grade_label'], worst['parkCount'], worst['totalArea']/10000)}"
        )
        return {"answer": answer, "intent": intent, "confidence": round(confidence, 3), "data": worst}

    # 3. 전국 통계 개요
    elif intent == "stats_overview":
        total_parks = sum(d.get("parkCount", 0) for d in districts)
        total_area = sum(d.get("totalArea", 0.0) for d in districts)
        avg_parks = total_parks / len(districts) if districts else 0
        avg_area = total_area / len(districts) if districts else 0
        vulnerable = sum(1 for d in scored if d["score"] < 50)
        excellent = sum(1 for d in scored if d["score"] >= 70)
        answer = (
            f"📊 **전국 녹지 현황 종합 분석** (AI 기반)\n\n"
            f"🌳 **공원 현황**\n"
            f"• 전국 총 공원 수: **{total_parks:,}개**\n"
            f"• 전국 총 녹지 면적: **{total_area/10000:.0f}ha**\n"
            f"• 지역당 평균 공원 수: {avg_parks:.1f}개\n"
            f"• 지역당 평균 녹지 면적: {avg_area/10000:.1f}ha\n\n"
            f"🏙️ **지역 분포** ({len(districts)}개 구/군/시 분석)\n"
            f"• 🟢 우수 지역 (70점 이상): {excellent}개\n"
            f"• 🟡 보통 지역 (50~69점): {len(districts) - vulnerable - excellent}개\n"
            f"• 🔴 취약 지역 (50점 미만): {vulnerable}개\n\n"
            f"🏆 **공원 수 1위**: {scored[0]['district']} ({scored[0]['parkCount']:,}개)\n"
            f"⚠️ **녹지 최취약**: {scored[-1]['district']} ({scored[-1]['parkCount']:,}개)\n\n"
            f"💡 ML 모델이 {len(districts)}개 지역을 RandomForest + KNN 알고리즘으로 분석했습니다."
        )
        return {"answer": answer, "intent": intent, "confidence": round(confidence, 3), "data": None}

    # 4. 공원 순위 TOP
    elif intent == "top_parks":
        top5 = sorted(districts, key=lambda x: x.get("parkCount", 0), reverse=True)[:5]
        lines = "\n".join(
            f"  {i+1}위. **{d['district']}** — {d['parkCount']:,}개 공원 / {_area_description(d['totalArea']/10000)}"
            for i, d in enumerate(top5)
        )
        answer = (
            f"🌳 **공원이 가장 많은 지역 TOP 5**\n\n"
            f"{lines}\n\n"
            f"📌 1위 {top5[0]['district']}은(는) 꼴찌 {scored[-1]['district']}({scored[-1]['parkCount']:,}개)보다 "
            f"**{top5[0]['parkCount'] - scored[-1]['parkCount']:,}개** 더 많은 공원을 보유하고 있습니다."
        )
        return {"answer": answer, "intent": intent, "confidence": round(confidence, 3), "data": top5}

    # 5. ML 예측
    elif intent == "ml_prediction":
        if mentioned_district:
            pred = predict_grade(mentioned_district)
            d = mentioned_district
            answer = (
                f"🤖 **{d['district']} AI 예측 분석 결과**\n\n"
                f"• ML 예측 등급: {_grade_emoji(pred['grade_label'])} **{pred['grade_label']}**\n"
                f"• ML 종합 점수: **{pred['ml_score']}점**\n\n"
                f"📊 **등급별 확률**\n"
                f"• 🟢 우수: {pred['probabilities']['우수']}%\n"
                f"• 🟡 보통: {pred['probabilities']['보통']}%\n"
                f"• 🔴 취약: {pred['probabilities']['취약']}%\n\n"
                f"📌 **기반 데이터**\n"
                f"• 공원 수: {_park_count_description(d['parkCount'])}\n"
                f"• 총 녹지 면적: {_area_description(d['totalArea']/10000)}\n"
                f"• 평균 공원 면적: {d['avgArea']/10000:.2f}ha\n\n"
                f"💡 {_get_improvement_advice(pred['grade_label'], d['parkCount'], d['totalArea']/10000)}\n\n"
                f"🔬 RandomForest 모델 (200개 결정 트리) 기반 예측입니다."
            )
        else:
            top3_pred = [
                {**d, **predict_grade(d)} for d in scored[:3]
            ]
            bottom3_pred = [
                {**d, **predict_grade(d)} for d in scored[-3:][::-1]
            ]
            top_lines = "\n".join(
                f"  {i+1}. **{d['district']}**: {_grade_emoji(d['grade_label'])} {d['grade_label']} ({d['ml_score']}점) — 공원 {d['parkCount']:,}개"
                for i, d in enumerate(top3_pred)
            )
            bottom_lines = "\n".join(
                f"  {i+1}. **{d['district']}**: {_grade_emoji(d['grade_label'])} {d['grade_label']} ({d['ml_score']}점) — 공원 {d['parkCount']:,}개"
                for i, d in enumerate(bottom3_pred)
            )
            answer = (
                f"🤖 **AI 녹지 등급 예측 결과**\n\n"
                f"🟢 **우수 지역 TOP 3**\n{top_lines}\n\n"
                f"🔴 **취약 지역 TOP 3**\n{bottom_lines}\n\n"
                f"🔬 RandomForest 모델 (200개 결정 트리) 기반 예측입니다.\n"
                f"특정 지역을 알고 싶다면 \"강남구 AI 예측\" 처럼 지역명을 포함해 질문해보세요!"
            )
        return {"answer": answer, "intent": intent, "confidence": round(confidence, 3), "data": None}

    # 6. 유사 지역 추천
    elif intent == "similar_district":
        if mentioned_district:
            similar = find_similar_districts(mentioned_district["district"], districts, top_k=3)
            d = mentioned_district
            pred = predict_grade(d)
            if similar:
                lines = "\n".join(
                    f"  {i+1}. **{s['district']}** (유사도 {s['similarity_score']}점)\n"
                    f"     공원 {s['parkCount']:,}개 · {s['totalArea']/10000:.1f}ha"
                    for i, s in enumerate(similar)
                )
                answer = (
                    f"🔍 **{d['district']}**와 녹지 환경이 유사한 지역\n\n"
                    f"📌 기준 지역 현황: 공원 {d['parkCount']:,}개 · {d['totalArea']/10000:.1f}ha · {_grade_emoji(pred['grade_label'])} {pred['grade_label']}\n\n"
                    f"🗺️ **유사 지역 TOP 3**\n{lines}\n\n"
                    f"💡 유사도는 공원 수, 총 면적, 평균 면적을 기반으로 KNN 알고리즘이 계산합니다.\n"
                    f"이 지역들은 {d['district']}와 비슷한 녹지 정책 사례를 참고할 수 있습니다."
                )
            else:
                answer = f"유사 지역 분석 데이터가 부족합니다. 다른 지역으로 다시 시도해보세요."
            return {"answer": answer, "intent": intent, "confidence": round(confidence, 3), "data": similar if similar else None}
        else:
            # 지역명 없이 유사 지역 요청 → 안내 메시지
            answer = (
                f"🔍 **유사 지역 분석**을 원하시는군요!\n\n"
                f"어떤 지역을 기준으로 유사한 곳을 찾아드릴까요?\n\n"
                f"예시:\n"
                f"• \"강남구와 비슷한 지역은?\"\n"
                f"• \"수원시랑 유사한 곳 알려줘\"\n"
                f"• \"종로구와 비슷한 녹지 환경 지역\"\n\n"
                f"지역명을 포함해서 다시 질문해주세요! 😊"
            )
            return {"answer": answer, "intent": intent, "confidence": round(confidence, 3), "data": None}

    # 7. 이사/거주 추천
    elif intent == "recommendation":
        top5 = sorted(districts, key=lambda x: x.get("parkCount", 0), reverse=True)[:5]
        lines = "\n".join(
            f"  {i+1}. **{d['district']}** — 공원 {d['parkCount']:,}개 · {d['totalArea']/10000:.0f}ha"
            for i, d in enumerate(top5)
        )
        answer = (
            f"🏡 **녹지 환경 기준 거주 추천 지역 TOP 5**\n\n"
            f"{lines}\n\n"
            f"💡 **추천 기준**\n"
            f"• 공원 수가 많을수록 일상적인 녹지 접근성이 높습니다\n"
            f"• 평균 공원 면적이 클수록 쾌적한 공원 환경을 즐길 수 있습니다\n"
            f"• 특정 지역의 상세 정보는 \"강남구 현황 알려줘\"처럼 질문해보세요!"
        )
        return {"answer": answer, "intent": intent, "confidence": round(confidence, 3), "data": top5}

    # 8. 개선 필요 지역
    elif intent == "improvement":
        vulnerable = [d for d in scored if d["score"] < 50][:5]
        lines = "\n".join(
            f"  {i+1}. **{d['district']}** — 공원 {d['parkCount']:,}개 · {d['totalArea']/10000:.1f}ha · {d['score']}점"
            for i, d in enumerate(vulnerable)
        )
        answer = (
            f"🔧 **녹지 개선이 시급한 지역 TOP 5**\n\n"
            f"{lines}\n\n"
            f"📌 이 지역들은 녹지 접근성 점수가 50점 미만으로, 공원 확충이 필요합니다.\n\n"
            f"💡 **개선 방향**\n"
            f"• 유휴 부지를 활용한 소규모 근린공원 조성\n"
            f"• 가로수 및 도시 숲 확대\n"
            f"• 옥상 녹화, 벽면 녹화 등 입체 녹지 활용\n"
            f"• 인근 지역 공원과의 보행 네트워크 연결"
        )
        return {"answer": answer, "intent": intent, "confidence": round(confidence, 3), "data": vulnerable}

    # 9. 특정 지역 상세 (기본 폴백 - 지역명 있을 때)
    if mentioned_district:
        d = mentioned_district
        pred = predict_grade(d)
        similar = find_similar_districts(d["district"], districts, top_k=2)
        similar_text = ""
        if similar:
            similar_names = ", ".join(f"**{s['district']}**" for s in similar)
            similar_text = f"\n\n🔍 **유사한 녹지 환경 지역**: {similar_names}"

        answer = (
            f"📍 **{d['district']} 녹지 현황 분석**\n\n"
            f"🌳 **공원 현황**\n"
            f"• 공원 수: {_park_count_description(d['parkCount'])}\n"
            f"• 총 녹지 면적: {_area_description(d['totalArea']/10000)}\n"
            f"• 평균 공원 면적: {d['avgArea']/10000:.2f}ha\n\n"
            f"🤖 **AI 예측 결과**\n"
            f"• 예측 등급: {_grade_emoji(pred['grade_label'])} **{pred['grade_label']}** (ML 점수 {pred['ml_score']}점)\n"
            f"• 우수/보통/취약 확률: {pred['probabilities']['우수']}% / {pred['probabilities']['보통']}% / {pred['probabilities']['취약']}%\n\n"
            f"💡 {_get_improvement_advice(pred['grade_label'], d['parkCount'], d['totalArea']/10000)}"
            f"{similar_text}"
        )
        return {"answer": answer, "intent": "district_detail", "confidence": round(confidence, 3), "data": d}

    # 10. 완전 폴백
    return {
        "answer": (
            "죄송합니다, 질문을 정확히 이해하지 못했습니다. 😅\n\n"
            "다음과 같이 질문해보세요:\n\n"
            "• \"전국에서 녹지가 가장 좋은 곳은?\"\n"
            "• \"공원 없는 동네 어디야?\"\n"
            "• \"강남구 현황 알려줘\"\n"
            "• \"공원이 가장 많은 곳 순위\"\n"
            "• \"전국 평균 통계 알려줘\"\n"
            "• \"AI 예측 결과 알려줘\"\n"
            "• \"강남구와 비슷한 지역은?\"\n"
            "• \"이사 가기 좋은 녹지 지역 추천\"\n"
            "• \"녹지 개선이 필요한 곳은?\""
        ),
        "intent": "unknown",
        "confidence": 0.0,
        "data": None,
    }


# ─── 9. 모델 초기화 (앱 시작 시 호출) ───────────────────────────────────────

def initialize_models(districts: list[dict]) -> dict:
    """앱 시작 시 모든 ML 모델 학습"""
    if not districts:
        return {"status": "skipped", "reason": "데이터 없음"}

    try:
        train_rf_model(districts)
        train_knn_model(districts)
        build_tfidf_model()

        return {
            "status": "ok",
            "districts_trained": len(districts),
            "models": ["RandomForestClassifier", "KNearestNeighbors", "TF-IDF"],
        }
    except Exception as e:
        return {"status": "error", "reason": str(e)}
