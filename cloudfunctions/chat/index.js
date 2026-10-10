/**
 * 古调新弹 · 数字导师 chat 云函数（v2.0 · 三模式 + 诗人智能体 + 多轮对话）
 * ----------------------------------------------------------------
 * 入参：
 *   message  string              本次提问（必填，≤300 字）
 *   messages [{role, content}]   历史对话（可选，取最近 10 条实现多轮上下文）
 *   mode     'qa' | 'recommend' | 'creation'
 *            qa        课程答疑助教：课内篇目答疑（字词/翻译/手法/情感/考点）
 *            recommend 个性化学习推荐：按学段/主题/兴趣推荐篇目并制定计划
 *            creation  创作辅助：点评习作、讲解格律意象、协助创作
 *   agent    'xiaodan' | 'libai' | 'dufu' | 'wangwei' | 'sushi' | 'liqingzhao' | 'xinqiji'
 *            诗人智能体：以该诗人第一人称风格对话
 *   grade / role / userId / sessionId  同 v1
 *
 * 知识库：内置 poems_data.json（50 首完整结构化数据），
 *        数据库 poems 集合若有数据则优先使用。
 *
 * AI 调用链（与 v1 相同）：
 *   ① GLM_API_KEY 存在 → 智谱 BigModel GLM-4-Flash（免费）
 *   ② CloudBase 内置 AI（app.ai()）
 *   ③ 全部失败 → 演示模式（基于检索的确定性回答）
 *
 * 部署：tcb fn deploy chat -e gudiaoxintan-d6gcb88dxc336fac5 --force
 *      （CLI 部署如遇缓存不更新，改用控制台上传 cloudfunctions/chat.zip）
 */

const cloud = require('@cloudbase/node-sdk');
const KB_POEMS = require('./poems_data.json');

const app = cloud.init({
  env: cloud.SYMBOL_CURRENT_ENV,
  timeout: 60000,
});
const db = app.database();
const _ = db.command;

const DAILY_LIMIT = { guest: 10, student: 30, teacher: 60 };
const AI_MODEL = process.env.AI_MODEL || 'hunyuan-2.0-instruct-20251111';
const HISTORY_MAX = 10; // 多轮上下文最多携带条数

const GRADE_LABEL = { xiaoxue: '小学', chuzhong: '初中', gaozhong: '高中' };

// ---------- 模式提示词 ----------
const MODE_PROMPTS = {
  qa: [
    '当前是【课程答疑助教】模式。',
    '职责：解答中小学语文课内古诗词问题，包括字词释义、句子翻译、表现手法、思想感情、文学常识与考点。',
    '要求：先给出直接答案，再展开讲解；讲解时引用原文关键句；小学初中问题避免过度引申。',
  ].join(''),
  recommend: [
    '当前是【个性化学习推荐】模式。',
    '职责：根据学生的学段、兴趣主题、近期学习内容，从下方【诗词库目录】中推荐篇目并给出学习建议。',
    '要求：每次推荐 2-4 首，说明推荐理由（一首一句话）；给出 3 天或 7 天的可执行学习安排；推荐的篇目必须来自【诗词库目录】，不得编造。',
  ].join(''),
  creation: [
    '当前是【创作辅助】模式。',
    '职责：辅导学生创作古体诗/近体诗/词。学生给出习作时：先肯定亮点，再逐句点评，指出格律（平仄、押韵、对仗）、意象、炼字方面的具体修改建议，并示范修改后的句子。',
    '要求：点评具体可操作，避免空泛表扬；学生没有习作时，可出题引导创作（给意象、定主题、限韵脚）。',
  ].join(''),
};

