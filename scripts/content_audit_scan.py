# -*- coding: utf-8 -*-
"""内容校审自动扫描：对 50 首结构化诗词内容做质量体检，输出风险排名"""
import json, re, sys, io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

SRC = r"F:\上外\比赛\大创\三期开发\data\poems_raw.json"

with open(SRC, 'r', encoding='utf-8') as f:
    poems = json.load(f)

print(f"共 {len(poems)} 首\n")

# 模板化/套话特征
BG_TEMPLATE = ['生活在', '当时社会', '当时朝政', '社会繁荣', '社会动荡', '仕途坎坷', '一生坎坷', '经历了', '亲眼目睹']
BIO_TEMPLATE = ['代表', '被誉为', '字', '号', '主要风格', '著名']
APPR_GENERIC = ['寓意深刻', '语言优美', '情感真挚', '表达了', '生动形象', '朗朗上口', '流传千古', '家喻户晓', '表达了作者的', '抒发了诗人', '表达了诗人']
BASIC_NOTES = set('床明月光举头望低头思故乡白日依山尽黄河入海流春眠不觉晓处处闻啼鸟')

def risk_count(p):
    r = []
    bg = p.get('background', '') or ''
    bio = p.get('author_bio', '') or ''
    ap = p.get('appreciation', '') or ''
    notes = p.get('notes', '') or ''
    trans = p.get('translation', '') or ''
    form = p.get('form', '') or ''

    # 空/缺字段
    if not bg: r.append('背景缺失')
    if not bio: r.append('小传缺失')
    if not ap: r.append('赏析缺失')
    if not trans: r.append('译文缺失')
    if not form: r.append('体裁缺失')
    if not notes: r.append('注释缺失')

    # 模板化背景
    bg_hits = [k for k in BG_TEMPLATE if k in bg]
    if bg_hits: r.append('背景模板化: ' + '、'.join(bg_hits))

    # 模板化小传
    bio_hits = [k for k in BIO_TEMPLATE if k in bio]
    if len(bio) < 30: r.append('小传过短(' + str(len(bio)) + '字)')
    if bio_hits and len(bio) < 45: r.append('小传模板化')

    # 赏析套话 + 过短
    ap_hits = [k for k in APPR_GENERIC if k in ap]
    if len(ap) < 60: r.append('赏析过短(' + str(len(ap)) + '字)')
    if ap_hits: r.append('赏析套话: ' + '、'.join(ap_hits[:2]))

    # 译文过短/过长
    orig_len = len(''.join(p.get('lines', [])))
    if trans and len(trans) < orig_len * 0.5: r.append('译文过短')
    if trans and len(trans) > orig_len * 2.5: r.append('译文过长')

    # 注释教学价值弱：全是基础字
    note_words = re.findall(r'([\u4e00-\u9fa5])：', notes)
    basic = sum(1 for w in note_words if w in BASIC_NOTES)
    if note_words and basic / len(note_words) >= 0.6:
        r.append('注释偏基础')

    return r, {'bg': bg, 'bio': bio, 'ap': ap, 'notes': notes, 'trans': trans, 'form': form}

rows = []
for p in poems:
    risks, detail = risk_count(p)
    score = len(risks)
    rows.append((score, p, risks, detail))

rows.sort(key=lambda x: -x[0])

print('=' * 70)
print('按风险数降序（风险越多越需校审）')
print('=' * 70)
for score, p, risks, detail in rows:
    if score == 0: continue
    title = p.get('title', '')
    author = p.get('author', '')
    grade = p.get('grade', '')
    print(f"\n[{score}项风险] 《{title}》 {author}（{grade}）")
    for r in risks:
        print(f"   · {r}")

print('\n\n' + '=' * 70)
print('零风险（暂无自动检出问题，仍需抽查）：')
print('=' * 70)
zero = [p for s, p, r, d in rows if s == 0]
print('、'.join(f"《{p.get('title','')}》" for p in zero))
