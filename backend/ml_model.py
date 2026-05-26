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
    ],
    "worst_district": [
        # 직접적 표현
        "가장 나쁜 곳", "취약 지역", "녹지 부족", "공원 없는 곳",
        "최하위 지역", "녹지 최악", "공원 적은 곳", "취약한 지역",
        "녹지 접근성 낮은", "공원 부족한 지역", "녹지 열악",
        "개선 필요", "녹지 취약", "공원 가장 적은",
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

    # 유사도가 너무 낮으면 district_detail로 폴백
    if best_score < 0.03:
        return "district_detail", best_score

    return best_intent, best_score


# ─── 6. 지역명 추출 (축약형 포함) ────────────────────────────────────────────

def extract_mentioned_district(question: str, districts: list[dict]) -> dict | None:
    """
    질문에서 지역명 추출 (정확한 이름 + 축약형 모두 지원)
    예: "강남구" → 강남구, "강남" → 강남구, "수원" → 수원시
    """
    # 1순위: 정확한 지역명 매칭
    for d in districts:
        name = d.get("district", "")
        if name in question:
            return d

    # 2순위: 축약형 매칭 (구/시/군 제거한 이름)
    for d in districts:
        name = d.get("district", "")
        # 끝의 행정구역 단위 제거
        short = re.sub(r"(구|시|군)$", "", name)
        if len(short) >= 2 and short in question:
            return d

    # 3순위: 부분 포함 매칭 (2글자 이상)
    for d in districts:
        name = d.get("district", "")
        if len(name) >= 3:
            # 이름의 앞 2글자가 질문에 포함되는지
            prefix = name[:2]
            if prefix in question:
                return d

    return None


# ─── 7. AI 챗봇 응답 생성 ────────────────────────────────────────────────────

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

    # 의도별 응답 생성
    if intent == "best_district" and not mentioned_district:
        best = scored[0]
        pred = predict_grade(best)
        answer = (
            f"🏆 전국에서 녹지 접근성이 가장 우수한 지역은 **{best['district']}**입니다.\n\n"
            f"• 공원 수: {best['parkCount']}개\n"
            f"• 총 녹지 면적: {best['totalArea']/10000:.0f}ha\n"
            f"• AI 예측 등급: {pred['grade_label']} (ML 점수 {pred['ml_score']}점)\n"
            f"• 우수 확률: {pred['probabilities']['우수']}%"
        )
        return {"answer": answer, "intent": intent, "confidence": round(confidence, 3), "data": best}

    elif intent == "worst_district" and not mentioned_district:
        worst = scored[-1]
        pred = predict_grade(worst)
        answer = (
            f"⚠️ 전국에서 녹지 접근성이 가장 취약한 지역은 **{worst['district']}**입니다.\n\n"
            f"• 공원 수: {worst['parkCount']}개\n"
            f"• 총 녹지 면적: {worst['totalArea']/10000:.1f}ha\n"
            f"• AI 예측 등급: {pred['grade_label']} (ML 점수 {pred['ml_score']}점)\n"
            f"• 취약 확률: {pred['probabilities']['취약']}%\n\n"
            f"녹지 공간 확충이 시급합니다."
        )
        return {"answer": answer, "intent": intent, "confidence": round(confidence, 3), "data": worst}

    elif intent == "stats_overview":
        total_parks = sum(d.get("parkCount", 0) for d in districts)
        total_area = sum(d.get("totalArea", 0.0) for d in districts)
        vulnerable = sum(1 for d in scored if d["score"] < 50)
        answer = (
            f"📊 전국 녹지 현황 (AI 분석):\n\n"
            f"• 총 공원 수: {total_parks:,}개\n"
            f"• 총 녹지 면적: {total_area/10000:.0f}ha\n"
            f"• 분석 지역 수: {len(districts)}개 구/군/시\n"
            f"• 녹지 취약 지역: {vulnerable}개 (점수 50점 미만)\n"
            f"• 공원 수 1위: {scored[0]['district']} ({scored[0]['parkCount']}개)\n\n"
            f"ML 모델이 {len(districts)}개 지역을 분석했습니다."
        )
        return {"answer": answer, "intent": intent, "confidence": round(confidence, 3), "data": None}

    elif intent == "top_parks":
        top5 = sorted(districts, key=lambda x: x.get("parkCount", 0), reverse=True)[:5]
        lines = "\n".join(
            f"{i+1}. **{d['district']}**: {d['parkCount']}개 공원 ({d['totalArea']/10000:.0f}ha)"
            for i, d in enumerate(top5)
        )
        answer = f"🌳 공원이 가장 많은 지역 TOP 5:\n\n{lines}"
        return {"answer": answer, "intent": intent, "confidence": round(confidence, 3), "data": top5}

    elif intent == "ml_prediction":
        if mentioned_district:
            pred = predict_grade(mentioned_district)
            answer = (
                f"🤖 **{mentioned_district['district']}** AI 예측 결과:\n\n"
                f"• ML 예측 등급: **{pred['grade_label']}**\n"
                f"• ML 점수: {pred['ml_score']}점\n"
                f"• 취약 확률: {pred['probabilities']['취약']}%\n"
                f"• 보통 확률: {pred['probabilities']['보통']}%\n"
                f"• 우수 확률: {pred['probabilities']['우수']}%\n\n"
                f"RandomForest 모델 (200개 트리) 기반 예측입니다."
            )
        else:
            top3_pred = [
                {**d, **predict_grade(d)} for d in scored[:3]
            ]
            lines = "\n".join(
                f"{i+1}. {d['district']}: {d['grade_label']} ({d['ml_score']}점)"
                for i, d in enumerate(top3_pred)
            )
            answer = f"🤖 AI 예측 상위 지역 TOP 3:\n\n{lines}\n\nRandomForest 모델 기반 예측입니다."
        return {"answer": answer, "intent": intent, "confidence": round(confidence, 3), "data": None}

    elif intent == "similar_district" and mentioned_district:
        similar = find_similar_districts(mentioned_district["district"], districts, top_k=3)
        if similar:
            lines = "\n".join(
                f"{i+1}. **{d['district']}** (유사도 {d['similarity_score']}점) - 공원 {d['parkCount']}개"
                for i, d in enumerate(similar)
            )
            answer = (
                f"🔍 **{mentioned_district['district']}**와 녹지 환경이 유사한 지역:\n\n"
                f"{lines}\n\nKNN 알고리즘 기반 유사도 분석 결과입니다."
            )
        else:
            answer = f"유사 지역 분석 데이터가 부족합니다."
        return {"answer": answer, "intent": intent, "confidence": round(confidence, 3), "data": similar}

    # 특정 지역 상세 (기본 폴백)
    if mentioned_district:
        d = mentioned_district
        pred = predict_grade(d)
        answer = (
            f"📍 **{d['district']}** 녹지 현황:\n\n"
            f"• 공원 수: {d['parkCount']}개\n"
            f"• 총 녹지 면적: {d['totalArea']/10000:.1f}ha\n"
            f"• 평균 공원 면적: {d['avgArea']/10000:.2f}ha\n"
            f"• AI 예측 등급: **{pred['grade_label']}** (ML 점수 {pred['ml_score']}점)\n"
            f"• 취약/보통/우수 확률: {pred['probabilities']['취약']}% / {pred['probabilities']['보통']}% / {pred['probabilities']['우수']}%"
        )
        return {"answer": answer, "intent": "district_detail", "confidence": round(confidence, 3), "data": d}

    # 완전 폴백
    return {
        "answer": (
            "죄송합니다, 질문을 이해하지 못했습니다. 다음과 같이 질문해보세요:\n\n"
            "• \"전국에서 녹지가 가장 좋은 곳은?\"\n"
            "• \"공원 없는 동네 어디야?\"\n"
            "• \"강남구 현황 알려줘\"\n"
            "• \"공원이 가장 많은 곳은?\"\n"
            "• \"전국 평균 통계\"\n"
            "• \"AI 예측 결과 알려줘\"\n"
            "• \"강남구와 비슷한 지역은?\""
        ),
        "intent": "unknown",
        "confidence": 0.0,
        "data": None,
    }


# ─── 8. 모델 초기화 (앱 시작 시 호출) ───────────────────────────────────────

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
