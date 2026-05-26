# 🌿 GreenReach · 그린리치

> **위치정보 기반 도시 녹지 접근성 시민 플랫폼**  
> 2026 LBS 스타트업 챌린지 출품작

"내 주변 공원이 얼마나 가까운지, 데이터로 보여드립니다"

---

## 🚀 빠른 시작

### 프론트엔드 실행

```bash
cd frontend
npm install
npm run dev
```

브라우저에서 **http://localhost:5173** 접속

### 백엔드 실행 (선택)

```bash
cd backend
pip install -r requirements.txt
python main.py
```

API 문서: **http://localhost:8000/docs**

---

## 📱 주요 기능

| 페이지 | 경로 | 설명 |
|--------|------|------|
| 홈 (랜딩) | `/` | 서비스 소개, 문제 정의, 기능 설명 |
| 내 동네 분석 | `/map` | 실시간 위치 기반 접근성 점수 + 지도 |
| 동네 비교 | `/compare` | 두 자치구 녹지 환경 비교 (레이더/막대 차트) |
| 지자체 대시보드 | `/dashboard` | 25개 구 현황 + AI 취약지 예측 + 챗봇 |

---

## 🛠 기술 스택

### 프론트엔드
- **React 19** + TypeScript + Vite
- **Tailwind CSS** — 스타일링
- **React Router v7** — 라우팅
- **React Leaflet** — OpenStreetMap 기반 지도
- **Recharts** — 데이터 시각화 (막대/레이더 차트)
- **Lucide React** — 아이콘

### 백엔드
- **FastAPI** (Python) — REST API
- **Uvicorn** — ASGI 서버
- 향후: **PostGIS** + **OSM** 보행 네트워크 분석

### 데이터
- 서울시 공원 70개+ 샘플 데이터
- 25개 자치구 녹지 통계
- AI 취약지 예측 데이터 (12개 동)

---

## 📊 접근성 점수 계산 방식

```
총점 (0~100) = 거리 점수 (0~50) + 밀도 점수 (0~30) + 면적 점수 (0~20)
```

| 등급 | 점수 | 의미 |
|------|------|------|
| A | 80~100 | 도보 5분 내 공원 접근 가능 |
| B | 65~79 | 도보 10분 내 공원 접근 가능 |
| C | 50~64 | 도보 15분 내 공원 접근 가능 |
| D | 35~49 | 공원까지 상당한 거리 소요 |
| F | 0~34 | 녹지 접근성 개선 시급 |

> 직선거리 × 1.3 (서울 평균 도로 네트워크 계수) = 실제 도보 거리 추정

---

## 📁 프로젝트 구조

```
GreenReach/
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Landing.tsx      # 홈 페이지
│   │   │   ├── MapView.tsx      # 지도 + 접근성 분석
│   │   │   ├── Compare.tsx      # 동네 비교
│   │   │   └── Dashboard.tsx    # 지자체 대시보드 + AI 챗봇
│   │   ├── components/
│   │   │   └── Navbar.tsx
│   │   ├── data/
│   │   │   ├── parks.ts         # 서울 공원 70개+ 데이터
│   │   │   └── districtStats.ts # 25개 구 통계 + 취약지 데이터
│   │   ├── utils/
│   │   │   └── accessibility.ts # 접근성 점수 계산 로직
│   │   └── types/
│   │       └── index.ts         # TypeScript 타입 정의
│   └── ...
└── backend/
    ├── main.py                  # FastAPI 서버
    └── requirements.txt
```

---

## 🎯 비즈니스 모델

| 단계 | 수익원 | 타겟 | 단가 |
|------|--------|------|------|
| ① 핵심 | 지자체 리포트 구독 | 구청 도시계획과 | 연 300~500만원/구 |
| ② 연계 | 추가 분석 서비스 | 리포트 납품 구청 | 건당 100~300만원 |
| ③ 보조 | 프리미엄 앱 | 이사 예정자, 영유아 부모 | 월 2,900원 |
| ④ 장기 | 정부 연구용역 | 환경부, 국토부 | 건당 3,000만원+ |

---

## 📜 활용 공공데이터

- 전국 도시공원 정보 (공공데이터포털 data.go.kr)
- VWorld 공간정보 오픈API (LX한국국토정보공사)
- OSM(OpenStreetMap) 보행 네트워크
- 주민등록 인구 통계 (행정안전부)

---

© 2026 GreenReach · 2026 LBS 스타트업 챌린지
