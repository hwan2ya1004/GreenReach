import type { Park } from '../types';

export const PARKS: Park[] = [
  // 강남구
  { id: 'p001', name: '선릉공원', type: '역사공원', lat: 37.5087, lng: 127.0473, area: 73000, district: '강남구', address: '서울 강남구 선릉로100길 1', facilities: ['산책로', '역사유적', '화장실'], childFriendly: false, petFriendly: true, accessible: true },
  { id: 'p002', name: '도산공원', type: '근린공원', lat: 37.5247, lng: 127.0337, area: 27000, district: '강남구', address: '서울 강남구 도산대로45길 20', facilities: ['산책로', '운동시설', '화장실', '주차장'], childFriendly: true, petFriendly: true, accessible: true },
  { id: 'p003', name: '양재시민의숲', type: '근린공원', lat: 37.4700, lng: 127.0340, area: 248000, district: '서초구', address: '서울 서초구 매헌로 99', facilities: ['산책로', '운동시설', '화장실', '주차장', '카페'], childFriendly: true, petFriendly: true, accessible: true },
  { id: 'p004', name: '대치근린공원', type: '근린공원', lat: 37.4940, lng: 127.0620, area: 15000, district: '강남구', address: '서울 강남구 대치동 890', facilities: ['산책로', '운동시설', '화장실'], childFriendly: true, petFriendly: false, accessible: true },
  { id: 'p005', name: '개포근린공원', type: '근린공원', lat: 37.4820, lng: 127.0560, area: 32000, district: '강남구', address: '서울 강남구 개포동 1200', facilities: ['산책로', '운동시설', '어린이놀이터', '화장실'], childFriendly: true, petFriendly: true, accessible: true },

  // 서초구
  { id: 'p006', name: '반포한강공원', type: '한강공원', lat: 37.5120, lng: 126.9940, area: 1000000, district: '서초구', address: '서울 서초구 신반포로11길 40', facilities: ['산책로', '자전거도로', '수영장', '화장실', '주차장', '카페'], childFriendly: true, petFriendly: true, accessible: true },
  { id: 'p007', name: '서리풀공원', type: '근린공원', lat: 37.4870, lng: 127.0050, area: 1200000, district: '서초구', address: '서울 서초구 서초동 산1', facilities: ['산책로', '운동시설', '화장실'], childFriendly: true, petFriendly: true, accessible: false },
  { id: 'p008', name: '몽마르뜨공원', type: '소공원', lat: 37.5040, lng: 127.0200, area: 8000, district: '서초구', address: '서울 서초구 반포동 725', facilities: ['산책로', '벤치', '화장실'], childFriendly: true, petFriendly: true, accessible: true },

  // 송파구
  { id: 'p009', name: '올림픽공원', type: '체육공원', lat: 37.5210, lng: 127.1220, area: 1450000, district: '송파구', address: '서울 송파구 올림픽로 424', facilities: ['산책로', '자전거도로', '운동시설', '공연장', '화장실', '주차장', '카페'], childFriendly: true, petFriendly: true, accessible: true },
  { id: 'p010', name: '석촌호수공원', type: '근린공원', lat: 37.5090, lng: 127.1000, area: 220000, district: '송파구', address: '서울 송파구 석촌호수로 166', facilities: ['산책로', '호수', '화장실', '카페'], childFriendly: true, petFriendly: true, accessible: true },
  { id: 'p011', name: '잠실한강공원', type: '한강공원', lat: 37.5230, lng: 127.0870, area: 800000, district: '송파구', address: '서울 송파구 잠실동 40', facilities: ['산책로', '자전거도로', '수영장', '화장실', '주차장'], childFriendly: true, petFriendly: true, accessible: true },
  { id: 'p012', name: '방이동생태경관보전지역', type: '생태공원', lat: 37.5140, lng: 127.1180, area: 68000, district: '송파구', address: '서울 송파구 방이동 산1', facilities: ['산책로', '생태관찰'], childFriendly: true, petFriendly: false, accessible: false },

  // 마포구
  { id: 'p013', name: '월드컵공원', type: '근린공원', lat: 37.5680, lng: 126.8980, area: 3470000, district: '마포구', address: '서울 마포구 하늘공원로 95', facilities: ['산책로', '자전거도로', '운동시설', '화장실', '주차장', '카페'], childFriendly: true, petFriendly: true, accessible: true },
  { id: 'p014', name: '망원한강공원', type: '한강공원', lat: 37.5540, lng: 126.9010, area: 600000, district: '마포구', address: '서울 마포구 망원동 402', facilities: ['산책로', '자전거도로', '수영장', '화장실', '주차장'], childFriendly: true, petFriendly: true, accessible: true },
  { id: 'p015', name: '홍제천근린공원', type: '근린공원', lat: 37.5780, lng: 126.9340, area: 45000, district: '마포구', address: '서울 마포구 성산동 600', facilities: ['산책로', '운동시설', '화장실'], childFriendly: true, petFriendly: true, accessible: true },

  // 용산구
  { id: 'p016', name: '용산가족공원', type: '근린공원', lat: 37.5240, lng: 126.9790, area: 300000, district: '용산구', address: '서울 용산구 서빙고로 185', facilities: ['산책로', '운동시설', '어린이놀이터', '화장실', '주차장'], childFriendly: true, petFriendly: true, accessible: true },
  { id: 'p017', name: '이촌한강공원', type: '한강공원', lat: 37.5180, lng: 126.9700, area: 700000, district: '용산구', address: '서울 용산구 이촌동 302', facilities: ['산책로', '자전거도로', '화장실', '주차장'], childFriendly: true, petFriendly: true, accessible: true },
  { id: 'p018', name: '남산공원', type: '근린공원', lat: 37.5512, lng: 126.9882, area: 2970000, district: '용산구', address: '서울 용산구 남산공원길 105', facilities: ['산책로', '케이블카', '전망대', '화장실', '주차장'], childFriendly: true, petFriendly: true, accessible: false },

  // 종로구
  { id: 'p019', name: '북악산공원', type: '근린공원', lat: 37.5960, lng: 126.9810, area: 5000000, district: '종로구', address: '서울 종로구 청운동 산1', facilities: ['등산로', '화장실'], childFriendly: false, petFriendly: false, accessible: false },
  { id: 'p020', name: '창경궁공원', type: '역사공원', lat: 37.5790, lng: 126.9950, area: 175000, district: '종로구', address: '서울 종로구 창경궁로 185', facilities: ['산책로', '역사유적', '화장실', '주차장'], childFriendly: true, petFriendly: false, accessible: true },
  { id: 'p021', name: '낙산공원', type: '근린공원', lat: 37.5790, lng: 127.0060, area: 130000, district: '종로구', address: '서울 종로구 낙산길 41', facilities: ['산책로', '성곽', '화장실'], childFriendly: true, petFriendly: true, accessible: false },

  // 성동구
  { id: 'p022', name: '서울숲', type: '근린공원', lat: 37.5445, lng: 127.0374, area: 1156000, district: '성동구', address: '서울 성동구 뚝섬로 273', facilities: ['산책로', '자전거도로', '어린이놀이터', '화장실', '주차장', '카페'], childFriendly: true, petFriendly: true, accessible: true },
  { id: 'p023', name: '응봉산공원', type: '근린공원', lat: 37.5430, lng: 127.0270, area: 85000, district: '성동구', address: '서울 성동구 응봉동 산1', facilities: ['등산로', '전망대', '화장실'], childFriendly: false, petFriendly: true, accessible: false },

  // 광진구
  { id: 'p024', name: '어린이대공원', type: '어린이공원', lat: 37.5480, lng: 127.0730, area: 530000, district: '광진구', address: '서울 광진구 능동로 216', facilities: ['놀이시설', '동물원', '공연장', '화장실', '주차장', '카페'], childFriendly: true, petFriendly: false, accessible: true },
  { id: 'p025', name: '뚝섬한강공원', type: '한강공원', lat: 37.5310, lng: 127.0660, area: 900000, district: '광진구', address: '서울 광진구 강변북로 139', facilities: ['산책로', '자전거도로', '수영장', '화장실', '주차장', '카페'], childFriendly: true, petFriendly: true, accessible: true },

  // 노원구
  { id: 'p026', name: '불암산공원', type: '근린공원', lat: 37.6540, lng: 127.0960, area: 8000000, district: '노원구', address: '서울 노원구 상계동 산1', facilities: ['등산로', '화장실'], childFriendly: false, petFriendly: true, accessible: false },
  { id: 'p027', name: '중계근린공원', type: '근린공원', lat: 37.6380, lng: 127.0720, area: 42000, district: '노원구', address: '서울 노원구 중계동 400', facilities: ['산책로', '운동시설', '어린이놀이터', '화장실'], childFriendly: true, petFriendly: true, accessible: true },
  { id: 'p028', name: '수락산공원', type: '근린공원', lat: 37.6720, lng: 127.0780, area: 6000000, district: '노원구', address: '서울 노원구 상계동 산1-1', facilities: ['등산로', '화장실'], childFriendly: false, petFriendly: true, accessible: false },

  // 도봉구
  { id: 'p029', name: '도봉산공원', type: '근린공원', lat: 37.6890, lng: 127.0440, area: 12000000, district: '도봉구', address: '서울 도봉구 도봉동 산1', facilities: ['등산로', '화장실', '주차장'], childFriendly: false, petFriendly: true, accessible: false },
  { id: 'p030', name: '방학근린공원', type: '근린공원', lat: 37.6680, lng: 127.0350, area: 28000, district: '도봉구', address: '서울 도봉구 방학동 680', facilities: ['산책로', '운동시설', '화장실'], childFriendly: true, petFriendly: true, accessible: true },

  // 강북구
  { id: 'p031', name: '북서울꿈의숲', type: '근린공원', lat: 37.6290, lng: 127.0380, area: 660000, district: '강북구', address: '서울 강북구 월계로 173', facilities: ['산책로', '공연장', '전망대', '화장실', '주차장', '카페'], childFriendly: true, petFriendly: true, accessible: true },
  { id: 'p032', name: '우이동근린공원', type: '근린공원', lat: 37.6540, lng: 127.0120, area: 55000, district: '강북구', address: '서울 강북구 우이동 산1', facilities: ['산책로', '화장실'], childFriendly: true, petFriendly: true, accessible: false },

  // 은평구
  { id: 'p033', name: '북한산국립공원(은평)', type: '국립공원', lat: 37.6380, lng: 126.9620, area: 15000000, district: '은평구', address: '서울 은평구 진관동 산1', facilities: ['등산로', '화장실', '주차장'], childFriendly: false, petFriendly: false, accessible: false },
  { id: 'p034', name: '은평뉴타운근린공원', type: '근린공원', lat: 37.6280, lng: 126.9280, area: 38000, district: '은평구', address: '서울 은평구 진관동 100', facilities: ['산책로', '운동시설', '어린이놀이터', '화장실'], childFriendly: true, petFriendly: true, accessible: true },

  // 서대문구
  { id: 'p035', name: '안산공원', type: '근린공원', lat: 37.5780, lng: 126.9380, area: 2950000, district: '서대문구', address: '서울 서대문구 봉원동 산1', facilities: ['등산로', '산책로', '화장실'], childFriendly: true, petFriendly: true, accessible: false },
  { id: 'p036', name: '홍제근린공원', type: '근린공원', lat: 37.5840, lng: 126.9440, area: 22000, district: '서대문구', address: '서울 서대문구 홍제동 300', facilities: ['산책로', '운동시설', '화장실'], childFriendly: true, petFriendly: true, accessible: true },

  // 중구
  { id: 'p037', name: '남산골한옥마을', type: '역사공원', lat: 37.5590, lng: 126.9940, area: 79000, district: '중구', address: '서울 중구 퇴계로34길 28', facilities: ['산책로', '역사유적', '화장실', '주차장'], childFriendly: true, petFriendly: false, accessible: true },
  { id: 'p038', name: '장충단공원', type: '근린공원', lat: 37.5590, lng: 127.0060, area: 130000, district: '중구', address: '서울 중구 동호로 261', facilities: ['산책로', '역사유적', '화장실'], childFriendly: true, petFriendly: true, accessible: true },

  // 동대문구
  { id: 'p039', name: '배봉산근린공원', type: '근린공원', lat: 37.5840, lng: 127.0560, area: 380000, district: '동대문구', address: '서울 동대문구 전농동 산1', facilities: ['등산로', '산책로', '화장실'], childFriendly: true, petFriendly: true, accessible: false },
  { id: 'p040', name: '홍릉수목원', type: '수목원', lat: 37.5920, lng: 127.0480, area: 440000, district: '동대문구', address: '서울 동대문구 회기로 57', facilities: ['산책로', '수목원', '화장실'], childFriendly: true, petFriendly: false, accessible: true },

  // 중랑구
  { id: 'p041', name: '용마산공원', type: '근린공원', lat: 37.5720, lng: 127.0940, area: 3500000, district: '중랑구', address: '서울 중랑구 면목동 산1', facilities: ['등산로', '화장실'], childFriendly: false, petFriendly: true, accessible: false },
  { id: 'p042', name: '중랑천근린공원', type: '근린공원', lat: 37.5980, lng: 127.0820, area: 180000, district: '중랑구', address: '서울 중랑구 망우동 400', facilities: ['산책로', '자전거도로', '운동시설', '화장실'], childFriendly: true, petFriendly: true, accessible: true },

  // 성북구
  { id: 'p043', name: '북악산공원(성북)', type: '근린공원', lat: 37.6020, lng: 126.9980, area: 4000000, district: '성북구', address: '서울 성북구 성북동 산1', facilities: ['등산로', '화장실'], childFriendly: false, petFriendly: true, accessible: false },
  { id: 'p044', name: '정릉근린공원', type: '근린공원', lat: 37.6120, lng: 127.0020, area: 65000, district: '성북구', address: '서울 성북구 정릉동 900', facilities: ['산책로', '운동시설', '화장실'], childFriendly: true, petFriendly: true, accessible: true },

  // 강서구
  { id: 'p045', name: '강서한강공원', type: '한강공원', lat: 37.5680, lng: 126.8340, area: 1200000, district: '강서구', address: '서울 강서구 화곡동 1000', facilities: ['산책로', '자전거도로', '화장실', '주차장'], childFriendly: true, petFriendly: true, accessible: true },
  { id: 'p046', name: '우장산공원', type: '근린공원', lat: 37.5560, lng: 126.8480, area: 1100000, district: '강서구', address: '서울 강서구 화곡동 산1', facilities: ['등산로', '산책로', '운동시설', '화장실'], childFriendly: true, petFriendly: true, accessible: false },

  // 양천구
  { id: 'p047', name: '목동근린공원', type: '근린공원', lat: 37.5280, lng: 126.8740, area: 95000, district: '양천구', address: '서울 양천구 목동 900', facilities: ['산책로', '운동시설', '어린이놀이터', '화장실'], childFriendly: true, petFriendly: true, accessible: true },
  { id: 'p048', name: '신정근린공원', type: '근린공원', lat: 37.5180, lng: 126.8660, area: 48000, district: '양천구', address: '서울 양천구 신정동 1200', facilities: ['산책로', '운동시설', '화장실'], childFriendly: true, petFriendly: true, accessible: true },

  // 구로구
  { id: 'p049', name: '안양천근린공원', type: '근린공원', lat: 37.4980, lng: 126.8680, area: 250000, district: '구로구', address: '서울 구로구 고척동 400', facilities: ['산책로', '자전거도로', '운동시설', '화장실'], childFriendly: true, petFriendly: true, accessible: true },
  { id: 'p050', name: '구로근린공원', type: '근린공원', lat: 37.4940, lng: 126.8880, area: 35000, district: '구로구', address: '서울 구로구 구로동 700', facilities: ['산책로', '운동시설', '화장실'], childFriendly: true, petFriendly: true, accessible: true },

  // 금천구
  { id: 'p051', name: '호암산공원', type: '근린공원', lat: 37.4680, lng: 126.8980, area: 2800000, district: '금천구', address: '서울 금천구 시흥동 산1', facilities: ['등산로', '화장실'], childFriendly: false, petFriendly: true, accessible: false },
  { id: 'p052', name: '독산근린공원', type: '근린공원', lat: 37.4820, lng: 126.8980, area: 28000, district: '금천구', address: '서울 금천구 독산동 800', facilities: ['산책로', '운동시설', '화장실'], childFriendly: true, petFriendly: true, accessible: true },

  // 영등포구
  { id: 'p053', name: '여의도한강공원', type: '한강공원', lat: 37.5280, lng: 126.9340, area: 1000000, district: '영등포구', address: '서울 영등포구 여의동로 330', facilities: ['산책로', '자전거도로', '수영장', '화장실', '주차장', '카페'], childFriendly: true, petFriendly: true, accessible: true },
  { id: 'p054', name: '여의도공원', type: '근린공원', lat: 37.5260, lng: 126.9240, area: 230000, district: '영등포구', address: '서울 영등포구 여의공원로 68', facilities: ['산책로', '자전거도로', '운동시설', '화장실', '주차장'], childFriendly: true, petFriendly: true, accessible: true },

  // 동작구
  { id: 'p055', name: '보라매공원', type: '근린공원', lat: 37.4940, lng: 126.9240, area: 420000, district: '동작구', address: '서울 동작구 여의대방로20길 33', facilities: ['산책로', '운동시설', '어린이놀이터', '화장실', '주차장'], childFriendly: true, petFriendly: true, accessible: true },
  { id: 'p056', name: '국립현충원공원', type: '역사공원', lat: 37.5000, lng: 126.9780, area: 1440000, district: '동작구', address: '서울 동작구 현충로 210', facilities: ['산책로', '역사유적', '화장실', '주차장'], childFriendly: true, petFriendly: false, accessible: true },

  // 관악구
  { id: 'p057', name: '관악산공원', type: '근린공원', lat: 37.4440, lng: 126.9640, area: 8600000, district: '관악구', address: '서울 관악구 신림동 산1', facilities: ['등산로', '화장실', '주차장'], childFriendly: false, petFriendly: true, accessible: false },
  { id: 'p058', name: '낙성대공원', type: '근린공원', lat: 37.4780, lng: 126.9620, area: 35000, district: '관악구', address: '서울 관악구 낙성대로 77', facilities: ['산책로', '역사유적', '화장실'], childFriendly: true, petFriendly: true, accessible: true },

  // 강동구
  { id: 'p059', name: '암사생태공원', type: '생태공원', lat: 37.5540, lng: 127.1380, area: 280000, district: '강동구', address: '서울 강동구 암사동 630', facilities: ['산책로', '생태관찰', '화장실'], childFriendly: true, petFriendly: false, accessible: true },
  { id: 'p060', name: '고덕근린공원', type: '근린공원', lat: 37.5540, lng: 127.1560, area: 1200000, district: '강동구', address: '서울 강동구 고덕동 산1', facilities: ['등산로', '산책로', '운동시설', '화장실'], childFriendly: true, petFriendly: true, accessible: false },

  // 강남구 추가
  { id: 'p061', name: '탄천근린공원', type: '근린공원', lat: 37.4860, lng: 127.0780, area: 320000, district: '강남구', address: '서울 강남구 수서동 700', facilities: ['산책로', '자전거도로', '운동시설', '화장실'], childFriendly: true, petFriendly: true, accessible: true },
  { id: 'p062', name: '일원근린공원', type: '근린공원', lat: 37.4780, lng: 127.0820, area: 42000, district: '강남구', address: '서울 강남구 일원동 600', facilities: ['산책로', '운동시설', '화장실'], childFriendly: true, petFriendly: true, accessible: true },

  // 노원구 추가
  { id: 'p063', name: '노원구민체육공원', type: '체육공원', lat: 37.6540, lng: 127.0620, area: 55000, district: '노원구', address: '서울 노원구 노원로 283', facilities: ['운동시설', '수영장', '화장실', '주차장'], childFriendly: true, petFriendly: false, accessible: true },
  { id: 'p064', name: '당현천근린공원', type: '근린공원', lat: 37.6420, lng: 127.0680, area: 38000, district: '노원구', address: '서울 노원구 하계동 300', facilities: ['산책로', '운동시설', '화장실'], childFriendly: true, petFriendly: true, accessible: true },

  // 은평구 추가
  { id: 'p065', name: '불광근린공원', type: '근린공원', lat: 37.6120, lng: 126.9280, area: 32000, district: '은평구', address: '서울 은평구 불광동 400', facilities: ['산책로', '운동시설', '화장실'], childFriendly: true, petFriendly: true, accessible: true },

  // 마포구 추가
  { id: 'p066', name: '상암근린공원', type: '근린공원', lat: 37.5780, lng: 126.8880, area: 48000, district: '마포구', address: '서울 마포구 상암동 1600', facilities: ['산책로', '운동시설', '어린이놀이터', '화장실'], childFriendly: true, petFriendly: true, accessible: true },

  // 성동구 추가
  { id: 'p067', name: '살곶이공원', type: '근린공원', lat: 37.5540, lng: 127.0480, area: 120000, district: '성동구', address: '서울 성동구 행당동 400', facilities: ['산책로', '운동시설', '화장실'], childFriendly: true, petFriendly: true, accessible: true },

  // 광진구 추가
  { id: 'p068', name: '아차산근린공원', type: '근린공원', lat: 37.5540, lng: 127.0980, area: 2800000, district: '광진구', address: '서울 광진구 광장동 산1', facilities: ['등산로', '화장실', '주차장'], childFriendly: false, petFriendly: true, accessible: false },

  // 동대문구 추가
  { id: 'p069', name: '청계천근린공원', type: '근린공원', lat: 37.5700, lng: 127.0380, area: 85000, district: '동대문구', address: '서울 동대문구 답십리동 500', facilities: ['산책로', '자전거도로', '화장실'], childFriendly: true, petFriendly: true, accessible: true },

  // 중랑구 추가
  { id: 'p070', name: '봉화산근린공원', type: '근린공원', lat: 37.6120, lng: 127.0820, area: 1200000, district: '중랑구', address: '서울 중랑구 신내동 산1', facilities: ['등산로', '화장실'], childFriendly: false, petFriendly: true, accessible: false },
];

