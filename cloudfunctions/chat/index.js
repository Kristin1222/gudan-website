/**
 * 古调新弹 · 数字导师 chat 云函数（v1.2 · CloudBase 内置 AI）
 * ------------------------------------------------------
 * 流程：限额检查 → 结构化检索诗词 → 组装提示词 → 调内置 AI → 留痕 → 返回
 * 部署：tcb fn deploy chat -e gudiaoxintan-d6gcb88dxc336fac5 --force --deployMode zip
 * 流程：限额检查 → 结构化检索诗词 → 组装提示词 → 调内置 AI → 留痕 → 返回
 * 部署：tcb fn deploy chat -e gudiaoxintan-d6gcb88dxc336fac5
 *
 * AI 调用：优先使用 CloudBase 内置 AI（app.ai()），无需 API Key，
 *        从环境资源点直接抵扣 Token；如未开通 AI+ 能力，自动进入【演示模式】：
 *        基于检索结果生成确定性回答，链路仍可完整演示。
 *
 * 数据：优先读数据库 poems 集合；集合为空时回退到内置 8 首示例数据，
 *      因此部署后无需先导数据即可联调。
 *
 * 统一响应：{ code: 0, data: {...}, msg: '' }（前端 common.js 依赖此约定）
 */

const cloud = require('@cloudbase/node-sdk');

const app = cloud.init({
  env: cloud.SYMBOL_CURRENT_ENV,
  timeout: 60000, // AI 生成可能较慢，建议 ≥60s
});
const db = app.database();
const _ = db.command;

const DAILY_LIMIT = { guest: 3, student: 20, teacher: 50 };
const AI_MODEL = process.env.AI_MODEL || 'hunyuan-2.0-instruct-20251111';

// ---------- 内置示例数据（DB 为空时的回退，保证冷启动可演示） ----------
const BUILTIN_POEMS = [
  { title: '静夜思', author: '李白', dynasty: '唐', grade: 'xiaoxue', theme: '思乡',
    lines: ['床前明月光，疑是地上霜。', '举头望明月，低头思故乡。'],
    famous: '举头望明月，低头思故乡', notes: '疑：好像。思故乡：思念家乡。', lesson: false },
  { title: '望岳', author: '杜甫', dynasty: '唐', grade: 'chuzhong', theme: '哲理',
    lines: ['岱宗夫如何？齐鲁青未了。', '造化钟神秀，阴阳割昏晓。', '荡胸生曾云，决眦入归鸟。', '会当凌绝顶，一览众山小。'],
    famous: '会当凌绝顶，一览众山小', notes: '岱宗：泰山。钟：聚集。割：分。', lesson: false },
  { title: '黄鹤楼送孟浩然之广陵', author: '李白', dynasty: '唐', grade: 'xiaoxue', theme: '送别',
    lines: ['故人西辞黄鹤楼，烟花三月下扬州。', '孤帆远影碧空尽，唯见长江天际流。'],
    famous: '孤帆远影碧空尽，唯见长江天际流', notes: '西辞：向西告别。烟花：柳絮如烟、繁花似锦的春景。', lesson: true },
  { title: '从军行（其四）', author: '王昌龄', dynasty: '唐', grade: 'xiaoxue', theme: '边塞',
    lines: ['青海长云暗雪山，孤城遥望玉门关。', '黄沙百战穿金甲，不破楼兰终不还。'],
    famous: '黄沙百战穿金甲，不破楼兰终不还', notes: '穿金甲：磨穿了铁甲。楼兰：西域古国，代指敌人。', lesson: true },
  { title: '观沧海', author: '曹操', dynasty: '汉末', grade: 'chuzhong', theme: '山水田园',
    lines: ['东临碣石，以观沧海。', '水何澹澹，山岛竦峙。', '树木丛生，百草丰茂。', '秋风萧瑟，洪波涌起。',
      '日月之行，若出其中；', '星汉灿烂，若出其里。', '幸甚至哉，歌以咏志。'],
    famous: '日月之行，若出其中；星汉灿烂，若出其里', notes: '澹澹：水波荡漾。竦峙：高高地挺立。', lesson: true },
  { title: '如梦令·昨夜雨疏风骤', author: '李清照', dynasty: '宋', grade: 'chuzhong', theme: '季节',
    lines: ['昨夜雨疏风骤，浓睡不消残酒。', '试问卷帘人，却道海棠依旧。', '知否，知否？应是绿肥红瘦。'],
    famous: '知否，知否？应是绿肥红瘦', notes: '绿肥红瘦：绿叶繁茂、红花凋零。', lesson: true },
  { title: '将进酒', author: '李白', dynasty: '唐', grade: 'gaozhong', theme: '哲理',
    lines: ['君不见黄河之水天上来，奔流到海不复回。', '君不见高堂明镜悲白发，朝如青丝暮成雪。',
      '人生得意须尽欢，莫使金樽空对月。', '天生我材必有用，千金散尽还复来。'],
    famous: '天生我材必有用，千金散尽还复来', notes: '金樽：酒杯。材：才能。', lesson: true },
  { title: '锦瑟', author: '李商隐', dynasty: '唐', grade: 'gaozhong', theme: '爱情',
    lines: ['锦瑟无端五十弦，一弦一柱思华年。', '庄生晓梦迷蝴蝶，望帝春心托杜鹃。',
      '沧海月明珠有泪，蓝田日暖玉生烟。', '此情可待成追忆，只是当时已惘然。'],
    famous: '此情可待成追忆，只是当时已惘然', notes: '无端：无缘无故。思华年：追忆青春年华。', lesson: true }
];