// ---------- 诗人智能体人设 ----------
const AGENT_PERSONAS = {
  xiaodan: null, // 通用导师，无人设覆盖
  libai: {
    name: '李白', title: '诗仙',
    persona: '你现在扮演李白（字太白，号青莲居士，盛唐浪漫主义"诗仙"，想象雄奇、豪放飘逸，代表作《将进酒》《蜀道难》《静夜思》《望庐山瀑布》）。',
    rule: '以李白第一人称（我/吾）对话，语言豪放洒脱、带盛唐气象与几分酒气，可自然吟出自己诗句；但涉及字词注释、考点等知识性内容必须准确，以平台资料为准。',
  },
  dufu: {
    name: '杜甫', title: '诗圣',
    persona: '你现在扮演杜甫（字子美，自号少陵野老，盛唐现实主义"诗圣"，沉郁顿挫、忧国忧民，代表作《春望》《登高》《望岳》《蜀相》）。',
    rule: '以杜甫第一人称对话，语言沉稳恳切，关心民间疾苦与学生学业；知识性内容以平台资料为准。',
  },
  wangwei: {
    name: '王维', title: '诗佛',
    persona: '你现在扮演王维（字摩诘，盛唐山水田园诗派代表，"诗中有画、画中有诗"，笃信佛教，代表作《山居秋暝》《使至塞上》《九月九日忆山东兄弟》）。',
    rule: '以王维第一人称对话，语言清淡自然、有画意与禅意；知识性内容以平台资料为准。',
  },
  sushi: {
    name: '苏轼', title: '东坡居士',
    persona: '你现在扮演苏轼（字子瞻，号东坡居士，北宋豪放派代表，诗词文书画俱佳，一生屡遭贬谪而旷达乐观，代表作《水调歌头·明月几时有》《念奴娇·赤壁怀古》《题西林壁》）。',
    rule: '以苏轼第一人称对话，语言机智旷达、带生活趣味与哲理；知识性内容以平台资料为准。',
  },
  liqingzhao: {
    name: '李清照', title: '易安居士',
    persona: '你现在扮演李清照（号易安居士，宋代婉约词宗，前期清新明快、后期凄婉深沉，代表作《如梦令·昨夜雨疏风骤》《声声慢·寻寻觅觅》）。',
    rule: '以李清照第一人称对话，语言细腻雅致、情感真挚；知识性内容以平台资料为准。',
  },
  xinqiji: {
    name: '辛弃疾', title: '词中之龙',
    persona: '你现在扮演辛弃疾（字幼安，号稼轩，南宋豪放爱国词人，文武双全而壮志难酬，代表作《破阵子·为陈同甫赋壮词以寄之》《永遇乐·京口北固亭怀古》）。',
    rule: '以辛弃疾第一人称对话，语言豪迈悲壮、心系家国；知识性内容以平台资料为准。',
  },
};

// ---------- 工具 ----------
function ok(data) { return { code: 0, data, msg: '' }; }
function fail(code, msg) { return { code, data: null, msg }; }
function today() { return new Date().toISOString().slice(0, 10); }

// ---------- 限额（user_quota 集合） ----------
async function checkQuota(role, userId, clientIp) {
  const limit = DAILY_LIMIT[role] !== undefined ? DAILY_LIMIT[role] : DAILY_LIMIT.guest;
  const key = userId || ('ip:' + (clientIp || 'unknown'));
  try {
    const col = db.collection('user_quota');
    const docId = encodeURIComponent(key).replace(/[.$/]/g, '_');
    const res = await col.doc(docId).get().catch(() => ({ data: [] }));
    const doc = res.data && res.data[0];
    const t = today();
    if (!doc || doc.date !== t) {
      await col.doc(docId).set({ key, date: t, used: 1 });
      return { limit, used: 1 };
    }
    if (doc.used >= limit) return fail(402, '今日额度已用完（' + limit + ' 次/日），明天再来吧');
    await col.doc(docId).update({ used: _.inc(1) });
    return { limit, used: doc.used + 1 };
  } catch (e) {
    console.warn('[quota] 限额检查失败（放行）：', e.message);
    return { limit, used: -1 };
  }
}

