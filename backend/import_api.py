"""
GreenReach 공공데이터 API → PostGIS 임포트 스크립트
공공데이터포털 전국도시공원정보표준데이터 API → parks 테이블

API: https://api.data.go.kr/openapi/tn_pubr_public_cty_park_info_api
환경변수: PUBLIC_DATA_API_KEY (공공데이터포털 발급 서비스키)

사용법:
  PUBLIC_DATA_API_KEY=발급받은키 python -m backend.import_api
  또는
  DATABASE_URL=postgresql://... PUBLIC_DATA_API_KEY=발급받은키 python -m backend.import_api
"""
import json
import os
import sys
import time

import requests
from sqlalchemy import text

# 프로젝트 루트를 경로에 추가
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import engine, Base

# ─── 설정 ─────────────────────────────────────────────────────────────────────

API_ENDPOINT = "https://api.data.go.kr/openapi/tn_pubr_public_cty_park_info_api"
API_KEY = os.environ.get(
    "PUBLIC_DATA_API_KEY",
    "eeac02d09655cb4bddff67df993513c86a22d15b34234fc45fe1910947547c23"  # 공공데이터포털 발급 키
)
NUM_OF_ROWS = 1000   # 페이지당 최대 1000건
REQUEST_DELAY = 0.3  # API 호출 간격 (초) — 과부하 방지

PARK_TYPE_MAP = {
    "근린공원": "근린공원", "어린이공원": "어린이공원", "소공원": "소공원",
    "체육공원": "체육공원", "역사공원": "역사공원", "문화공원": "문화공원",
    "수변공원": "수변공원", "묘지공원": "묘지공원", "도시농업공원": "도시농업공원",
    "방재공원": "방재공원", "광역공원": "광역공원", "주제공원": "주제공원",
}

# 전국 시/도 목록 (주소 파싱용)
SIDO_SET = {
    "서울특별시", "부산광역시", "대구광역시", "인천광역시", "광주광역시",
    "대전광역시", "울산광역시", "세종특별자치시",
    "경기도", "강원도", "강원특별자치도",
    "충청북도", "충북", "충청남도", "충남",
    "전라북도", "전북", "전북특별자치도", "전라남도", "전남",
    "경상북도", "경북", "경상남도", "경남",
    "제주도", "제주특별자치도",
}


# ─── 유틸리티 ─────────────────────────────────────────────────────────────────

def extract_district(address: str) -> str:
    """주소에서 시/군/구 단위 지역명 추출"""
    if not address:
        return "기타"
    parts = address.split()
    for i, part in enumerate(parts):
        if part in SIDO_SET and i + 1 < len(parts):
            if part == "세종특별자치시":
                return "세종시"
            candidate = parts[i + 1]
            if candidate.endswith(("구", "시", "군")) and len(candidate) >= 2:
                return candidate
            if i + 2 < len(parts) and parts[i + 2].endswith(("구", "시", "군")) and len(parts[i + 2]) >= 2:
                return parts[i + 2]
            return candidate
    for p in parts:
        if p.endswith("구") and 2 <= len(p) <= 6 and p.isalpha():
            return p
    for p in parts:
        if (p.endswith("시") and 2 <= len(p) <= 8 and p.isalpha()
                and p not in ("특별시", "광역시", "특별자치시")):
            return p
    for p in parts:
        if p.endswith("군") and 2 <= len(p) <= 6 and p.isalpha():
            return p
    return "기타"


def parse_facilities(item: dict) -> list:
    """API 응답에서 시설 목록 파싱"""
    facilities = []
    fac_keys = ["mvmFclty", "amsmtFclty", "cnvnncFclty", "cltrFclty", "etcFclty"]
    for key in fac_keys:
        val = (item.get(key) or "").strip()
        if val:
            items = [v.strip() for v in val.replace("/", ",").split(",") if v.strip()]
            facilities.extend(items[:3])
    return facilities[:6]


