import type { Park, AccessibilityScore } from '../types';
import { PARKS } from '../data/parks';

// 두 좌표 간 직선 거리 계산 (Haversine 공식, 미터 단위)
export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // 지구 반지름 (미터)
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// 직선거리 → 실제 도보 거리 추정 (도시 보행 네트워크 계수 적용)
// 실제 도보 거리는 직선거리의 약 1.2~1.5배 (도시 구조에 따라 다름)
export function estimateWalkingDistance(straightDistance: number): number {
  const networkFactor = 1.3; // 서울 평균 도로 네트워크 계수
  return straightDistance * networkFactor;
}

// 도보 시간 계산 (분) - 평균 보행 속도 4km/h
export function estimateWalkingTime(distanceMeters: number): number {
  const walkingSpeedMps = 4000 / 60; // 4km/h → m/min
  return Math.round(distanceMeters / walkingSpeedMps);
}

// 접근성 점수 계산 (0~100점)
export function calculateAccessibilityScore(
  lat: number,
  lng: number,
  parks: Park[] = PARKS
): AccessibilityScore {
  // 각 공원까지 거리 계산
  const parksWithDistance = parks.map((park) => ({
    park,
    straightDistance: haversineDistance(lat, lng, park.lat, park.lng),
  }));

  // 거리순 정렬
  parksWithDistance.sort((a, b) => a.straightDistance - b.straightDistance);

  const nearest = parksWithDistance[0];
  const walkingDistance = estimateWalkingDistance(nearest.straightDistance);
  const walkingTime = estimateWalkingTime(walkingDistance);

  // 반경 내 공원 수
  const parkCount500m = parksWithDistance.filter((p) => p.straightDistance <= 500).length;
  const parkCount1km = parksWithDistance.filter((p) => p.straightDistance <= 1000).length;

  // 점수 계산 로직
  // 1. 최근접 공원 거리 점수 (0~50점)
  let distanceScore = 0;
  if (walkingDistance <= 300) distanceScore = 50;
  else if (walkingDistance <= 500) distanceScore = 45;
  else if (walkingDistance <= 800) distanceScore = 35;
  else if (walkingDistance <= 1000) distanceScore = 25;
  else if (walkingDistance <= 1500) distanceScore = 15;
  else if (walkingDistance <= 2000) distanceScore = 8;
  else distanceScore = 3;

  // 2. 공원 밀도 점수 (0~30점)
  let densityScore = 0;
  if (parkCount500m >= 3) densityScore = 30;
  else if (parkCount500m === 2) densityScore = 22;
  else if (parkCount500m === 1) densityScore = 15;
  else if (parkCount1km >= 3) densityScore = 10;
  else if (parkCount1km >= 1) densityScore = 5;

  // 3. 공원 면적 점수 (0~20점)
  const nearestArea = nearest.park.area;
  let areaScore = 0;
  if (nearestArea >= 1000000) areaScore = 20;
  else if (nearestArea >= 500000) areaScore = 16;
  else if (nearestArea >= 100000) areaScore = 12;
  else if (nearestArea >= 50000) areaScore = 8;
  else if (nearestArea >= 10000) areaScore = 5;
  else areaScore = 2;

  const totalScore = Math.min(100, distanceScore + densityScore + areaScore);

  // 등급 산정
  let grade: 'A' | 'B' | 'C' | 'D' | 'F';
  if (totalScore >= 80) grade = 'A';
  else if (totalScore >= 65) grade = 'B';
  else if (totalScore >= 50) grade = 'C';
  else if (totalScore >= 35) grade = 'D';
  else grade = 'F';

  return {
    score: totalScore,
    grade,
    nearestPark: nearest.park,
    walkingDistance: Math.round(walkingDistance),
    walkingTime,
    parkCount500m,
    parkCount1km,
  };
}

// 점수에 따른 색상 반환
export function getScoreColor(score: number): string {
  if (score >= 80) return '#16a34a'; // green-600
  if (score >= 65) return '#65a30d'; // lime-600
  if (score >= 50) return '#ca8a04'; // yellow-600
  if (score >= 35) return '#ea580c'; // orange-600
  return '#dc2626'; // red-600
}

// 점수에 따른 배경색 반환
export function getScoreBgColor(score: number): string {
  if (score >= 80) return 'bg-green-100 text-green-800';
  if (score >= 65) return 'bg-lime-100 text-lime-800';
  if (score >= 50) return 'bg-yellow-100 text-yellow-800';
  if (score >= 35) return 'bg-orange-100 text-orange-800';
  return 'bg-red-100 text-red-800';
}

// 등급 설명
export function getGradeDescription(grade: string): string {
  const descriptions: Record<string, string> = {
    A: '매우 우수 — 도보 5분 내 공원 접근 가능',
    B: '우수 — 도보 10분 내 공원 접근 가능',
    C: '보통 — 도보 15분 내 공원 접근 가능',
    D: '취약 — 공원까지 상당한 거리 소요',
    F: '매우 취약 — 녹지 접근성 개선 시급',
  };
  return descriptions[grade] ?? '알 수 없음';
}

// 맞춤 공원 추천 (필터 기반)
export function recommendParks(
  lat: number,
  lng: number,
  options: {
    childFriendly?: boolean;
    petFriendly?: boolean;
    accessible?: boolean;
    maxDistance?: number;
  },
  parks: Park[] = PARKS
): Array<Park & { distance: number; walkingTime: number }> {
  const maxDist = options.maxDistance ?? 2000;

  return parks
    .map((park) => {
      const straight = haversineDistance(lat, lng, park.lat, park.lng);
      const walking = estimateWalkingDistance(straight);
      return {
        ...park,
        distance: Math.round(walking),
        walkingTime: estimateWalkingTime(walking),
      };
    })
    .filter((park) => {
      if (park.distance > maxDist) return false;
      if (options.childFriendly && !park.childFriendly) return false;
      if (options.petFriendly && !park.petFriendly) return false;
      if (options.accessible && !park.accessible) return false;
      return true;
    })
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 10);
}
