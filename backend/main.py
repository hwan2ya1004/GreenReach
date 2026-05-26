"""
GreenReach Backend API v0.5.0
위치정보 기반 도시 녹지 접근성 시민 플랫폼
PostgreSQL + PostGIS 공간 분석 + OSM 보행 네트워크 + 경사도 반영
scikit-learn ML 기반 AI 녹지 어시스턴트
"""
import json
import math
import os
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, Query, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text

from .database import engine, Base, get_db, DATABASE_URL
from .osm_walker import calc_walking_route, calc_accessibility_score_osm
from . import ml_model

# ─── 앱 초기화 ────────────────────────────────────────────────────────────────

USE_DB = False  # DB 연결 가능 여부 (시작 시 자동 감지)


# ─── ML 모델 캐시 (지역 통계 데이터) ─────────────────────────────────────────
_ml_districts_cache: list[dict] = []


def _get_district_list() -> list[dict]:
    """ML 모델용 지역 통계 데이터 로드 (캐시 우선)"""
    global _ml_districts_cache
    if _ml_districts_cache:
        return _ml_districts_cache

    parks = load_csv_fallback()
    stats: dict = {}
    ADMIN_SUFFIXES = ("광역시", "특별시", "특별자치시", "특별자치도")
    for p in parks:
        d = p["district"]
        if d == "기타" or len(d) < 3:
            continue
        if any(c.isdigit() or c == '-' for c in d):
            continue
        if not d.endswith(("구", "시", "군")):
            continue
        ends_with_admin = any(d.endswith(s) for s in ADMIN_SUFFIXES)
        has_admin_in_middle = any(keyword in d for keyword in ADMIN_SUFFIXES) and not ends_with_admin
        if has_admin_in_middle or len(d) > 10:
            continue
        if d not in stats:
            stats[d] = {"district": d, "parkCount": 0, "totalArea": 0.0}
        stats[d]["parkCount"] += 1
        stats[d]["totalArea"] += p.get("area", 0)

    result = []
    for s in stats.values():
        avg = s["totalArea"] / s["parkCount"] if s["parkCount"] > 0 else 0.0
        result.append({**s, "avgArea": avg})

    _ml_districts_cache = result
    return result


@asynccontextmanager
async def lifespan(app: FastAPI):
    """서버 시작/종료 시 실행"""
    global USE_DB
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        USE_DB = True
        print("[GreenReach] ✅ PostgreSQL + PostGIS 연결 성공")
        # 테이블 자동 생성 (없을 경우)
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        USE_DB = False
        print(f"[GreenReach] ⚠️  DB 연결 실패 → CSV 폴백 모드: {e}")

    # ML 모델 초기화 (scikit-learn)
    try:
        districts = _get_district_list()
        result = ml_model.initialize_models(districts)
        print(f"[GreenReach] 🤖 ML 모델 초기화: {result}")
    except Exception as e:
        print(f"[GreenReach] ⚠️  ML 모델 초기화 실패: {e}")

    yield


