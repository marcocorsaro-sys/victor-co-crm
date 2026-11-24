#!/usr/bin/env python3
"""Parse saved Firecrawl rawHtml tool-results of the 4 portals into normalized listing rows.
Usage: python3 -I parse.py <portal> <file> [...]  -> appends to listings.jsonl
portal in: immobiliare | idealista | casa | subito
"""
import json, re, sys, html as H
from datetime import datetime

def load_html(path):
    txt = open(path, encoding='utf-8').read()
    if txt.lstrip().startswith('{'):
        try:
            return json.loads(txt)['rawHtml']
        except Exception:
            pass
    return txt

def num(s):
    if s is None: return None
    m = re.search(r'[\d.]+', str(s).replace(' ', ''))
    if not m: return None
    try: return int(m.group(0).replace('.', ''))
    except: return None

def base(portal, pid, url):
    return {"portal": portal, "portal_id": str(pid), "url": url, "title": None, "price": None, "old_price": None,
            "ptype": None, "rooms": None, "surface": None, "bathrooms": None, "floor": None, "zone": None,
            "address": None, "lat": None, "lon": None, "agency": None, "is_private": False, "thumb": None,
            "description": None, "tags": [], "portal_date": None, "ref": None, "energy": None, "condition": None}

# ---------------- immobiliare.it ----------------
def parse_immobiliare(h):
    m = re.search(r'id="__NEXT_DATA__"[^>]*>(.*?)</script>', h, re.S)
    d = json.loads(m.group(1))
    out = []
    def find(o):
        if isinstance(o, dict):
            if 'results' in o and 'totalAds' in o: return o
            for v in o.values():
                r = find(v)
                if r: return r
        if isinstance(o, list):
            for v in o:
                r = find(v)
                if r: return r
    data = find(d)
    for item in data['results']:
        r = item['realEstate']; p = r['properties'][0]
        b = base('immobiliare', r['id'], f"https://www.immobiliare.it/annunci/{r['id']}/")
        b['title'] = r.get('title'); b['price'] = (r.get('price') or {}).get('value')
        b['ptype'] = (r.get('typology') or {}).get('name'); b['rooms'] = num(p.get('rooms'))
        b['surface'] = num(p.get('surface')); b['bathrooms'] = num(p.get('bathrooms'))
        b['floor'] = (p.get('floor') or {}).get('value'); b['condition'] = p.get('ga4Condition')
        loc = p.get('location') or {}
        b['zone'] = loc.get('macrozone'); b['address'] = loc.get('address'); b['lat'] = loc.get('latitude'); b['lon'] = loc.get('longitude')
        adv = (r.get('advertiser') or {})
        ag = adv.get('agency')
        if ag: b['agency'] = ag.get('displayName')
        else:
            b['is_private'] = True; b['agency'] = 'Privato'
        ph = p.get('photo') or {}
        b['thumb'] = (ph.get('urls') or {}).get('medium') or (ph.get('urls') or {}).get('small')
        b['description'] = (p.get('caption') or '')[:300]
        tags = []
        if r.get('isNew'): tags.append('nuovo')
        if r.get('luxury'): tags.append('lusso')
        if r.get('visibility') and r['visibility'] != 'base': tags.append(r['visibility'])
        b['tags'] = tags
        en = p.get('energy') or {}
        b['energy'] = en.get('class') if isinstance(en, dict) else None
        out.append(b)
    return out, data.get('totalAds'), data.get('maxPages')

# ---------------- idealista.it ----------------
def parse_idealista(h):
    arts = re.findall(r'<article[^>]*class="item[^"]*"[^>]*>.*?</article>', h, re.S)
    out = []
    for a in arts:
        pid = re.search(r'data-element-id="(\d+)"', a)
        if not pid: continue
        pid = pid.group(1)
        a1 = re.sub(r'\s+', ' ', a)
        agm = re.search(r'<picture class="logo-branding">\s*<a[^>]*title="([^"]*)"', a1)
        a2 = re.sub(r'<picture.*?</picture>', '', a, flags=re.S); a2 = re.sub(r'\s+', ' ', a2)
        b = base('idealista', pid, f"https://www.idealista.it/immobile/{pid}/")
        if agm: b['agency'] = H.unescape(agm.group(1)).strip()
        t = re.search(r'class="item-link\s*"[^>]*title="([^"]*)"', a2); b['title'] = H.unescape(t.group(1)) if t else None
        pr = re.search(r'data-price="([^"]*)"', a2); b['price'] = num(pr.group(1)) if pr else None
        od = re.search(r'pricedown_price">\s*([\d.]+)', a2); b['old_price'] = num(od.group(1)) if od else None
        det = re.findall(r'<span class="item-detail">([^<]*)</span>', a2)
        for x in det:
            x = x.strip()
            if 'local' in x: b['rooms'] = num(x)
            elif 'm²' in x and 'terreno' not in x: b['surface'] = num(x)
            elif 'piano' in x.lower(): b['floor'] = x
        b['tags'] = [x.strip() for x in re.findall(r'class="listing-tags\s*">([^<]*)</span>', a2)]
        if re.search(r'Nuova costruzione', a2): b['tags'].append('nuova costruzione')
        if 'data-is-professional-ad="false"' in a: b['is_private'] = True; b['agency'] = b['agency'] or 'Privato'
        ds = re.search(r'item-description description"><p class="ellipsis">\s*(.*?)\s*</p>', a2); b['description'] = H.unescape(ds.group(1))[:300] if ds else None
        th = re.search(r'<img[^>]*src="(https://img\d\.idealista\.it[^"]+)"', a); b['thumb'] = th.group(1) if th else None
        if b['title']:
            mm = re.match(r'(.+?) (?:in|a) (.+?), (?:Oleggio|Novara)$', b['title']) or re.match(r'(.+?) a (?:Oleggio|Novara)$', b['title'])
            if mm:
                b['ptype'] = mm.group(1)
                if mm.lastindex and mm.lastindex >= 2: b['address'] = mm.group(2)
        out.append(b)
    tot = re.search(r'<h1[^>]*>(?:\s*<span[^>]*>)?\s*([\d.]+) case', h); tot = num(tot.group(1)) if tot else None
    pages = re.findall(r'/lista-(\d+)\.htm', h); mp = max([int(x) for x in pages]) if pages else 1
    return out, tot, mp

