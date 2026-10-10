# -*- coding: utf-8 -*-
"""
把 data/poems_enriched.json 压缩打包成云函数内置知识库
输出：cloudfunctions/chat/poems_data.json
目的：云函数不依赖数据库即可检索 50 首完整结构化数据
"""
import json
import os

SRC = r"F:\上外\比赛\大创\三期开发\data\poems_enriched.json"
DST = r"F:\上外\比赛\大创\三期开发\cloudfunctions\chat\poems_data.json"

with open(SRC, "r", encoding="utf-8") as f:
    poems = json.load(f)

# 只保留云函数需要的字段（去掉 id 等冗余，控制体积）
KEEP = ["title", "author", "dynasty", "grade", "theme", "lines", "famous",
        "translation", "notes", "appreciation", "background", "author_bio",
        "form", "lesson"]

kb = []
for p in poems:
    kb.append({k: p.get(k) for k in KEEP if p.get(k) is not None})

with open(DST, "w", encoding="utf-8") as f:
    json.dump(kb, f, ensure_ascii=False, separators=(",", ":"))

print(f"已生成 {DST}")
print(f"收录 {len(kb)} 首，文件 {os.path.getsize(DST)/1024:.1f} KB")