def item_to_park(item: dict, idx: int) -> dict | None:
    """API 응답 item → parks 테이블 레코드"""
    try:
        lat_str = (item.get("latitude") or "").strip()
        lng_str = (item.get("longitude") or "").strip()
        if not lat_str or not lng_str:
            return None

        lat = float(lat_str)
        lng = float(lng_str)

        # 대한민국 전국 범위 검증
        if not (33.0 <= lat <= 38.9 and 124.0 <= lng <= 132.0):
            return None

        name = (item.get("parkNm") or "").strip()
        if not name:
            return None

        address = (item.get("rdnmadr") or item.get("lnmadr") or "").strip()
        park_type_raw = (item.get("parkSe") or "").strip()
        park_type = PARK_TYPE_MAP.get(park_type_raw, park_type_raw or "기타")

        area_str = (item.get("parkAr") or "0").strip()
        try:
            area = float(area_str) if area_str else 0.0
        except ValueError:
            area = 0.0

        facilities = parse_facilities(item)
        fac_str = " ".join(facilities)
        child_friendly = park_type == "어린이공원" or "놀이" in fac_str or "유희" in fac_str
        pet_friendly = "반려" in fac_str or park_type in ["근린공원", "수변공원"]
        accessible = "장애" in fac_str or area >= 10000

        manage_no = (item.get("manageNo") or f"park_{idx}").strip()

        return {
            "id": manage_no,
            "name": name,
            "type": park_type,
            "district": extract_district(address),
            "address": address,
            "lat": lat,
            "lng": lng,
            "area": area,
            "facilities": json.dumps(facilities, ensure_ascii=False),
            "child_friendly": child_friendly,
            "pet_friendly": pet_friendly,
            "accessible": accessible,
            "designated_date": (item.get("appnNtfcDate") or "").strip(),
            "manager": (item.get("institutionNm") or "").strip(),
            "phone": (item.get("phoneNumber") or "").strip(),
            "data_date": (item.get("referenceDate") or "").strip(),
            "geom": f"SRID=4326;POINT({lng} {lat})",
        }
    except (ValueError, KeyError, TypeError):
        return None


# ─── API 호출 ─────────────────────────────────────────────────────────────────

def fetch_page(page_no: int) -> tuple[list[dict], int]:
    """
    공공데이터 API 단일 페이지 호출
    반환: (items 리스트, 전체 건수)
    """
    params = {
        "serviceKey": API_KEY,
        "pageNo": page_no,
        "numOfRows": NUM_OF_ROWS,
        "type": "json",
    }
    resp = requests.get(API_ENDPOINT, params=params, timeout=30)
    resp.raise_for_status()
    data = resp.json()

    # 응답 구조: { "response": { "header": {...}, "body": { "items": [...], "totalCount": N } } }
    body = data.get("response", {}).get("body", {})
    total_count = int(body.get("totalCount", 0))
    items = body.get("items", [])

    # items가 dict인 경우 (단일 결과) 리스트로 변환
    if isinstance(items, dict):
        items = [items]
    if items is None:
        items = []

    return items, total_count


def fetch_all_parks() -> list[dict]:
    """전체 공원 데이터를 페이지네이션으로 수집"""
    if not API_KEY:
        raise ValueError(
            "PUBLIC_DATA_API_KEY 환경변수가 설정되지 않았습니다.\n"
            "  export PUBLIC_DATA_API_KEY=발급받은서비스키"
        )

    print("[GreenReach] 공공데이터 API 전체 수집 시작...")

    # 1페이지로 전체 건수 파악
    first_items, total_count = fetch_page(1)
    if total_count == 0:
        print("[GreenReach] ⚠️  API 응답 건수 0 — API 키 또는 엔드포인트를 확인하세요.")
        return []

    total_pages = (total_count + NUM_OF_ROWS - 1) // NUM_OF_ROWS
    print(f"[GreenReach] 전체 {total_count:,}건 / {total_pages}페이지")

    all_items = list(first_items)

    for page in range(2, total_pages + 1):
        time.sleep(REQUEST_DELAY)
        items, _ = fetch_page(page)
        all_items.extend(items)
        if page % 5 == 0 or page == total_pages:
            print(f"  수집 진행: {len(all_items):,}/{total_count:,} ({page}/{total_pages} 페이지)")

    print(f"[GreenReach] API 수집 완료: {len(all_items):,}건")
    return all_items