const GRADE_LABEL = { xiaoxue: '小学', chuzhong: '初中', gaozhong: '高中' };

// ---------- 工具 ----------
function ok(data) { return { code: 0, data, msg: '' }; }
function fail(code, msg) { return { code, data: null, msg }; }
function today() { return new Date().toISOString().slice(0, 10); }

// ---------- 第一步：限额检查（user_quota 集合，按 userId/IP 原子计数） ----------
async function checkQuota(role, userId, clientIp) {
  const limit = DAILY_LIMIT[role] !== undefined ? DAILY_LIMIT[role] : DAILY_LIMIT.guest;
  const key = userId || ('ip:' + (clientIp || 'unknown'));

  try {
    const col = db.collection('user_quota');
    const docId = encodeURIComponent(key).replace(/[.$/]/g, '_');
    const res = await col.doc(docId).get().catch(() => ({ data: [] }));
    const doc = res.data && res.data[0];
    const t = today();

    if (!doc) {
      await col.doc(docId).set({ key, date: t, used: 1 });
      return { limit, used: 1 };
    }
    if (doc.date !== t) { // 跨天清零
      await col.doc(docId).set({ key, date: t, used: 1 });
      return { limit, used: 1 };
    }
    if (doc.used >= limit) return fail(402, '今日额度已用完（' + limit + ' 次/日），明天再来吧');
    await col.doc(docId).update({ used: _.inc(1) });
    return { limit, used: doc.used + 1 };
  } catch (e) {
    // 限额集合异常时不阻断问答，但记录日志
    console.warn('[quota] 限额检查失败（放行）：', e.message);
    return { limit, used: -1 };
  }
}

// ---------- 第二步：结构化检索（诗名/作者/名句 三路匹配，不用向量库） ----------
function scoreMatch(q, p) {
  let score = 0;
  const plain = p.title.replace(/[（(].*?[)）]/g, ''); // 去掉"（其四）"之类
  if (q.indexOf(plain) >= 0 || plain.indexOf(q) >= 0) score += 10;
  if (q.indexOf(p.author) >= 0) score += 5;
  if (q.indexOf(p.famous) >= 0 || p.famous.indexOf(q) >= 0) score += 8;
  // 名句片段匹配（问句里出现连续 4 字以上的名句片段）
  const fam = p.famous.replace(/[，。？！；：、\s]/g, '');
  const q2 = q.replace(/[，。？！；：、\s]/g, '');
  for (let i = 0; i + 4 <= q2.length; i++) {
    if (fam.indexOf(q2.slice(i, i + 4)) >= 0) { score += 4; break; }
  }
  return score;
}