app = FastAPI(
    title="GreenReach API",
    description="위치정보 기반 도시 녹지 접근성 분석 API (PostGIS 공간 분석)",
    version="0.3.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── CSV 폴백 (DB 없을 때) ────────────────────────────────────────────────────

CSV_PATH = os.path.join(os.path.dirname(__file__), "..", "전국도시공원정보표준데이터.csv")

PARK_TYPE_MAP = {
    "근린공원": "근린공원", "어린이공원": "어린이공원", "소공원": "소공원",
    "체육공원": "체육공원", "역사공원": "역사공원", "문화공원": "문화공원",
    "수변공원": "수변공원", "묘지공원": "묘지공원", "도시농업공원": "도시농업공원",
    "방재공원": "방재공원", "광역공원": "광역공원", "주제공원": "주제공원",
}

_csv_cache: list[dict] | None = None


def load_csv_fallback() -> list[dict]:
    global _csv_cache
    if _csv_cache is not None:
        return _csv_cache
    import csv as csv_mod
    parks = []
    try:
        with open(CSV_PATH, encoding="cp949") as f:
            reader = csv_mod.DictReader(f)
            for i, row in enumerate(reader):
                try:
                    lat = float(row.get("위도", "").strip())
                    lng = float(row.get("경도", "").strip())
                    if not (33.0 <= lat <= 38.9 and 124.0 <= lng <= 132.0):
                        continue
                    name = row.get("공원명", "").strip()
                    if not name:
                        continue
                    address = (row.get("소재지도로명주소") or row.get("소재지지번주소") or "").strip()
                    parts = address.split()
                    district = next(
                        (p for p in parts if p.endswith("구") and len(p) >= 3),
                        next(
                            (p for p in parts if p.endswith("시") and len(p) >= 3
                             and p not in ("특별시", "광역시", "특별자치시", "특별자치도")),
                            next(
                                (p for p in parts if p.endswith("군") and len(p) >= 3),
                                "기타"
                            )
                        )
                    )
                    park_type = PARK_TYPE_MAP.get(row.get("공원구분", "").strip(), "기타")
                    try:
                        area = float(row.get("공원면적", "0").strip() or "0")
                    except ValueError:
                        area = 0.0
                    fac_cols = ["공원보유시설(운동시설)", "공원보유시설(유희시설)",
                                "공원보유시설(편익시설)", "공원보유시설(교양시설)", "공원보유시설(기타시설)"]
                    facilities = []
                    for col in fac_cols:
                        val = row.get(col, "").strip()
                        if val:
                            facilities.extend([v.strip() for v in val.replace("/", ",").split(",") if v.strip()][:3])
                    facilities = facilities[:6]
                    fac_str = " ".join(facilities)
                    parks.append({
                        "id": row.get("관리번호", f"park_{i}").strip(),
                        "name": name, "type": park_type, "district": district,
                        "address": address, "lat": lat, "lng": lng, "area": area,
                        "facilities": facilities,
                        "childFriendly": park_type == "어린이공원" or "놀이" in fac_str or "유희" in fac_str,
                        "petFriendly": "반려" in fac_str or park_type in ["근린공원", "수변공원"],
                        "accessible": "장애" in fac_str or area >= 10000,
                        "manager": row.get("관리기관명", "").strip(),
                        "phone": row.get("전화번호", "").strip(),
                        "dataDate": row.get("데이터기준일자", "").strip(),
                    })
                except (ValueError, KeyError):
                    continue
    except FileNotFoundError:
        pass
    _csv_cache = parks
    return parks


# ─── 유틸리티 ────────────────────────────────────────────────────────────────

def haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371000
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = (math.sin(d_lat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(d_lng / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def calc_walking_distance(straight_m: float) -> int:
    return int(straight_m * 1.3)


def calc_walking_time(walking_m: int) -> int:
    return max(1, round(walking_m / 67))


def calc_score_from_parks(nearest_dist: float, nearest_park: dict,
                           count_500: int, count_1km: int) -> dict:
    walking_dist = calc_walking_distance(nearest_dist)
    walking_time = calc_walking_time(walking_dist)

    if walking_dist <= 300:
        dist_score = 50
    elif walking_dist <= 500:
        dist_score = 45
    elif walking_dist <= 800:
        dist_score = 38
    elif walking_dist <= 1000:
        dist_score = 30
    elif walking_dist <= 1500:
        dist_score = 20
    elif walking_dist <= 2000:
        dist_score = 12
    else:
        dist_score = max(0, int(10 - (walking_dist - 2000) / 500))

    density_score = min(30, count_500 * 8 + count_1km * 3)

    area = nearest_park.get("area", 0)
    if area >= 100000:
        area_score = 20
    elif area >= 50000:
        area_score = 16
    elif area >= 10000:
        area_score = 12
    elif area >= 3000:
        area_score = 8
    elif area >= 1000:
        area_score = 4
    else:
        area_score = 2

    total = dist_score + density_score + area_score
    grade = "A" if total >= 80 else "B" if total >= 65 else "C" if total >= 50 else "D" if total >= 35 else "F"

    return {
        "score": total, "grade": grade,
        "nearestPark": nearest_park,
        "walkingDistance": walking_dist, "walkingTime": walking_time,
        "parkCount500m": count_500, "parkCount1km": count_1km,
        "distScore": dist_score, "densityScore": density_score, "areaScore": area_score,
    }


def row_to_park(row) -> dict:
    """DB 행 → 프론트엔드 형식 변환"""
    try:
        facilities = json.loads(row.facilities) if row.facilities else []
    except (json.JSONDecodeError, TypeError):
        facilities = []
    return {
        "id": row.id, "name": row.name, "type": row.type,
        "district": row.district, "address": row.address or "",
        "lat": row.lat, "lng": row.lng, "area": row.area or 0,
        "facilities": facilities,
        "childFriendly": bool(row.child_friendly),
        "petFriendly": bool(row.pet_friendly),
        "accessible": bool(row.accessible),
        "manager": row.manager or "", "phone": row.phone or "",
        "dataDate": row.data_date or "",
    }


# ─── 라우터 ──────────────────────────────────────────────────────────────────

@app.get("/")
def root(db: Session = Depends(get_db)):
    if USE_DB:
        try:
            count = db.execute(text("SELECT COUNT(*) FROM parks")).scalar()
            return {
                "service": "GreenReach API", "version": "0.3.0", "status": "running",
                "db": "PostgreSQL + PostGIS",
                "data_source": "공공데이터포털 전국도시공원정보표준데이터",
                "parks_loaded": count, "docs": "/docs",
            }
        except Exception:
            pass
    parks = load_csv_fallback()
    return {
        "service": "GreenReach API", "version": "0.3.0", "status": "running",
        "db": "CSV 폴백 모드", "parks_loaded": len(parks), "docs": "/docs",
    }


@app.get("/health")
def health(db: Session = Depends(get_db)):
    if USE_DB:
        try:
            count = db.execute(text("SELECT COUNT(*) FROM parks")).scalar()
            return {"status": "ok", "db": "postgis", "parks_loaded": count}
        except Exception:
            pass
    return {"status": "ok", "db": "csv_fallback", "parks_loaded": len(load_csv_fallback())}


@app.get("/api/parks/nearby")
def get_nearby_parks(
    lat: float = Query(...),
    lng: float = Query(...),
    radius: int = Query(2000, le=10000),
    limit: int = Query(20, le=100),
    db: Session = Depends(get_db),
):
    """위치 기반 주변 공원 조회 (PostGIS ST_DWithin 공간 쿼리)"""
    if USE_DB:
        try:
            # PostGIS 공간 쿼리: ST_DWithin으로 반경 내 공원 조회
            # ST_Distance_Sphere로 정확한 거리 계산
            rows = db.execute(text("""
                SELECT *,
                    ST_Distance(
                        geom::geography,
                        ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
                    ) AS straight_distance
                FROM parks
                WHERE ST_DWithin(
                    geom::geography,
                    ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
                    :radius
                )
                ORDER BY straight_distance
                LIMIT :limit
            """), {"lat": lat, "lng": lng, "radius": radius, "limit": limit}).fetchall()

            parks = []
            for row in rows:
                p = row_to_park(row)
                straight_dist = float(row.straight_distance)
                walking_dist = calc_walking_distance(straight_dist)
                p.update({
                    "straightDistance": int(straight_dist),
                    "walkingDistance": walking_dist,
                    "walkingTime": calc_walking_time(walking_dist),
                })
                parks.append(p)

            return {"total": len(parks), "radius_m": radius, "db": "postgis", "parks": parks}
        except Exception as e:
            print(f"[DB 오류] nearby: {e}")

    # CSV 폴백
    all_parks = load_csv_fallback()
    nearby = []
    for park in all_parks:
        dist = haversine(lat, lng, park["lat"], park["lng"])
        if dist <= radius:
            walking_dist = calc_walking_distance(dist)
            nearby.append({**park, "straightDistance": int(dist),
                           "walkingDistance": walking_dist,
                           "walkingTime": calc_walking_time(walking_dist)})
    nearby.sort(key=lambda x: x["straightDistance"])
    return {"total": len(nearby[:limit]), "radius_m": radius, "db": "csv_fallback", "parks": nearby[:limit]}


@app.get("/api/accessibility")
def get_accessibility(
    lat: float = Query(...),
    lng: float = Query(...),
    db: Session = Depends(get_db),
):
    """위치 기반 녹지 접근성 점수 계산 (PostGIS 공간 분석)"""
    if not (33.0 <= lat <= 38.9 and 124.0 <= lng <= 132.0):
        return {"error": "대한민국 범위를 벗어난 좌표입니다", "score": 0, "grade": "F"}

    if USE_DB:
        try:
            # 가장 가까운 공원 (PostGIS KNN 쿼리)
            nearest_row = db.execute(text("""
                SELECT *,
                    ST_Distance(
                        geom::geography,
                        ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
                    ) AS straight_distance
                FROM parks
                ORDER BY geom <-> ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)
                LIMIT 1
            """), {"lat": lat, "lng": lng}).fetchone()

            if not nearest_row:
                return {"error": "주변 공원 데이터 없음", "score": 0, "grade": "F"}

            nearest_park = row_to_park(nearest_row)
            nearest_dist = float(nearest_row.straight_distance)

            # 500m / 1km 내 공원 수
            counts = db.execute(text("""
                SELECT
                    COUNT(*) FILTER (WHERE ST_DWithin(
                        geom::geography,
                        ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, 500
                    )) AS count_500,
                    COUNT(*) FILTER (WHERE ST_DWithin(
                        geom::geography,
                        ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, 1000
                    )) AS count_1km
                FROM parks
            """), {"lat": lat, "lng": lng}).fetchone()

            result = calc_score_from_parks(
                nearest_dist, nearest_park,
                int(counts.count_500), int(counts.count_1km)
            )
            result["data_source"] = "공공데이터포털 전국도시공원정보표준데이터 (PostGIS)"
            result["db"] = "postgis"
            return result

        except Exception as e:
            print(f"[DB 오류] accessibility: {e}")

    # CSV 폴백
    all_parks = load_csv_fallback()
    if not all_parks:
        return {"error": "공원 데이터 없음", "score": 0, "grade": "F"}
    distances = sorted([(haversine(lat, lng, p["lat"], p["lng"]), p) for p in all_parks], key=lambda x: x[0])
    nearest_dist, nearest_park = distances[0]
    count_500 = sum(1 for d, _ in distances if d <= 500)
    count_1km = sum(1 for d, _ in distances if d <= 1000)
    result = calc_score_from_parks(nearest_dist, nearest_park, count_500, count_1km)
    result["data_source"] = "공공데이터포털 전국도시공원정보표준데이터 (CSV)"
    result["db"] = "csv_fallback"
    return result


@app.get("/api/parks")
def get_parks(
    district: Optional[str] = Query(None),
    park_type: Optional[str] = Query(None),
    child_friendly: Optional[bool] = Query(None),
    pet_friendly: Optional[bool] = Query(None),
    accessible: Optional[bool] = Query(None),
    limit: int = Query(500, le=2000),
    db: Session = Depends(get_db),
):
    """공원 목록 반환"""
    if USE_DB:
        try:
            where_clauses = []
            params: dict = {"limit": limit}
            if district:
                where_clauses.append("district = :district")
                params["district"] = district
            if park_type:
                where_clauses.append("type = :park_type")
                params["park_type"] = park_type
            if child_friendly is not None:
                where_clauses.append("child_friendly = :child_friendly")
                params["child_friendly"] = child_friendly
            if pet_friendly is not None:
                where_clauses.append("pet_friendly = :pet_friendly")
                params["pet_friendly"] = pet_friendly
            if accessible is not None:
                where_clauses.append("accessible = :accessible")
                params["accessible"] = accessible

            where_sql = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""
            rows = db.execute(text(f"SELECT * FROM parks {where_sql} LIMIT :limit"), params).fetchall()
            parks = [row_to_park(r) for r in rows]
            return {"total": len(parks), "db": "postgis",
                    "data_source": "공공데이터포털 전국도시공원정보표준데이터", "parks": parks}
        except Exception as e:
            print(f"[DB 오류] parks: {e}")

    parks = load_csv_fallback()
    if district:
        parks = [p for p in parks if p["district"] == district]
    if park_type:
        parks = [p for p in parks if p["type"] == park_type]
    return {"total": len(parks[:limit]), "db": "csv_fallback",
            "data_source": "공공데이터포털 전국도시공원정보표준데이터", "parks": parks[:limit]}


@app.get("/api/districts/stats")
def get_district_stats(db: Session = Depends(get_db)):
    """자치구별 녹지 통계"""
    if USE_DB:
        try:
            rows = db.execute(text("""
                SELECT district,
                    COUNT(*) AS park_count,
                    SUM(area) AS total_area,
                    AVG(area) AS avg_area
                FROM parks
                WHERE district != '기타'
                  AND LENGTH(district) >= 3
                  AND district ~ '^[가-힣]+$'
                  AND (district LIKE '%구' OR district LIKE '%시' OR district LIKE '%군')
                  AND district NOT SIMILAR TO '%(광역시|특별시|특별자치시|특별자치도)%구'
                GROUP BY district
                ORDER BY park_count DESC
            """)).fetchall()
            return {
                "total_districts": len(rows),
                "db": "postgis",
                "data_source": "공공데이터포털 전국도시공원정보표준데이터",
                "districts": [
                    {"district": r.district, "parkCount": r.park_count,
                     "totalArea": float(r.total_area or 0), "avgArea": float(r.avg_area or 0)}
                    for r in rows
                ]
            }
        except Exception as e:
            print(f"[DB 오류] districts: {e}")

    parks = load_csv_fallback()
    stats: dict = {}
    for p in parks:
        d = p["district"]
        # 이상한 district 이름 필터링
        if d == "기타" or len(d) < 3:
            continue
        if any(c.isdigit() or c == '-' for c in d):
            continue
        if not d.endswith(("구", "시", "군")):
            continue
        # 주소 파싱 실패로 광역시명+구명이 붙은 경우만 제외 (예: "인천광역시연수구", "대전광역시서구")
        # 이름이 "광역시", "특별시", "특별자치시", "특별자치도"로 끝나지 않으면서
        # 이름 중간에 해당 키워드가 포함된 경우 = 파싱 오류
        ADMIN_SUFFIXES = ("광역시", "특별시", "특별자치시", "특별자치도")
        ends_with_admin = any(d.endswith(s) for s in ADMIN_SUFFIXES)
        has_admin_in_middle = any(keyword in d for keyword in ADMIN_SUFFIXES) and not ends_with_admin
        if has_admin_in_middle:
            continue
        # 너무 긴 이름 제외 (세종특별자치시 7자, 정상 이름은 보통 10자 이하)
        if len(d) > 10:
            continue
        if d not in stats:
            stats[d] = {"district": d, "parkCount": 0, "totalArea": 0.0}
        stats[d]["parkCount"] += 1
        stats[d]["totalArea"] += p.get("area", 0)
    result_list = []
    for s in stats.values():
        avg = s["totalArea"] / s["parkCount"] if s["parkCount"] > 0 else 0.0
        result_list.append({**s, "avgArea": avg})
    return {"total_districts": len(result_list), "db": "csv_fallback",
            "data_source": "공공데이터포털 전국도시공원정보표준데이터",
            "districts": sorted(result_list, key=lambda x: x["parkCount"], reverse=True)}


@app.get("/api/park-types")
def get_park_types(db: Session = Depends(get_db)):
    """공원 구분 목록"""
    if USE_DB:
        try:
            rows = db.execute(text(
                "SELECT type, COUNT(*) AS cnt FROM parks GROUP BY type ORDER BY cnt DESC"
            )).fetchall()
            return {"db": "postgis", "types": [(r.type, r.cnt) for r in rows]}
        except Exception as e:
            print(f"[DB 오류] park-types: {e}")

    parks = load_csv_fallback()
    types: dict = {}
    for p in parks:
        types[p["type"]] = types.get(p["type"], 0) + 1
    return {"db": "csv_fallback", "types": sorted(types.items(), key=lambda x: x[1], reverse=True)}


@app.get("/api/route")
def get_route(
    origin_lat: float = Query(..., description="출발지 위도"),
    origin_lng: float = Query(..., description="출발지 경도"),
    dest_lat: float = Query(..., description="목적지 위도"),
    dest_lng: float = Query(..., description="목적지 경도"),
):
    """
    OSM 보행 네트워크 기반 실제 도보 경로 계산 (경사도 반영)
    - 실제 도로/보행로 기반 경로
    - 경사도 패널티 반영 (5%/10%/15% 기준)
    - 경로 좌표 반환 (지도 시각화용)
    """
    if not (33.0 <= origin_lat <= 38.9 and 124.0 <= origin_lng <= 132.0):
        return {"error": "대한민국 범위를 벗어난 좌표입니다"}
    if not (33.0 <= dest_lat <= 38.9 and 124.0 <= dest_lng <= 132.0):
        return {"error": "목적지가 대한민국 범위를 벗어났습니다"}

    result = calc_walking_route(origin_lat, origin_lng, dest_lat, dest_lng)
    result["origin"] = {"lat": origin_lat, "lng": origin_lng}
    result["destination"] = {"lat": dest_lat, "lng": dest_lng}
    return result


@app.get("/api/accessibility/osm")
def get_accessibility_osm(
    lat: float = Query(...),
    lng: float = Query(...),
    db: Session = Depends(get_db),
):
    """
    OSM 보행 네트워크 + 경사도 반영 녹지 접근성 점수
    - 실제 도보 경로 기반 (직선거리 × 1.3 아님)
    - 경사도 패널티 반영 (언덕 지역 불이익)
    - 경로 좌표 포함 (지도 시각화)
    """
    if not (33.0 <= lat <= 38.9 and 124.0 <= lng <= 132.0):
        return {"error": "대한민국 범위를 벗어난 좌표입니다", "score": 0, "grade": "F"}

    # 1. PostGIS로 가장 가까운 공원 찾기
    nearest_park = None
    count_500 = 0
    count_1km = 0

    if USE_DB:
        try:
            nearest_row = db.execute(text("""
                SELECT *,
                    ST_Distance(
                        geom::geography,
                        ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
                    ) AS straight_distance
                FROM parks
                ORDER BY geom <-> ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)
                LIMIT 1
            """), {"lat": lat, "lng": lng}).fetchone()

            if nearest_row:
                nearest_park = row_to_park(nearest_row)

            counts = db.execute(text("""
                SELECT
                    COUNT(*) FILTER (WHERE ST_DWithin(
                        geom::geography,
                        ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, 500
                    )) AS count_500,
                    COUNT(*) FILTER (WHERE ST_DWithin(
                        geom::geography,
                        ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, 1000
                    )) AS count_1km
                FROM parks
            """), {"lat": lat, "lng": lng}).fetchone()

            count_500 = int(counts.count_500)
            count_1km = int(counts.count_1km)

        except Exception as e:
            print(f"[DB 오류] accessibility/osm: {e}")

    if nearest_park is None:
        # CSV 폴백
        all_parks = load_csv_fallback()
        if not all_parks:
            return {"error": "공원 데이터 없음", "score": 0, "grade": "F"}
        distances = sorted(
            [(haversine(lat, lng, p["lat"], p["lng"]), p) for p in all_parks],
            key=lambda x: x[0]
        )
        nearest_park = distances[0][1]
        count_500 = sum(1 for d, _ in distances if d <= 500)
        count_1km = sum(1 for d, _ in distances if d <= 1000)

    # 2. OSM 보행 경로 계산 (경사도 반영)
    route_result = calc_walking_route(
        lat, lng,
        nearest_park["lat"], nearest_park["lng"],
    )

    # 3. 접근성 점수 계산
    result = calc_accessibility_score_osm(route_result, nearest_park, count_500, count_1km)
    result["data_source"] = "공공데이터포털 전국도시공원정보표준데이터 + OSM 보행 네트워크"
    result["db"] = "postgis+osm" if USE_DB else "csv+osm"
    return result


# ─── AI / ML 엔드포인트 ──────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    question: str


@app.post("/api/ai/chat")
def ai_chat(req: ChatRequest):
    """
    ML 기반 AI 녹지 어시스턴트 챗봇
    - TF-IDF + Cosine Similarity 의도 분류
    - RandomForest 등급 예측 포함
    - KNN 유사 지역 추천 포함
    """
    districts = _get_district_list()

    # ML 모델이 아직 초기화되지 않은 경우 재시도
    if ml_model._rf_model is None:
        try:
            ml_model.initialize_models(districts)
        except Exception as e:
            return {"answer": f"AI 모델 초기화 중입니다. 잠시 후 다시 시도해주세요. ({e})",
                    "intent": "error", "confidence": 0.0}

    result = ml_model.generate_ml_response(req.question, districts)
    return result


@app.get("/api/ai/predict")
def ai_predict(district: str = Query(..., description="지역명 (예: 강남구)")):
    """
    특정 지역 ML 등급 예측
    - RandomForestClassifier 기반
    - 취약/보통/우수 확률 반환
    """
    districts = _get_district_list()
    target = next((d for d in districts if d.get("district") == district), None)

    if target is None:
        return {"error": f"'{district}' 지역을 찾을 수 없습니다.", "available_count": len(districts)}

    if ml_model._rf_model is None:
        ml_model.initialize_models(districts)

    pred = ml_model.predict_grade(target)
    return {
        "district": district,
        "parkCount": target.get("parkCount"),
        "totalArea_ha": round(target.get("totalArea", 0) / 10000, 1),
        "avgArea_ha": round(target.get("avgArea", 0) / 10000, 2),
        **pred,
        "model": "RandomForestClassifier (n_estimators=200)",
    }


@app.get("/api/ai/similar")
def ai_similar(
    district: str = Query(..., description="기준 지역명 (예: 강남구)"),
    top_k: int = Query(5, ge=1, le=10, description="추천 지역 수"),
):
    """
    KNN 기반 유사 녹지 환경 지역 추천
    - 공원 수, 총 면적, 평균 면적 기반 유사도 계산
    """
    districts = _get_district_list()
    target = next((d for d in districts if d.get("district") == district), None)

    if target is None:
        return {"error": f"'{district}' 지역을 찾을 수 없습니다.", "available_count": len(districts)}

    if ml_model._knn_model is None:
        ml_model.initialize_models(districts)

    similar = ml_model.find_similar_districts(district, districts, top_k=top_k)
    return {
        "target_district": district,
        "target_stats": {
            "parkCount": target.get("parkCount"),
            "totalArea_ha": round(target.get("totalArea", 0) / 10000, 1),
        },
        "similar_districts": [
            {
                "district": d["district"],
                "parkCount": d["parkCount"],
                "totalArea_ha": round(d.get("totalArea", 0) / 10000, 1),
                "similarity_score": d["similarity_score"],
            }
            for d in similar
        ],
        "model": "KNearestNeighbors (euclidean)",
    }


@app.get("/api/ai/status")
def ai_status():
    """ML 모델 상태 확인"""
    districts = _get_district_list()
    return {
        "rf_model_ready": ml_model._rf_model is not None,
        "knn_model_ready": ml_model._knn_model is not None,
        "tfidf_ready": ml_model._tfidf_word is not None and ml_model._tfidf_char is not None,
        "districts_loaded": len(districts),
        "models": ["RandomForestClassifier", "KNearestNeighbors", "TF-IDF Vectorizer"],
        "version": "scikit-learn ML v1.0",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
