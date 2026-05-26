import psycopg2
conn = psycopg2.connect('postgresql://greenreach:vTTuF4gbHs2JE4LR2wuCMbrNCupmm7NS@dpg-d8ameep9rddc73a8niv0-a.singapore-postgres.render.com/greenreach')
cur = conn.cursor()
cur.execute('SELECT COUNT(*) FROM parks;')
print('총 공원 수:', cur.fetchone()[0])
cur.execute('SELECT type, COUNT(*) FROM parks GROUP BY type ORDER BY COUNT(*) DESC LIMIT 5;')
print('공원 유형별 TOP5:')
for row in cur.fetchall():
    print(f'  {row[0]}: {row[1]}개')
cur.execute('SELECT PostGIS_Version();')
print('PostGIS:', cur.fetchone()[0][:30])
conn.close()
print('DB 확인 완료!')