async function retrievePoem(question) {
  // 1) 先查数据库（若集合有数据）
  try {
    const res = await db.collection('poems').limit(100).get();
    const list = (res.data || []).map(function (d) {
      return { title: d.title, author: d.author, dynasty: d.dynasty, grade: d.grade,
        theme: d.theme, lines: (d.lines || (d.originalText ? d.originalText.split('|') : [])),
        famous: d.famous, notes: d.notes, translation: d.translation, appreciation: d.appreciation,
        examPoints: d.examPoints, lesson: d.lesson };
    });
    if (list.length) {
      let best = null, bestScore = 0;
      list.forEach(function (p) {
        const s = scoreMatch(question, p);
        if (s > bestScore) { bestScore = s; best = p; }
      });
      if (best && bestScore >= 4) return best;
      return null;
    }
  } catch (e) { /* 集合不存在或无权限 → 走内置数据 */ }

  // 2) 回退：内置数据
  let best = null, bestScore = 0;
  BUILTIN_POEMS.forEach(function (p) {
    const s = scoreMatch(question, p);
    if (s > bestScore) { bestScore = s; best = p; }
  });
  return best && bestScore >= 4 ? best : null;
}

// ---------- 第三步：组装系统提示词 ----------
function buildSystemPrompt(poem, role, grade, func) {
  const gradeHint = {
    xiaoxue: '面向小学生：多讲画面感，语言简单生动。',
    chuzhong: '面向初中生：讲清情感与表现手法。',
    gaozhong: '面向高中生：深入炼字、章法与格律。',
  }[grade || 'chuzhong'];

  const funcHint = {
    qa: '当前是【答疑解惑】模式：针对作者、背景、释义、赏析、格律等问题给出专业解答。',
    knowledge: '当前是【知识点讲解】模式：系统讲解表现手法、文学常识，帮助学生构建知识体系。',
    creation: '当前是【创作指导】模式：点评学生的诗词创作，给出具体修改建议。',
    planning: '当前是【学习规划】模式：根据学生基础与目标给出个性化学习计划。',
  }[func || 'qa'];

  const base = [
    '你是"古调新弹"平台的数字导师，帮助中小学师生学习古诗词。',
    '回答不超过200字，语气亲切。' + gradeHint + funcHint,
    '涉及诗词原文、作者、注释、赏析时，只能依据下面提供的诗词资料回答；',
    '资料里没有的内容就明确说"平台暂未收录该内容"，不得编造诗词或作者。',
  ].join('');

  if (!poem) return base + '\n（本次未检索到相关诗词资料，若学生问的是具体诗词，请引导其在诗词库中查找已收录篇目。）';

  const material = [
    '【诗词资料】',
    '诗名：' + poem.title + '　作者：' + poem.author + '（' + (poem.dynasty || '') + '）　学段：' + (GRADE_LABEL[poem.grade] || poem.grade || '') + '　主题：' + (poem.theme || ''),
    '原文：' + (poem.lines || []).join('／'),
    '注释：' + (poem.notes || '（无）'),
    '译文：' + (poem.translation || '（无）'),
    '赏析：' + (poem.appreciation || '（无）'),
    '考点：' + (poem.examPoints || '（无）'),
    '回答涉及以上资料时，末尾另起一行附：依据：《' + poem.title + '》· 平台诗词库',
  ].join('\n');
  return base + '\n' + material;
}