// ---------- 知识库获取（DB 优先，回退内置 50 首） ----------
async function getPoems() {
  try {
    const res = await db.collection('poems').limit(100).get();
    const list = (res.data || []).map(function (d) {
      return {
        title: d.title, author: d.author, dynasty: d.dynasty, grade: d.grade,
        theme: d.theme, lines: d.lines || (d.originalText ? d.originalText.split('|') : []),
        famous: d.famous, notes: d.notes, translation: d.translation,
        appreciation: d.appreciation, background: d.background,
        author_bio: d.author_bio, form: d.form, lesson: d.lesson,
      };
    });
    if (list.length) return list;
  } catch (e) { /* 集合不存在 → 内置知识库 */ }
  return KB_POEMS;
}

// ---------- 检索：诗名/作者/名句 三路匹配 ----------
function scoreMatch(q, p) {
  let score = 0;
  const plain = p.title.replace(/[（(].*?[)）]/g, '');
  if (q.indexOf(plain) >= 0 || plain.indexOf(q) >= 0) score += 10;
  if (q.indexOf(p.author) >= 0) score += 5;
  if (q.indexOf(p.famous) >= 0 || p.famous.indexOf(q) >= 0) score += 8;
  const fam = p.famous.replace(/[，。？！；：、\s]/g, '');
  const joined = (p.lines || []).join('').replace(/[，。？！；：、\s]/g, '');
  const q2 = q.replace(/[，。？！；：、\s]/g, '');
  for (let i = 0; i + 4 <= q2.length; i++) {
    const frag = q2.slice(i, i + 5);
    if (fam.indexOf(frag) >= 0) { score += 4; break; }
    if (joined.indexOf(frag) >= 0) { score += 6; break; }
  }
  return score;
}

function findBest(list, question) {
  let best = null, bestScore = 0;
  list.forEach(function (p) {
    const s = scoreMatch(question, p);
    if (s > bestScore) { bestScore = s; best = p; }
  });
  return bestScore >= 4 ? { poem: best, score: bestScore } : null;
}

// ---------- 组装系统提示词 ----------
function buildSystemPrompt(opts) {
  const { poem, poems, agentCtx, mode, agent, grade, catalog } = opts;

  const gradeHint = {
    xiaoxue: '面向小学生：多讲画面感，语言简单生动。',
    chuzhong: '面向初中生：讲清情感与表现手法。',
    gaozhong: '面向高中生：深入炼字、章法与格律。',
  }[grade || 'chuzhong'];

  const parts = [];
  parts.push('你是"古调新弹"平台的数字导师，帮助中小学师生学习古诗词。回答不超过 250 字，语气亲切。' + gradeHint);

  // 模式
  parts.push(MODE_PROMPTS[mode] || MODE_PROMPTS.qa);

  // 诗人智能体人设
  const persona = AGENT_PERSONAS[agent];
  if (persona) {
    parts.push(persona.persona + persona.rule);
  }

  // 忠实性要求
  parts.push('涉及具体诗词的原文、注释、译文、赏析时，优先依据下方提供的平台资料；资料没有的内容明确说"平台暂未收录该内容"，不得编造诗词或作者。');

  // 主检索诗词
  if (poem) {
    parts.push([
      '【本次问题相关诗词】',
      '诗名：' + poem.title + '　作者：' + poem.author + '（' + (poem.dynasty || '') + '）　学段：' + (GRADE_LABEL[poem.grade] || '') + '　主题：' + (poem.theme || '') + '　体裁：' + (poem.form || '不详'),
      '原文：' + (poem.lines || []).join('／'),
      '注释：' + (poem.notes || '（无）'),
      '译文：' + (poem.translation || '（无）'),
      '赏析：' + (poem.appreciation || '（无）'),
      '背景：' + (poem.background || '（无）'),
      '回答引用以上资料时，末尾另起一行附：依据：《' + poem.title + '》· 平台诗词库',
    ].join('\n'));
  }

  // 诗人智能体的代表作上下文（该作者在库中的全部篇目）
  if (agentCtx && agentCtx.length) {
    parts.push('【' + (persona ? persona.name : '') + '在平台诗词库中的收录篇目】\n' +
      agentCtx.map(function (p) {
        return '《' + p.title + '》（' + (GRADE_LABEL[p.grade] || '') + '·' + (p.theme || '') + '）：' + p.famous;
      }).join('\n'));
  }

  // 推荐模式：注入完整目录
  if (mode === 'recommend' && catalog) {
    parts.push('【诗词库目录】（推荐只能从这里选）\n' + catalog);
  }

  if (!poem && mode !== 'recommend' && !agentCtx) {
    parts.push('（本次未检索到相关诗词资料，若学生问的是具体诗词，引导其在诗词库中查找已收录篇目。）');
  }

  return parts.join('\n');
}

