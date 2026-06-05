"""
GreenReach OSM 보행 네트워크 분석 모듈
- OSMnx로 실제 보행 경로 계산
- 경사도(elevation) 가중치 반영
- 로컬 캐시로 반복 다운로드 방지
"""
import os
import math
import json
import hashlib
import pickle
from typing import Optional

# ─── 경사도 계산 유틸 ─────────────────────────────────────────────────────────

def calc_slope_penalty(elev_diff_m: float, dist_m: float) -> float:
    """
    경사도 기반 보행 패널티 계산
    - 경사 5% 미만: 패널티 없음
    - 경사 5~10%: 1.2배
    - 경사 10~15%: 1.5배
    - 경사 15% 이상: 2.0배 (보행약자 기준)
    """
    if dist_m < 1:
        return 1.0
    slope_pct = abs(elev_diff_m) / dist_m * 100
    if slope_pct < 5:
        return 1.0
    elif slope_pct < 10:
        return 1.2
    elif slope_pct < 15:
        return 1.5
    else:
        return 2.0


def haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371000
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = (math.sin(d_lat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(d_lng / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ─── OSM 그래프 캐시 ──────────────────────────────────────────────────────────

CACHE_DIR = os.path.join(os.path.dirname(__file__), "..", "osm_cache")
os.makedirs(CACHE_DIR, exist_ok=True)

_graph_cache: dict = {}  # 메모리 캐시 (bbox_key → graph)


def _bbox_key(lat: float, lng: float, dist: int) -> str:
    """캐시 키 생성 (0.05도 격자로 스냅)"""
    lat_snap = round(lat / 0.05) * 0.05
    lng_snap = round(lng / 0.05) * 0.05
    return f"{lat_snap:.2f}_{lng_snap:.2f}_{dist}"


def get_walk_graph(lat: float, lng: float, dist: int = 2000):
    """
    OSMnx 보행 그래프 가져오기 (캐시 우선)
    dist: 중심점에서 반경 (미터)
    """
    try:
        import osmnx as ox
        import networkx as nx
    except ImportError:
        return None

    key = _bbox_key(lat, lng, dist)

    # 1. 메모리 캐시
    if key in _graph_cache:
        return _graph_cache[key]

    # 2. 파일 캐시
    cache_file = os.path.join(CACHE_DIR, f"graph_{key}.pkl")
    if os.path.exists(cache_file):
        try:
            with open(cache_file, "rb") as f:
                G = pickle.load(f)
            _graph_cache[key] = G
            print(f"[OSM] 캐시 로드: {key}")
            return G
        except Exception:
            pass

    # 3. OSM 다운로드
    try:
        print(f"[OSM] 그래프 다운로드: {key} (dist={dist}m)")
        ox.settings.log_console = False
        ox.settings.use_cache = True
        G = ox.graph_from_point(
            (lat, lng),
            dist=dist,
            network_type="walk",
            simplify=True,
        )
        # 파일 캐시 저장
        with open(cache_file, "wb") as f:
            pickle.dump(G, f)
        _graph_cache[key] = G
        print(f"[OSM] 그래프 저장 완료: {len(G.nodes)}노드, {len(G.edges)}엣지")
        return G
    except Exception as e:
        print(f"[OSM] 그래프 다운로드 실패: {e}")
        return None


# ─── 경사도 데이터 (SRTM) ────────────────────────────────────────────────────

def add_elevation_to_graph(G):
    """
    SRTM 30m DEM 데이터로 노드에 고도 추가
    (osmnx의 elevation 기능 사용)
    """
    try:
        import osmnx as ox
        # Open-Elevation API 사용 (무료, 공개)
        G = ox.elevation.add_node_elevations_google(G, api_key=None)
        G = ox.elevation.add_edge_grades(G)
        return G
    except Exception:
        pass

    # 폴백: Open-Elevation API 직접 호출
    try:
        import requests
        nodes = list(G.nodes(data=True))
        # 배치로 고도 요청 (최대 100개씩)
        batch_size = 100
        for i in range(0, len(nodes), batch_size):
            batch = nodes[i:i + batch_size]
            locations = [{"latitude": d["y"], "longitude": d["x"]} for _, d in batch]
            try:
                resp = requests.post(
                    "https://api.open-elevation.com/api/v1/lookup",
                    json={"locations": locations},
                    timeout=10
                )
                if resp.status_code == 200:
                    results = resp.json().get("results", [])
                    for j, (node_id, _) in enumerate(batch):
                        if j < len(results):
                            G.nodes[node_id]["elevation"] = results[j].get("elevation", 0)
            except Exception:
                # 고도 0으로 설정
                for node_id, _ in batch:
                    G.nodes[node_id].setdefault("elevation", 0)
        return G
    except Exception as e:
        print(f"[OSM] 고도 데이터 추가 실패: {e}")
        return G


# ─── OSRM 공개 API 기반 도보 경로 계산 ──────────────────────────────────────

def _fetch_osrm_route(
    origin_lat: float, origin_lng: float,
    dest_lat: float, dest_lng: float,
) -> dict | None:
    """
    OSRM 공개 API로 실제 보행자 경로 계산 (foot 프로파일)
    router.project-osrm.org 무료 공개 API 사용
    한국 OSM 데이터 완벽 지원, Valhalla보다 응답 빠름
    """
    try:
        import requests
        url = (
            f"https://router.project-osrm.org/route/v1/foot/"
            f"{origin_lng},{origin_lat};{dest_lng},{dest_lat}"
            f"?overview=full&geometries=geojson"
        )
        resp = requests.get(url, timeout=3)
        if resp.status_code != 200:
            print(f"[OSRM] HTTP {resp.status_code}: {resp.text[:200]}")
            return None
        data = resp.json()
        if data.get("code") != "Ok" or not data.get("routes"):
            return None

        route = data["routes"][0]
        dist_m = int(route.get("distance", 0))
        duration_s = int(route.get("duration", 0))

        # GeoJSON coordinates: [[lng, lat], ...] → [[lat, lng], ...]
        coords = route["geometry"]["coordinates"]
        route_coords = [[c[1], c[0]] for c in coords]

        if not route_coords:
            return None

        return {
            "distance_m": dist_m,
            "duration_s": duration_s,
            "route_coords": route_coords,
        }
    except Exception as e:
        print(f"[OSRM] API 호출 실패: {e}")
        return None


def _fetch_elevation_for_route(route_coords: list) -> list[float]:
    """
    Open-Elevation API로 경로 노드 고도 조회
    최대 20개 포인트 샘플링 (속도 최적화)
    """
    try:
        import requests
        # 경로가 너무 길면 샘플링 (최대 20포인트로 제한)
        step = max(1, len(route_coords) // 20)
        sampled = route_coords[::step]
        if len(sampled) < 2:
            return []
        locations = [{"latitude": c[0], "longitude": c[1]} for c in sampled]
        resp = requests.post(
            "https://api.open-elevation.com/api/v1/lookup",
            json={"locations": locations},
            timeout=1,  # 타임아웃 단축: 4s → 1s (느린 공개 API 대응)
        )
        if resp.status_code != 200:
            return []
        results = resp.json().get("results", [])
        return [r.get("elevation", 0) for r in results]
    except Exception as e:
        print(f"[Elevation] API 호출 실패 (경사도 생략): {e}")
        return []


def calc_walking_route(
    origin_lat: float, origin_lng: float,
    dest_lat: float, dest_lng: float,
    use_elevation: bool = False,  # 기본 비활성화: Open-Elevation 공개 API가 느려 응답 지연 유발
) -> dict:
    """
    OSRM 공개 API 기반 실제 보행자 경로 계산 + 경사도 반영
    (Valhalla 대신 OSRM 사용 - 한국 데이터 완벽 지원, 응답 빠름)

    use_elevation=False (기본값): OSRM 경로만 사용, 빠른 응답
    use_elevation=True: Open-Elevation API 추가 호출 (1~3초 추가 소요)

    Returns:
        {
            "distance_m": 실제 도보 거리 (미터),
            "time_min": 예상 소요 시간 (분),
            "slope_penalty": 경사도 패널티 배수,
            "adjusted_time_min": 경사도 반영 시간 (분),
            "route_coords": [[lat, lng], ...],
            "elevation_gain_m": 총 오르막 고도 (미터),
            "elevation_loss_m": 총 내리막 고도 (미터),
            "method": "osrm" | "straight_line",
        }
    """
    straight_dist = haversine(origin_lat, origin_lng, dest_lat, dest_lng)

    # 1. OSRM으로 실제 보행자 경로 계산
    osrm_result = _fetch_osrm_route(origin_lat, origin_lng, dest_lat, dest_lng)

    if osrm_result is None:
        # 폴백: 직선거리 × 1.3
        walking_dist = int(straight_dist * 1.3)
        walking_time = max(1, round(walking_dist / 67))
        return {
            "distance_m": walking_dist,
            "time_min": walking_time,
            "slope_penalty": 1.0,
            "adjusted_time_min": walking_time,
            "route_coords": [[origin_lat, origin_lng], [dest_lat, dest_lng]],
            "elevation_gain_m": 0.0,
            "elevation_loss_m": 0.0,
            "method": "straight_line",
        }

    route_dist = osrm_result["distance_m"]
    route_coords = osrm_result["route_coords"]

    # 2. 경사도 계산 (Open-Elevation API, 타임아웃 4초)
    elevation_gain = 0.0
    elevation_loss = 0.0
    total_slope_penalty = 1.0

    if use_elevation and len(route_coords) >= 2:
        elevations = _fetch_elevation_for_route(route_coords)
        if len(elevations) >= 2:
            # 샘플링된 구간 거리 계산
            step = max(1, len(route_coords) // 20)
            sampled = route_coords[::step]
            for i in range(len(elevations) - 1):
                if i + 1 >= len(sampled):
                    break
                seg_dist = haversine(
                    sampled[i][0], sampled[i][1],
                    sampled[i + 1][0], sampled[i + 1][1]
                )
                elev_diff = elevations[i + 1] - elevations[i]
                if elev_diff > 0:
                    elevation_gain += elev_diff
                else:
                    elevation_loss += abs(elev_diff)
                penalty = calc_slope_penalty(elev_diff, max(seg_dist, 1))
                total_slope_penalty = max(total_slope_penalty, penalty)

    # 3. 보행 속도: 평지 67m/분 (4km/h)
    base_time = max(1, round(route_dist / 67))
    adjusted_time = max(1, round(route_dist * total_slope_penalty / 67))

    return {
        "distance_m": route_dist,
        "time_min": base_time,
        "slope_penalty": round(total_slope_penalty, 2),
        "adjusted_time_min": adjusted_time,
        "route_coords": route_coords,
        "elevation_gain_m": round(elevation_gain, 1),
        "elevation_loss_m": round(elevation_loss, 1),
        "method": "osrm",
    }


# ─── 접근성 점수 (경사도 반영) ────────────────────────────────────────────────

def calc_accessibility_score_osm(
    route_result: dict,
    nearest_park: dict,
    count_500: int,
    count_1km: int,
) -> dict:
    """
    OSM 경로 분석 결과를 반영한 접근성 점수 계산
    - 경사도 패널티 반영
    - 실제 도보 거리 사용
    """
    walking_dist = route_result["distance_m"]
    adjusted_time = route_result["adjusted_time_min"]
    slope_penalty = route_result["slope_penalty"]

    # 거리 점수 (경사도 패널티 반영)
    effective_dist = walking_dist * slope_penalty
    if effective_dist <= 300:
        dist_score = 50
    elif effective_dist <= 500:
        dist_score = 45
    elif effective_dist <= 800:
        dist_score = 38
    elif effective_dist <= 1000:
        dist_score = 30
    elif effective_dist <= 1500:
        dist_score = 20
    elif effective_dist <= 2000:
        dist_score = 12
    else:
        dist_score = max(0, int(10 - (effective_dist - 2000) / 500))

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
        "score": total,
        "grade": grade,
        "nearestPark": nearest_park,
        "walkingDistance": walking_dist,
        "walkingTime": adjusted_time,
        "slopeAdjustedTime": adjusted_time,
        "slopePenalty": slope_penalty,
        "elevationGain": route_result["elevation_gain_m"],
        "elevationLoss": route_result["elevation_loss_m"],
        "routeCoords": route_result["route_coords"],
        "routeMethod": route_result["method"],
        "parkCount500m": count_500,
        "parkCount1km": count_1km,
        "distScore": dist_score,
        "densityScore": density_score,
        "areaScore": area_score,
    }
