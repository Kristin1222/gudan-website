#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
古调新弹 · 批量为 50 首诗生成结构化内容
字段：translation（译文） / notes（注释） / appreciation（赏析） / background（背景） / author_bio（作者小传） / form（体裁）
调用：智谱 BigModel GLM-4-Flash（免费）
"""

import json
import os
import sys
import time
import urllib.request
import urllib.error

# === 配置 ===
API_KEY = "9b7b1fd07ee0408187a2a43acfef1c5f.iN2pzGvt4SeQgXoL"
API_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions"
MODEL = "glm-4-flash"

# === 读源数据（Node 导出的 JSON） ===
SOURCE = r"F:\上外\比赛\大创\三期开发\data\poems_raw.json"
OUT_JSON = r"F:\上外\比赛\大创\三期开发\data\poems_enriched.json"

with open(SOURCE, "r", encoding="utf-8") as f:
    POEMS_RAW = json.load(f)
print(f"已读入 {len(POEMS_RAW)} 首诗")

# === 已有结果则跳过 ===
results = []
if os.path.exists(OUT_JSON):
    with open(OUT_JSON, "r", encoding="utf-8") as f:
        results = json.load(f)
    print(f"已有 {len(results)} 条历史记录")
done_ids = {r["id"] for r in results}

# === 单首生成 prompt ===
SYSTEM_PROMPT = """你是「古调新弹」诗词内容编辑，负责为中小学语文教材篇目撰写结构化赏析内容。
要求：
1. 译文：用现代白话文翻译全诗，意境准确，语句通顺，不超过原文 1.5 倍字数
2. 注释：选 3-5 个最值得讲解的字词，格式严格统一为"字1：解释1；字2：解释2；字3：解释3"，不要"字：解释"前缀
3. 赏析：120-160 字，必须包含 (a) 主题 (b) 具体艺术手法如比兴/对仗/用典/白描/叠字等 (c) 名句解读，避免"寓意深刻""意境深远"等空话
4. 创作背景：40-60 字，必须紧扣此诗的写作缘由与时代背景，避免泛泛而谈
5. 作者小传：50-70 字，必须突出该作者的独特风格（如豪放/婉约/现实主义/山水田园等），至少 2 部代表作
6. 体裁：从 [五绝, 七绝, 五律, 七律, 词, 曲, 古诗, 民歌, 乐府, 辞赋] 中选最合适的
严格按 JSON 格式输出，不要任何额外文字。"""

USER_TEMPLATE = """诗名：{title}
作者：{author}（{dynasty}）
学段：{grade_label}
原文：
{lines}

请输出 JSON：
{{
  "translation": "...",
  "notes": "字1：解释1；字2：解释2；字3：解释3",
  "appreciation": "...",
  "background": "...",
  "author_bio": "...",
  "form": "..."
}}"""

def call_glm(prompt_user, retries=3):
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt_user}
        ],
        "temperature": 0.6,
        "response_format": {"type": "json_object"}
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        API_URL,
        data=data,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {API_KEY}"
        }
    )
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                body = json.loads(resp.read().decode("utf-8"))
            content = body["choices"][0]["message"]["content"]
            return json.loads(content)
        except urllib.error.HTTPError as e:
            print(f"  HTTP {e.code}: {e.reason} (第 {attempt+1} 次重试)")
            if e.code == 429:
                time.sleep(5 * (attempt + 1))
            else:
                time.sleep(2)
        except Exception as e:
            print(f"  Error: {e} (第 {attempt+1} 次重试)")
            time.sleep(2)
    return None

GRADE_LABEL = {"xiaoxue": "小学", "chuzhong": "初中", "gaozhong": "高中"}

# === 选择要生成的 ids（默认全部，跳过已完成的） ===
target_ids = [int(a) for a in sys.argv[1:]] if len(sys.argv) > 1 else None

count_new = 0
for poem in POEMS_RAW:
    pid = poem["id"]
    if target_ids and pid not in target_ids:
        continue
    if pid in done_ids:
        continue

    lines = "\n".join(poem.get("lines", []))
    user_prompt = USER_TEMPLATE.format(
        title=poem["title"],
        author=poem["author"],
        dynasty=poem.get("dynasty", ""),
        grade_label=GRADE_LABEL.get(poem.get("grade", ""), ""),
        lines=lines
    )

    print(f"\n[{pid}] {poem['title']} - {poem['author']} ... ", end="", flush=True)
    enriched = call_glm(user_prompt)
    if not enriched:
        print("FAILED")
        continue

    # 合并原数据
    record = dict(poem)
    record.update(enriched)
    results.append(record)
    count_new += 1
    print("OK")

    # 每首保存一次（防止中断丢失）
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    time.sleep(1.2)  # 避免频率过高

print(f"\n=== 本次新增 {count_new} 首，累计 {len(results)} 首 ===")
