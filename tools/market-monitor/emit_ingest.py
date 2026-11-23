#!/usr/bin/env python3
"""Turn listings.jsonl into one compact JSON array per portal, ready for
   select market_ingest('<portal>', '<json>'::jsonb)  on Supabase.
Usage: python3 -I emit_ingest.py  -> writes ingest_<portal>.json (+ .sql with the full statement)"""
import json
from collections import defaultdict
rows = [json.loads(l) for l in open('listings.jsonl')]
seen = set(); by = defaultdict(list)
for r in rows:
    k = (r['portal'], r['portal_id'])
    if k in seen: continue
    seen.add(k)
    by[r['portal']].append({k2: r.get(k2) for k2 in ['portal_id','url','title','price','old_price','ptype','rooms','surface','bathrooms','floor','zone','address','lat','lon','agency','is_private','thumb','description','tags','portal_date','ref','energy','condition'] if r.get(k2) not in (None, '', [])})
for p, items in by.items():
    js = json.dumps(items, ensure_ascii=False, separators=(',', ':'))
    open(f'ingest_{p}.json', 'w').write(js)
    open(f'ingest_{p}.sql', 'w').write(f"select market_ingest('{p}', '{js.replace(chr(39), chr(39)*2)}'::jsonb);")
    print(p, len(items), 'items', len(js), 'bytes')
