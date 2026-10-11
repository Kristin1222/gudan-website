# -*- coding: utf-8 -*-
"""
内容校审批量修正：对 50 首诗词结构化内容应用人工校审结论
- P0 作者错标 / 代表作张冠李戴 / 史实错误 / 体裁错误
- P1 风格标签「豪放派」误用
- P2 注释错误
输出：
  frontend/js/poems-data.js   （前端数据，校正后）
  cloudfunctions/chat/poems_data.json （云函数知识库，校正后）
"""
import json, os, sys, io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

RAW = r"F:\上外\比赛\大创\三期开发\data\poems_raw.json"
JS_OUT = r"F:\上外\比赛\大创\三期开发\frontend\js\poems-data.js"
KB_OUT = r"F:\上外\比赛\大创\三期开发\cloudfunctions\chat\poems_data.json"

with open(RAW, "r", encoding="utf-8") as f:
    poems = json.load(f)

by_id = {p["id"]: p for p in poems}

# ---------- 整字段覆盖（key = id -> {字段: 新值}）----------
FIELD = {
    32: {
        "author": "李商隐",
        "background": "李商隐客居巴蜀时，在一个秋雨连绵的夜晚思念远方的妻子（一说友人），写下此诗。",
        "author_bio": "李商隐，晚唐著名诗人，与杜牧合称“小李杜”。其诗构思新奇、风格秾丽，爱情诗与“无题”诗成就最高。代表作有《无题》《锦瑟》《夜雨寄北》等。",
    },
    8: {
        "author_bio": "杜牧，晚唐著名诗人，与李商隐合称“小李杜”。其七绝清丽俊爽，咏史怀古成就尤高。代表作有《赤壁》《泊秦淮》《江南春》等。",
    },
    31: {
        "author_bio": "杜牧，晚唐著名诗人，与李商隐合称“小李杜”。其七绝清丽俊爽，咏史怀古成就尤高。代表作有《赤壁》《泊秦淮》《江南春》等。",
    },
    22: {
        "author_bio": "高鼎，清代诗人，存诗不多，以《村居》最为知名。其诗风格清新自然，多写乡村生活与童趣。",
    },
    50: {
        "author_bio": "李煜，南唐后主，世称“词帝”。前期词写宫廷享乐，亡国被俘后词风凄婉深沉、哀怨动人。代表作有《虞美人·春花秋月何时了》《浪淘沙·帘外雨潺潺》《相见欢》等。",
    },
    25: {
        "author_bio": "王湾，盛唐诗人，存诗仅约十首，以《次北固山下》最负盛名。“海日生残夜，江春入旧年”历来为人称道。",
    },
    7: {
        "background": "杜甫寓居成都草堂期间，春日凭窗远眺，写下这首明丽轻快的写景诗，表达对闲适宁静生活的喜悦。",
    },
    28: {
        "background": "杜甫青年时期（约二十四岁）漫游齐鲁、登临泰山时所作，抒发对泰山的赞美与“会当凌绝顶”的豪情壮志。",
    },
    17: {
        "background": "苏轼改贬汝州途中游庐山（西林寺）时所作，借观山写“当局者迷”的哲理。",
    },
    33: {
        "background": "苏轼任密州知州时（1076年）中秋夜所作，望月怀人，思念弟弟苏辙，兼含人生哲思。",
    },
    47: {
        "background": "辛弃疾任镇江知府期间（约1205年前后），登京口北固亭怀古，借史抒怀、寄托抗金壮志。",
    },
    14: {
        "background": "李白在黄鹤楼送别好友孟浩然东下扬州（广陵）时所作，抒发依依惜别之情。",
        "author_bio": "李白，唐代伟大的浪漫主义诗人，被尊为“诗仙”。代表作有《将进酒》《蜀道难》等。",
    },
    # 体裁修正（注意：与下文作者小传合并到同一 id，避免重复键覆盖）
    13: {"form": "七言绝句"},
    30: {"form": "七言律诗"},
    34: {"form": "词"},
    40: {"form": "五言古诗"},
    45: {"form": "五言律诗"},
    # 风格标签修正（P1）
    1:  {"author_bio": "李白，唐代伟大的浪漫主义诗人，被尊为“诗仙”。其诗想象雄奇、飘逸奔放。代表作有《将进酒》《蜀道难》《静夜思》等。"},
    6:  {"author_bio": "李白，唐代伟大的浪漫主义诗人，被尊为“诗仙”。其诗想象丰富、意境开阔。代表作有《将进酒》《蜀道难》等。"},
    15: {"author_bio": "李白，唐代伟大的浪漫主义诗人，有“诗仙”之称。其诗想象丰富、意境开阔、语言明快。代表作有《将进酒》《蜀道难》等。"},
    24: {"author_bio": "李白，唐代伟大的浪漫主义诗人，被尊为“诗仙”。代表作有《将进酒》《蜀道难》等。"},
    41: {"author_bio": "李白，唐代伟大的浪漫主义诗人，被尊为“诗仙”。代表作有《将进酒》《蜀道难》等。"},
    42: {"author_bio": "李白，唐代伟大的浪漫主义诗人，被尊为“诗仙”。代表作有《将进酒》《蜀道难》等。"},
    5:  {"author_bio": "王之涣，盛唐边塞诗人，诗风雄浑壮阔。代表作有《登鹳雀楼》《凉州词》等。"},
    12: {"author_bio": "王之涣，盛唐边塞诗人，诗风雄浑壮阔。代表作有《登鹳雀楼》《凉州词》等。"},
    10: {"author_bio": "贺知章，盛唐诗人，“吴中四士”之一，诗风清新自然、旷达风趣。代表作有《咏柳》《回乡偶书》等。"},
    11: {"author_bio": "王昌龄，盛唐边塞诗人，被誉为“七绝圣手”，边塞诗雄浑豪迈、意境深远。代表作有《出塞》《从军行》等。"},
    19: {"author_bio": "王昌龄，盛唐边塞诗人，被誉为“七绝圣手”。代表作有《出塞》《从军行》等。"},
    20: {"author_bio": "王昌龄，盛唐边塞诗人，被誉为“七绝圣手”，诗风雄浑豪迈。代表作有《出塞》《从军行》等。"},
    3:  {"author_bio": "骆宾王，“初唐四杰”之一，七岁能诗。其诗清新刚健。代表作有《咏鹅》《于易水送人》《在狱咏蝉》等。"},
    23: {"author_bio": "曹操，东汉末年政治家、军事家、文学家，建安文学代表人物，诗风慷慨悲凉。代表作有《观沧海》《短歌行》《龟虽寿》等。", "form": "四言古诗"},
    39: {"author_bio": "曹操，东汉末年政治家、军事家、文学家，建安文学代表人物，诗风慷慨悲凉。代表作有《短歌行》《观沧海》《龟虽寿》等。"},
    18: {"author_bio": "杨万里，南宋“中兴四大诗人”之一，创“诚斋体”，诗风清新自然、活泼灵动。代表作有《小池》《晓出净慈寺送林子方》等。"},
    27: {"author_bio": "崔颢，盛唐诗人，其《黄鹤楼》被后人誉为“唐人七律第一”。代表作有《黄鹤楼》《长干行》等。", "form": "七言律诗"},
    37: {"author_bio": "马致远，元代散曲家、杂剧家，“元曲四大家”之一，被誉为“秋思之祖”。代表作有散曲《天净沙·秋思》、杂剧《汉宫秋》等。", "form": "散曲"},
    38: {"author_bio": "龚自珍，晚清思想家、文学家，诗风雄奇瑰丽、感慨深沉。代表作有《己亥杂诗》组诗等。"},
    43: {"author_bio": "杜甫（712—770），唐代伟大的现实主义诗人，被尊为“诗圣”，其诗风格沉郁顿挫。代表作有《春望》《登高》《蜀相》等。"},
}

