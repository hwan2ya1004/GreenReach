import sys
sys.path.insert(0, '.')
from backend.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    print("=== 성남 주소 샘플 ===")
    rows = conn.execute(text("SELECT address, district FROM parks WHERE address LIKE '%성남%' LIMIT 10")).fetchall()
    for r in rows:
        print(f"address={r.address!r}, district={r.district!r}")

    print()
    print("=== 경기도 주소 샘플 ===")
    rows2 = conn.execute(text("SELECT address, district FROM parks WHERE address LIKE '경기도%' LIMIT 5")).fetchall()
    for r in rows2:
        print(f"address={r.address!r}, district={r.district!r}")

    print()
    print("=== 경기도 district 목록 (상위 20) ===")
    rows3 = conn.execute(text("SELECT district, COUNT(*) as cnt FROM parks WHERE address LIKE '경기도%' GROUP BY district ORDER BY cnt DESC LIMIT 20")).fetchall()
    for r in rows3:
        print(f"district={r.district!r}, count={r.cnt}")