export const DISTRICT_CENTERS: Record<string, { lat: number; lng: number }> = {
  '강남구': { lat: 37.5172, lng: 127.0473 },
  '강동구': { lat: 37.5301, lng: 127.1238 },
  '강북구': { lat: 37.6396, lng: 127.0257 },
  '강서구': { lat: 37.5509, lng: 126.8495 },
  '관악구': { lat: 37.4784, lng: 126.9516 },
  '광진구': { lat: 37.5384, lng: 127.0822 },
  '구로구': { lat: 37.4954, lng: 126.8874 },
  '금천구': { lat: 37.4569, lng: 126.8955 },
  '노원구': { lat: 37.6542, lng: 127.0568 },
  '도봉구': { lat: 37.6688, lng: 127.0471 },
  '동대문구': { lat: 37.5744, lng: 127.0396 },
  '동작구': { lat: 37.5124, lng: 126.9393 },
  '마포구': { lat: 37.5663, lng: 126.9014 },
  '서대문구': { lat: 37.5791, lng: 126.9368 },
  '서초구': { lat: 37.4837, lng: 127.0324 },
  '성동구': { lat: 37.5633, lng: 127.0371 },
  '성북구': { lat: 37.5894, lng: 127.0167 },
  '송파구': { lat: 37.5145, lng: 127.1059 },
  '양천구': { lat: 37.5270, lng: 126.8561 },
  '영등포구': { lat: 37.5264, lng: 126.8963 },
  '용산구': { lat: 37.5324, lng: 126.9904 },
  '은평구': { lat: 37.6026, lng: 126.9291 },
  '종로구': { lat: 37.5730, lng: 126.9794 },
  '중구': { lat: 37.5641, lng: 126.9979 },
  '중랑구': { lat: 37.6063, lng: 127.0927 },
};