# ---------- 注释子串替换（id -> [(旧子串, 新子串)]）----------
NOTES_SUB = {
    1:  [("月：月亮；光：光线；霜：霜冻；举：抬起；望：看；思：思念；故乡：家乡",
          "疑：好像、仿佛；举：抬起；望：看；思：思念；故乡：家乡")],
    28: [("决眦：眼泪", "决眦：眼角（几乎）裂开，形容极力睁大眼睛远望")],
    36: [("四周星：指四周的星星，比喻战乱", "四周星：四周年（岁星运行一周即一年）")],
    35: [("五十弦：琵琶", "五十弦：瑟（传说五十根弦的古乐器）")],
    39: [("青青：指颜色鲜艳，这里指年轻", "青青：青色衣领；“青青子衿”化用《诗经》，代指贤才")],
    41: [("回日：太阳", "六龙回日：传说羲和驾六龙载日车，蜀山高险，日车至此也回转")],
}

# ---------- 应用整字段覆盖 ----------
changed_fields = []
for pid, kv in FIELD.items():
    p = by_id[pid]
    for k, v in kv.items():
        old = p.get(k)
        if old != v:
            p[k] = v
            changed_fields.append((pid, p.get("title", ""), k, old, v))

# ---------- 应用注释子串替换 ----------
changed_notes = []
for pid, subs in NOTES_SUB.items():
    p = by_id[pid]
    notes = p.get("notes", "")
    for old_sub, new_sub in subs:
        if old_sub in notes:
            notes = notes.replace(old_sub, new_sub)
            changed_notes.append((pid, p.get("title", ""), old_sub[:12], new_sub[:12]))
        else:
            print(f"[警告] id={pid}《{p.get('title','')}》未找到注释子串：{old_sub[:20]}")
    p["notes"] = notes