# ─── DB 임포트 ────────────────────────────────────────────────────────────────

def run_import():
    print("[GreenReach] 공공데이터 API → PostGIS 임포트 시작...")

    # 1. PostGIS 확장 활성화
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis;"))
        conn.commit()
        print("[GreenReach] PostGIS 확장 활성화 완료")

    # 2. 테이블 생성
    Base.metadata.create_all(bind=engine)
    print("[GreenReach] 테이블 생성 완료")

    # 3. 기존 데이터 삭제 (재임포트 시)
    with engine.connect() as conn:
        count = conn.execute(text("SELECT COUNT(*) FROM parks")).scalar()
        if count and count > 0:
            print(f"[GreenReach] 기존 데이터 {count:,}개 삭제 후 재임포트...")
            conn.execute(text("TRUNCATE TABLE parks;"))
            conn.commit()

    # 4. API 전체 수집
    raw_items = fetch_all_parks()

    # 5. 파싱
    parks_data = []
    skipped = 0
    for i, item in enumerate(raw_items):
        park = item_to_park(item, i)
        if park:
            parks_data.append(park)
        else:
            skipped += 1

    print(f"[GreenReach] 파싱 완료: {len(parks_data):,}개 유효 (제외: {skipped:,}개)")

    # 6. 배치 임포트 (1000개씩)
    BATCH_SIZE = 1000
    total_inserted = 0

    with engine.connect() as conn:
        for i in range(0, len(parks_data), BATCH_SIZE):
            batch = parks_data[i:i + BATCH_SIZE]
            conn.execute(
                text("""
                    INSERT INTO parks (
                        id, name, type, district, address, lat, lng, area,
                        facilities, child_friendly, pet_friendly, accessible,
                        designated_date, manager, phone, data_date, geom
                    ) VALUES (
                        :id, :name, :type, :district, :address, :lat, :lng, :area,
                        :facilities, :child_friendly, :pet_friendly, :accessible,
                        :designated_date, :manager, :phone, :data_date,
                        ST_GeomFromEWKT(:geom)
                    )
                    ON CONFLICT (id) DO UPDATE SET
                        name = EXCLUDED.name,
                        type = EXCLUDED.type,
                        district = EXCLUDED.district,
                        address = EXCLUDED.address,
                        lat = EXCLUDED.lat,
                        lng = EXCLUDED.lng,
                        area = EXCLUDED.area,
                        facilities = EXCLUDED.facilities,
                        child_friendly = EXCLUDED.child_friendly,
                        pet_friendly = EXCLUDED.pet_friendly,
                        accessible = EXCLUDED.accessible,
                        designated_date = EXCLUDED.designated_date,
                        manager = EXCLUDED.manager,
                        phone = EXCLUDED.phone,
                        data_date = EXCLUDED.data_date,
                        geom = EXCLUDED.geom
                """),
                batch
            )
            conn.commit()
            total_inserted += len(batch)
            print(f"  임포트 진행: {total_inserted:,}/{len(parks_data):,}")

    # 7. 공간 인덱스 생성
    with engine.connect() as conn:
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_parks_geom ON parks USING GIST(geom);"
        ))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_parks_district ON parks(district);"
        ))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_parks_type ON parks(type);"
        ))
        conn.commit()
        print("[GreenReach] 공간 인덱스 생성 완료")

    print(f"[GreenReach] ✅ 임포트 완료! 총 {total_inserted:,}개 공원 → PostGIS DB")


if __name__ == "__main__":
    run_import()
