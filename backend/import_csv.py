"""
GreenReach CSV → PostGIS 임포트 스크립트
전국도시공원정보표준데이터.csv → parks 테이블

사용법:
  python -m backend.import_csv
  또는
  DATABASE_URL=postgresql://... python -m backend.import_csv
"""
import csv
import json
import os
import sys

from geoalchemy2.functions import ST_GeomFromText
from sqlalchemy import text

# 프로젝트 루트를 경로에 추가
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import engine, Base
from backend.models import Park

CSV_PATH = os.path.join(os.path.dirname(__file__), "..", "전국도시공원정보표준데이터.csv")

PARK_TYPE_MAP = {
    "근린공원": "근린공원", "어린이공원": "어린이공원", "소공원": "소공원",
    "체육공원": "체육공원", "역사공원": "역사공원", "문화공원": "문화공원",
    "수변공원": "수변공원", "묘지공원": "묘지공원", "도시농업공원": "도시농업공원",
    "방재공원": "방재공원", "광역공원": "광역공원", "주제공원": "주제공원",
}


def parse_facilities(row: dict) -> list:
    facilities = []
    for col in ["공원보유시설(운동시설)", "공원보유시설(유희시설)",
                "공원보유시설(편익시설)", "공원보유시설(교양시설)", "공원보유시설(기타시설)"]:
        val = row.get(col, "").strip()
        if val:
            items = [v.strip() for v in val.replace("/", ",").split(",") if v.strip()]
            facilities.extend(items[:3])
    return facilities[:6]


def extract_district(address: str) -> str:
    if not address:
        return "기타"
    parts = address.split()
    # 1순위: "구" (예: 강남구, 분당구)
    for part in parts:
        if part.endswith("구") and len(part) >= 3:
            return part
    # 2순위: "시" (예: 화성시, 수원시) - 특별시/광역시 제외
    for part in parts:
        if (part.endswith("시") and len(part) >= 3
                and part not in ("특별시", "광역시", "특별자치시", "특별자치도")):
            return part
    # 3순위: "군" (예: 양평군, 가평군)
    for part in parts:
        if part.endswith("군") and len(part) >= 3:
            return part
    return "기타"


def run_import():
    print("[GreenReach] PostGIS 임포트 시작...")

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
            print(f"[GreenReach] 기존 데이터 {count}개 삭제 후 재임포트...")
            conn.execute(text("TRUNCATE TABLE parks;"))
            conn.commit()

    # 4. CSV 파싱 및 임포트
    parks_data = []
    errors = 0
    skipped = 0

    with open(CSV_PATH, encoding="cp949") as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader):
            try:
                lat_str = row.get("위도", "").strip()
                lng_str = row.get("경도", "").strip()
                if not lat_str or not lng_str:
                    skipped += 1
                    continue

                lat = float(lat_str)
                lng = float(lng_str)

                # 대한민국 전국 범위 검증
                if not (33.0 <= lat <= 38.9 and 124.0 <= lng <= 132.0):
                    skipped += 1
                    continue

                name = row.get("공원명", "").strip()
                if not name:
                    skipped += 1
                    continue

                address = (row.get("소재지도로명주소") or row.get("소재지지번주소") or "").strip()
                park_type = row.get("공원구분", "").strip()
                park_type = PARK_TYPE_MAP.get(park_type, park_type or "기타")

                area_str = row.get("공원면적", "0").strip()
                try:
                    area = float(area_str) if area_str else 0.0
                except ValueError:
                    area = 0.0

                facilities = parse_facilities(row)
                fac_str = " ".join(facilities)
                child_friendly = park_type == "어린이공원" or "놀이" in fac_str or "유희" in fac_str
                pet_friendly = "반려" in fac_str or park_type in ["근린공원", "수변공원"]
                accessible = "장애" in fac_str or area >= 10000

                parks_data.append({
                    "id": row.get("관리번호", f"park_{i}").strip(),
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
                    "designated_date": row.get("지정고시일", "").strip(),
                    "manager": row.get("관리기관명", "").strip(),
                    "phone": row.get("전화번호", "").strip(),
                    "data_date": row.get("데이터기준일자", "").strip(),
                    "geom": f"SRID=4326;POINT({lng} {lat})",
                })

            except (ValueError, KeyError):
                errors += 1
                continue

    print(f"[GreenReach] CSV 파싱 완료: {len(parks_data)}개 (제외: {skipped}, 오류: {errors})")

    # 5. 배치 임포트 (1000개씩)
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
                        geom = EXCLUDED.geom,
                        data_date = EXCLUDED.data_date
                """),
                batch
            )
            conn.commit()
            total_inserted += len(batch)
            print(f"  임포트 진행: {total_inserted}/{len(parks_data)}")

    # 6. 공간 인덱스 생성
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

    print(f"[GreenReach] ✅ 임포트 완료! 총 {total_inserted}개 공원 → PostGIS DB")


if __name__ == "__main__":
    run_import()