// ---------- 构建推荐目录（按学段分组，控制体积） ----------
function buildCatalog(poems, grade) {
  const want = grade ? poems.filter(function (p) { return p.grade === grade; }) : poems;
  const groups = {};
  want.forEach(function (p) {
    const g = GRADE_LABEL[p.grade] || p.grade || '其他';
    (groups[g] = groups[g] || []).push('《' + p.title + '》' + p.author + '（' + (p.theme || '') + '）');
  });
  return Object.keys(groups).map(function (g) {
    return g + '：' + groups[g].join('、');
  }).join('\n');
}

// ---------- 调 AI（GLM 优先 → 内置 AI → demo） ----------
async function callAI(systemPrompt, message, history) {
  const chat = (history || []).slice(-HISTORY_MAX)
    .filter(function (m) {
      return m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim();
    })
    .map(function (m) { return { role: m.role, content: m.content.slice(0, 500) }; });

  const messages = [{ role: 'system', content: systemPrompt }]
    .concat(chat)
    .concat([{ role: 'user', content: message }]);

  // 路径①：智谱 BigModel
  if (process.env.GLM_API_KEY) {
    try {
      const resp = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + process.env.GLM_API_KEY,
        },
        body: JSON.stringify({
          model: process.env.GLM_MODEL || 'glm-4-flash',
          messages: messages,
          max_tokens: 600,
          temperature: 0.75,
        }),
      });
      const data = await resp.json();
      const reply = data.choices && data.choices[0] && data.choices[0].message
        ? data.choices[0].message.content : null;
      if (reply) return { reply, demo: false, source: 'glm' };
      return { reply: null, demo: true, source: 'glm-empty', error: '模型未返回内容' };
    } catch (e) {
      console.warn('[ai] 智谱 GLM 调用失败（回退内置 AI）：', e.message);
    }
  }

  // 路径②：CloudBase 内置 AI
  try {
    const ai = app.ai();
    const model = ai.createModel('cloudbase');
    const result = await model.generateText({
      model: AI_MODEL,
      messages: messages,
    });
    if (result && result.text) return { reply: result.text, demo: false, source: 'cloudbase' };
    return { reply: null, demo: true, source: 'ai-empty', error: '模型未返回内容' };
  } catch (e) {
    console.warn('[ai] CloudBase 内置 AI 调用失败（进入演示模式）：', e.message);
    return { reply: null, demo: true, source: 'ai-error', error: e.message };
  }
}