// ---------- 第四步：调 CloudBase 内置 AI（失败时进入演示模式） ----------
async function callAI(systemPrompt, message) {
  // 1) 优先 CloudBase 内置 AI（不需要 API Key，从资源点扣 Token）
  try {
    const ai = app.ai();
    const model = ai.createModel('cloudbase');
    const result = await model.generateText({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
    });
    if (result && result.text) {
      return { reply: result.text, demo: false, source: 'ai' };
    }
    // 模型未返回内容，走兜底
    return { reply: null, demo: true, source: 'ai-empty', error: '模型未返回内容' };
  } catch (e) {
    console.warn('[ai] CloudBase 内置 AI 调用失败（进入演示模式）：', e.message);
    return { reply: null, demo: true, source: 'ai-error', error: e.message };
  }
}

// 演示模式：基于检索结果生成确定性回答（链路演示 / 结题演示用）
function demoReply(poem, question) {
  if (poem) {
    var lines = [];
    lines.push('【演示回复】关于《' + poem.title + '》——');
    lines.push('学段：' + (GRADE_LABEL[poem.grade] || '') + '  朝代：' + (poem.dynasty || '') + '  作者：' + poem.author + '  主题：' + (poem.theme || ''));
    lines.push('原文：' + (poem.lines || []).join(''));
    lines.push('名句：' + poem.famous + '。');
    if (poem.notes) lines.push('注释：' + poem.notes);
    if (poem.lesson) lines.push('配套：这首诗平台已收录 AIGC 微课，可在诗词库中观看。');
    lines.push('提示：在 CloudBase 控制台开通 AI+ 能力后，导师将生成更丰富的个性化讲解。');
    lines.push('依据：《' + poem.title + '》· 平台诗词库');
    return lines.join('\n');
  }
  return [
    '【演示回复】这个问题我需要更多上下文才能答好～',
    '1）在诗词库里找到想学的诗，点「问数字导师」；',
    '2）或者直接问我收录篇目中的内容，例如"《静夜思》的作者是谁""会当凌绝顶是什么意思"。',
    '提示：开通 AI+ 能力后即为完整 AI 问答。',
  ].join('\n');
}

// ---------- 第五步：留痕（chat_logs 集合，结题量化数据） ----------
async function saveMessage(userId, sessionId, question, reply, poemTitle, mode) {
  try {
    await db.collection('chat_logs').add({
      userId: userId || 'guest', sessionId: sessionId || '', question: question,
      reply: reply, poemTitle: poemTitle || '', mode: mode,
      createdAt: db.serverDate(),
    });
  } catch (e) { console.warn('[log] 留痕失败（不阻断）：', e.message); }
}

// ---------- 入口 ----------
exports.main = async (event, context) => {
  try {
    const body = typeof event === 'string' ? JSON.parse(event) : (event || {});
    const message = String(body.message || '').trim();
    const role = body.role || 'guest';
    const grade = body.grade || '';
    const func = body.func || 'qa';
    const userId = body.userId || '';
    const sessionId = body.sessionId || '';
    const clientIp = (context && context.headers && context.headers['x-forwarded-for']) || '';

    if (!message) return fail(400, '请输入问题');
    if (message.length > 300) return fail(400, '问题太长了，请精简到 300 字以内');

    const quota = await checkQuota(role, userId, clientIp);
    if (quota.code) return quota;

    const poem = await retrievePoem(message);
    const sys = buildSystemPrompt(poem, role, grade, func);
    const result = await callAI(sys, message);
    const reply = result.demo ? demoReply(poem, message) : (result.reply || '（模型未返回内容，请稍后重试）');

    await saveMessage(userId, sessionId, message, reply, poem && poem.title, result.demo ? 'demo' : 'ai');

    return ok({
      reply: reply,
      source: poem ? '《' + poem.title + '》· 平台诗词库' : '',
      mode: result.demo ? 'demo' : 'ai',
      aiSource: result.source, // 调试用：ai | ai-empty | ai-error
      quota: { used: quota.used, limit: quota.limit },
    });
  } catch (err) {
    console.error('[chat]', err);
    return fail(500, '导师暂时不在，请稍后重试');
  }
};
