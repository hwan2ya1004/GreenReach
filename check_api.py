import urllib.request, json

BASE = "https://greenreach-api.onrender.com"
KEY = "greenreach2026"

def call(url):
    req = urllib.request.Request(url, headers={"x-admin-key": KEY})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())

# 1. 경기도 구/군 목록
print("=== 경기도 구/군 목록 ===")
d = call(f"{BASE}/api/admin/park-ranking?city=%EA%B2%BD%EA%B8%B0%EB%8F%84")
print(f"mode={d.get('mode')}, total={d.get('total')}")
for x in d.get("districts", [])[:20]:
    print(f"  {x['district']}: {x['parkCount']}개")

# 2. 경기도 성남시 동 단위
print()
print("=== 경기도 성남시 동 단위 ===")
d2 = call(f"{BASE}/api/admin/park-ranking?city=%EA%B2%BD%EA%B8%B0%EB%8F%84&district=%EC%84%B1%EB%82%A8%EC%8B%9C")
print(f"mode={d2.get('mode')}, total={d2.get('total')}, parks={len(d2.get('parks', []))}")
for x in d2.get("districts", [])[:10]:
    print(f"  {x['district']}: {x['parkCount']}개")