print("=== 整字段修正 ===")
for pid, title, k, old, new in changed_fields:
    print(f"《{title}》.{k}: {old[:18]} → {new[:18]}")

print("\n=== 注释修正 ===")
for pid, title, old, new in changed_notes:
    print(f"《{title}》.notes: {old} → {new}")

print(f"\n共修正整字段 {len(changed_fields)} 处，注释 {len(changed_notes)} 处")

# ---------- 写回 poems-data.js ----------
def js_repr(o, level=0):
    pad = "  " * level
    if isinstance(o, dict):
        items = [pad + "  " + repr(k) + ": " + js_repr(v, level + 1) for k, v in o.items()]
        return "{\n" + ",\n".join(items) + "\n" + pad + "}"
    if isinstance(o, list):
        if not o:
            return "[]"
        return "[\n" + ",\n".join(pad + "  " + js_repr(v, level + 1) for v in o) + "\n" + pad + "]"
    if isinstance(o, str):
        return json.dumps(o, ensure_ascii=False)
    if isinstance(o, bool):
        return "true" if o else "false"
    if o is None:
        return "null"
    if isinstance(o, (int, float)):
        return str(o)
    return "null"

js_arr = js_repr(poems)
new_src = f"""/**
 * 古调新弹 · 诗词库数据（v2.1 - 含结构化赏析，已校审）
 * 50 首 · 译文 / 注释 / 赏析 / 背景 / 作者小传 / 体裁
 * 校审：2026-10-11 修正作者错标、代表作张冠李戴、史实错误、体裁错误、
 *       「豪放派」风格标签误用、注释错释（详见 docs/诗词库内容校审清单-2026-10-11.md）
 * 学段：xiaoxue 小学 22 首 / chuzhong 初中 16 首 / gaozhong 高中 12 首
 */
const POEMS = {js_arr};

const GRADE_LABEL = {{ xiaoxue: "小学", chuzhong: "初中", gaozhong: "高中" }};
if (typeof module !== "undefined") {{ module.exports = {{ POEMS, GRADE_LABEL }}; }}
"""

with open(JS_OUT, "w", encoding="utf-8") as f:
    f.write(new_src)
print(f"\n已写入 {JS_OUT}（{os.path.getsize(JS_OUT)/1024:.1f} KB）")

# ---------- 写回知识库 poems_data.json ----------
KEEP = ["title", "author", "dynasty", "grade", "theme", "lines", "famous",
        "translation", "notes", "appreciation", "background", "author_bio",
        "form", "lesson"]
kb = [{k: p.get(k) for k in KEEP if p.get(k) is not None} for p in poems]
with open(KB_OUT, "w", encoding="utf-8") as f:
    json.dump(kb, f, ensure_ascii=False, separators=(",", ":"))
print(f"已写入 {KB_OUT}（{os.path.getsize(KB_OUT)/1024:.1f} KB，{len(kb)} 首）")
