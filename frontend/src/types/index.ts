export interface Park {
  id: string;
  name: string;
  type: string; // 근린공원, 어린이공원, 소공원, 체육공원 등
  lat: number;
  lng: number;
  area: number; // 면적 (㎡)
  district: string; // 자치구
  address: string;
  facilities: string[]; // 시설 목록
  childFriendly: boolean;
  petFriendly: boolean;
  accessible: boolean; // 장애인 접근 가능
}

export interface AccessibilityScore {
  score: number; // 0~100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  nearestPark: Park;
  walkingDistance: number; // 미터
  walkingTime: number; // 분
  parkCount500m: number; // 500m 내 공원 수
  parkCount1km: number; // 1km 내 공원 수
}

export interface DistrictStats {
  district: string;
  avgScore: number;
  parkCount: number;
  totalArea: number; // 총 녹지 면적 (㎡)
  population: number;
  greenAreaPerCapita: number; // 1인당 녹지 면적 (㎡)
  vulnerableRatio: number; // 취약 지역 비율 (%)
  lat: number;
  lng: number;
}

export interface VulnerableZone {
  id: string;
  district: string;
  dong: string;
  lat: number;
  lng: number;
  score: number;
  population: number;
  elderlyRatio: number; // 고령화율 (%)
  riskLevel: 'high' | 'medium' | 'low';
  predictedDemand: number; // AI 예측 수요 증가율 (%)
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface RecommendationFilter {
  childFriendly: boolean;
  petFriendly: boolean;
  accessible: boolean;
  maxDistance: number; // 미터
}
