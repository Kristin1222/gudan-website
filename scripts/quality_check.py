# -*- coding: utf-8 -*-
import json, sys
sys.stdout.reconfigure(encoding='utf-8')

with open(r'F:\上外\比赛\大创\三期开发\data\poems_enriched.json','r',encoding='utf-8') as f:
    data = json.load(f)

# 检查所有字段填充情况
need_check = []
for p in data:
    for field in ('translation','notes','appreciation','background','author_bio','form'):
        if not p.get(field):
            need_check.append((p['id'], p['title'], field, '缺失'))

print(f'总 {len(data)} 首')
print(f'所有字段填充完整：{len(need_check)==0}')
if need_check:
    print('缺失项：', need_check[:10])

# 抽查高中 3 首
print('\n=== 高中抽查 ===')
for p in data:
    if p['grade']=='gaozhong' and p['id'] in (41, 46, 50):
        print('='*60)
        print(f"[{p['id']}] {p['title']} - {p['author']} ({p['dynasty']}) - {p['form']}")
        print(f"【译文】{p['translation']}")
        print(f"【注释】{p['notes']}")
        print(f"【赏析】{p['appreciation']}")
        print(f"【背景】{p['background']}")
        print(f"【作者】{p['author_bio']}")
