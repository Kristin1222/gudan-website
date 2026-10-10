# -*- coding: utf-8 -*-
import json, sys
sys.stdout.reconfigure(encoding='utf-8')

with open(r'F:\上外\比赛\大创\三期开发\data\poems_enriched.json','r',encoding='utf-8') as f:
    data = json.load(f)

for p in data:
    print('='*60)
    print(f"[{p['id']}] {p['title']} - {p['author']} ({p['dynasty']}) - 体裁：{p.get('form','?')}")
    print(f"  译文：{p['translation']}")
    print(f"  注释：{p['notes']}")
    print(f"  赏析：{p['appreciation']}")
    print(f"  背景：{p['background']}")
    print(f"  作者：{p['author_bio']}")
