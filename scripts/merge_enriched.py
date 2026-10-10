# -*- coding: utf-8 -*-
"""
把 poems_enriched.json（GLM 生成的结构化内容）合并回 poems-data.js
输出新文件 poems-data-v2.js，保留 v1 不动，便于回滚
"""

import json
import os
import re

ENRICHED = r"F:\上外\比赛\大创\三期开发\data\poems_enriched.json"
ORIGINAL = r"F:\上外\比赛\大创\三期开发\frontend\js\poems-data.js"
OUTPUT = r"F:\上外\比赛\大创\三期开发\frontend\js\poems-data-v2.js"

with open(ENRICHED, "r", encoding="utf-8") as f:
    enriched = json.load(f)

with open(ORIGINAL, "r", encoding="utf-8") as f:
    src = f.read()

# 按 id 索引
em = {p["id"]: p for p in enriched}

# 用 Node 提取原始 POEMS，再合并
RAW = r"F:\上外\比赛\大创\三期开发\data\poems_raw.json"
with open(RAW, "r", encoding="utf-8") as f:
    raw = json.load(f)

merged = []
for p in raw:
    pid = p["id"]
    if pid in em:
        # 合并：原数据 + enrich 字段
        merged_item = dict(p)
        for k in ("translation", "notes", "appreciation", "background", "author_bio", "form"):
            if k in em[pid] and em[pid][k]:
                merged_item[k] = em[pid][k]
        merged.append(merged_item)
    else:
        merged.append(p)

print(f"合并完成：{len(merged)} 首；已 enrich {len(em)} 首")

# 写出新版 poems-data-v2.js
def js_repr(o, indent=2, level=0):
    pad = "  " * level
    if isinstance(o, dict):
        items = []
        for k, v in o.items():
            items.append(pad + "  " + repr(k) + ": " + js_repr(v, indent, level + 1))
        return "{\n" + ",\n".join(items) + "\n" + pad + "}"
    if isinstance(o, list):
        if not o:
            return "[]"
        items = []
        for v in o:
            items.append(pad + "  " + js_repr(v, indent, level + 1))
        return "[\n" + ",\n".join(items) + "\n" + pad + "]"
    if isinstance(o, str):
        return json.dumps(o, ensure_ascii=False)
    if isinstance(o, bool):
        return "true" if o else "false"
    if o is None:
        return "null"
    if isinstance(o, (int, float)):
        return str(o)
    return "null"

js_arr = js_repr(merged)

new_src = f"""/**
 * 古调新弹 · 诗词库数据（v2 - 含结构化赏析）
 * 50 首 · 译文 / 注释 / 赏析 / 背景 / 作者小传 / 体裁 由 GLM-4-Flash 批量生成
 * 注释：内容由 AI 生成初稿，仍需内容组人工校审
 * 学段：xiaoxue 小学 22 首 / chuzhong 初中 16 首 / gaozhong 高中 12 首
 */
const POEMS = {js_arr};

const GRADE_LABEL = {{ xiaoxue: "小学", chuzhong: "初中", gaozhong: "高中" }};
if (typeof module !== "undefined") {{ module.exports = {{ POEMS, GRADE_LABEL }}; }}
"""

with open(OUTPUT, "w", encoding="utf-8") as f:
    f.write(new_src)
print(f"已写入 {OUTPUT}")
print(f"文件大小：{os.path.getsize(OUTPUT) / 1024:.1f} KB")