# ---------------- casa.it ----------------
def parse_casa(h):
    m = re.search(r'window\.__INITIAL_STATE__ = JSON\.parse\("(.*?)"\);', h, re.S)
    st = json.loads(json.loads('"' + m.group(1) + '"'))
    s = st['search']; out = []
    for l in s['list']:
        f = l.get('features') or {}; g = l.get('geoInfos') or {}; pub = l.get('publisher') or {}
        b = base('casa', l['id'], 'https://www.casa.it' + l['uri'])
        tt = l.get('title') or {}
        b['title'] = ' '.join([tt.get('main') or ''] + (tt.get('additional') or [])).strip()
        b['price'] = num((f.get('price') or {}).get('value')); b['ptype'] = tt.get('main')
        b['rooms'] = f.get('rooms'); b['surface'] = f.get('mq'); b['bathrooms'] = f.get('bathrooms'); b['floor'] = f.get('level')
        b['energy'] = f.get('energyClass')
        b['zone'] = g.get('district_name'); b['address'] = g.get('street') or None; b['lat'] = g.get('lat'); b['lon'] = g.get('lon')
        b['agency'] = pub.get('publisherName'); b['is_private'] = (pub.get('publisherType') or '').lower() == 'private'
        if b['is_private']: b['agency'] = 'Privato'
        its = ((l.get('media') or {}).get('items') or [])
        if its: b['thumb'] = 'https://images-1.casa.it/360x265' + its[0]['uri']
        b['description'] = (l.get('description') or '')[:300]; b['ref'] = l.get('refPublisher')
        b['tags'] = list(l.get('labels') or []) + ([l['depth']] if l.get('depth') else [])
        if l.get('isAuction'): b['tags'].append('asta')
        out.append(b)
    return out, s.get('total'), (s.get('paginator') or {}).get('totalPages')

# ---------------- subito.it ----------------
def parse_subito(h):
    m = re.search(r'id="__NEXT_DATA__"[^>]*>(.*?)</script>', h, re.S)
    d = json.loads(m.group(1)); s = json.dumps(d)
    def find(o):
        if isinstance(o, dict):
            if 'originalList' in o and 'total' in o: return o
            for v in o.values():
                r = find(v)
                if r: return r
        if isinstance(o, list):
            for v in o:
                r = find(v)
                if r: return r
    items = find(d); out = []
    for ad in items['originalList']:
        if ad.get('kind') != 'AdItem': continue
        pid = ad['urn'].split(':')[2]
        b = base('subito', pid, ad.get('urls', {}).get('default') or f"https://www.subito.it/annunci/{pid}.htm")
        b['title'] = ad.get('subject'); b['description'] = (ad.get('body') or '')[:300]
        b['portal_date'] = (ad.get('date') or '')[:10] or None
        feats = ad.get('features') or {}
        def fv(key):
            f = feats.get(key)
            if f and f.get('values'): return f['values'][0].get('key') or f['values'][0].get('value')
            return None
        b['price'] = num(fv('/price')); b['rooms'] = num(fv('/room')); b['surface'] = num(fv('/size'))
        b['bathrooms'] = num(fv('/bathrooms')); b['floor'] = (feats.get('/floor') or {}).get('values', [{}])[0].get('value'); b['energy'] = (feats.get('/energy_class') or {}).get('values', [{}])[0].get('value')
        b['condition'] = (feats.get('/building_condition') or {}).get('values', [{}])[0].get('value')
        b['ptype'] = (ad.get('category') or {}).get('label')
        adv = ad.get('advertiser') or {}
        b['is_private'] = not adv.get('company')
        b['agency'] = 'Privato' if b['is_private'] else (adv.get('shopName') or adv.get('name'))
        geo = ad.get('geo') or {}
        mp = geo.get('map') or {}
        b['lat'] = float(mp['latitude']) if mp.get('latitude') else None; b['lon'] = float(mp['longitude']) if mp.get('longitude') else None
        imgs = ad.get('images') or []
        if imgs: b['thumb'] = imgs[0]['cdnBaseUrl'] + '?rule=card-mobile-1x-auto'
        b['tags'] = []
        out.append(b)
    return out, items.get('total'), items.get('totalPages')

PARSERS = {'immobiliare': parse_immobiliare, 'idealista': parse_idealista, 'casa': parse_casa, 'subito': parse_subito}

if __name__ == '__main__':
    portal = sys.argv[1]
    rows = []
    for f in sys.argv[2:]:
        out, tot, mp = PARSERS[portal](load_html(f))
        print(f"{portal} {f.split('/')[-1][:40]}: {len(out)} items (total {tot}, pages {mp})")
        rows += out
    with open('listings.jsonl', 'a') as fh:
        for r in rows: fh.write(json.dumps(r, ensure_ascii=False) + '\n')