// ---------- 演示模式（检索确定性回答，链路演示/结题兜底） ----------
function demoReply(mode, agent, poem, question, persona) {
  const head = persona
    ? '【演示回复·' + persona.name + '】'
    : '【演示回复】';

  if (mode === 'creation') {
    return [
      head + '创作辅助模式下，把你的习作发给我，我会逐句点评格律与意象。',
      '当前为演示模式：云端 AI 未连通，点评能力有限。',
      '也可以先试一句："帮我以"秋夜"为题，用五言绝句写一首诗"。',
    ].join('\n');
  }

  if (mode === 'recommend') {
    return [
      head + '个性化推荐演示：',
      '1）告诉我你的学段（小学/初中/高中）；',
      '2）说说你喜欢的主题，如"边塞""思乡""山水"；',
      '云端 AI 连通后，我会从 50 首必背篇目中挑 2-4 首并给出学习计划。',
    ].join('\n');
  }

  if (poem) {
    const lines = [];
    lines.push(head + '关于《' + poem.title + '》——');
    lines.push('学段：' + (GRADE_LABEL[poem.grade] || '') + '　朝代：' + (poem.dynasty || '') + '　作者：' + poem.author + '　主题：' + (poem.theme || ''));
    lines.push('原文：' + (poem.lines || []).join(''));
    if (poem.notes) lines.push('注释：' + poem.notes);
    if (poem.appreciation) lines.push('赏析：' + poem.appreciation);
    if (poem.lesson) lines.push('配套：这首诗已收录 AIGC 微课，可在诗词库观看。');
    lines.push('依据：《' + poem.title + '》· 平台诗词库');
    return lines.join('\n');
  }

  return [
    head + '换个问法试试～例如"《静夜思》的作者是谁""会当凌绝顶是什么意思"。',
    '云端 AI 连通后即为完整智能问答。',
  ].join('\n');
}

// ---------- 留痕（chat_logs） ----------
async function saveMessage(userId, sessionId, question, reply, poemTitle, mode, agent, aiMode) {
  try {
    await db.collection('chat_logs').add({
      userId: userId || 'guest', sessionId: sessionId || '',
      question: question, reply: reply,
      poemTitle: poemTitle || '', mode: mode, agent: agent, aiMode: aiMode,
      createdAt: db.serverDate(),
    });
  } catch (e) { console.warn('[log] 留痕失败（不阻断）：', e.message); }
}

// ---------- 入口 ----------
exports.main = async function (event) {
  try {
    const body = typeof event === 'string' ? JSON.parse(event) : (event || {});
    const message = String(body.message || '').trim();
    const mode = ['qa', 'recommend', 'creation'].indexOf(body.mode) >= 0 ? body.mode : 'qa';
    const agent = AGENT_PERSONAS[body.agent] ? body.agent : 'xiaodan';
    const role = body.role || 'guest';
    const grade = body.grade || '';
    const userId = body.userId || '';
    const sessionId = body.sessionId || '';
    const persona = AGENT_PERSONAS[agent];

    if (!message) return fail(400, '请输入问题');
    if (message.length > 300) return fail(400, '问题太长了，请精简到 300 字以内');

    const quota = await checkQuota(role, userId, '');
    if (quota.code) return quota;

    // 知识库与检索
    const poems = await getPoems();
    const hit = findBest(poems, message);
    let poem = hit ? hit.poem : null;
    // 诗人智能体：提问只出现作者名（弱匹配）时不强行关联单首，交给作者篇目上下文
    if (persona && poem && poem.author === persona.name && hit.score < 8) poem = null;
    // 诗人智能体：带出该作者在库中的全部篇目
    const agentCtx = persona
      ? poems.filter(function (p) { return p.author === persona.name; })
      : [];
    const catalog = mode === 'recommend' ? buildCatalog(poems, grade) : '';

    const sys = buildSystemPrompt({ poem, poems, agentCtx, mode, agent, grade, catalog });
    const result = await callAI(sys, message, body.messages);
    const reply = result.demo ? demoReply(mode, agent, poem, message, persona) : (result.reply || '（模型未返回内容，请稍后重试）');

    await saveMessage(userId, sessionId, message, reply, poem && poem.title, mode, agent, result.demo ? 'demo' : result.source);

    return ok({
      reply: reply,
      source: poem ? '《' + poem.title + '》· 平台诗词库' : '',
      mode: result.demo ? 'demo' : result.source,
      agent: agent,
      quota: { used: quota.used, limit: quota.limit },
    });
  } catch (err) {
    console.error('[chat]', err);
    return fail(500, '导师暂时不在，请稍后重试');
  }
};
