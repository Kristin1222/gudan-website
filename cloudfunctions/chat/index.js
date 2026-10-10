/**
 * 古调新弹 · 数字导师 chat 云函数（骨架版 v0.1）
 * ------------------------------------------------------
 * 职责：限额检查 → 结构化检索诗词 → 组装提示词 → 调混元 → 留存记录 → 返回
 * 部署：tcb fn deploy chat -e <环境ID>
 * 密钥：HUNYUAN_API_KEY 只配置在云函数环境变量里，绝不写进代码/仓库
 *
 * 统一响应格式：{ code: 0, data: {...}, msg: '' }  （前端 common.js 依赖此约定）
 */

const cloud = require('@cloudbase/node-sdk');

const app = cloud.init({ env: cloud.SYMBOL_CURRENT_ENV });

// 混元 OpenAI 兼容接口（在云函数环境变量里配 HUNYUAN_API_KEY）
const HUNYUAN_URL = 'https://api.hunyuan.cloud.tencent.com/v1/chat/completions';

// 各角色每日限额（第5周正式接入 users 集合原子计数后由 DB 决定）
const DAILY_LIMIT = { guest: 3, student: 20, teacher: 50 };

// ---------- 工具：统一响应 ----------
function ok(data) { return { code: 0, data, msg: '' }; }
function fail(code, msg) { return { code, data: null, msg }; }

// ---------- 第一步：限额检查（骨架，第5周完成） ----------
async function checkQuota(role, userId) {
  // TODO(第5周)：
  // 1. guests 按 IP 计数（users 集合或缓存）
  // 2. 登录用户读 users.quotaDate / users.quotaUsed，跨天清零
  // 3. 超限返回 fail(402, '今日额度已用完，明日再来')
  return true;
}

// ---------- 第二步：结构化检索（不搞向量库，50首诗够用） ----------
async function retrievePoem(question) {
  const db = app.database();
  // TODO(第4周)：分词/正则抽出问题中的「诗名 / 作者 / 名句」后精确+模糊匹配
  // 示例（仅演示诗名匹配的写法）：
  const res = await db.collection('poems')
    .where(
      cloud.database().command.or([
        { title: db.RegExp({ regexp: question.slice(0, 10), options: 'i' }) },
        // { author: ... }, { famousLine: ... }
      ])
    )
    .limit(1)
    .get();
  return res.data && res.data[0] ? res.data[0] : null;
}

// ---------- 第三步：组装系统提示词 ----------
function buildSystemPrompt(poem, role, grade) {
  const gradeHint = {
    xiaoxue: '面向小学生：多讲画面感，语言简单生动。',
    chuzhong: '面向初中生：讲清情感与表现手法。',
    gaozhong: '面向高中生：深入炼字、章法与格律。',
  }[grade || 'chuzhong'];

  const base = [
    '你是"古调新弹"平台的数字导师，帮助中小学师生学习古诗词。',
    '回答不超过200字，语气亲切。' + gradeHint,
    '涉及诗词原文、作者、注释时，只能依据下面提供的诗词资料回答；',
    '资料里没有的内容就明确说"平台暂未收录该内容"，不得编造。',
  ].join('');

  if (!poem) return base + '\n（本次未检索到相关诗词资料。）';

  const material = [
    '【诗词资料】',
    `诗名：${poem.title}　作者：${poem.author}（${poem.dynasty || ''}）　学段：${poem.grade || ''}`,
    `原文：${(poem.lines || []).join('／')}`,
    `注释：${poem.notes || '（无）'}`,
    `译文：${poem.translation || '（无）'}`,
    `赏析：${poem.appreciation || '（无）'}`,
    `考点：${poem.examPoints || '（无）'}`,
    '回答涉及以上资料时，末尾附一行：依据：《' + poem.title + '》· 平台诗词库',
  ].join('\n');

  return base + '\n' + material;
}

// ---------- 第四步：调混元 ----------
async function callHunyuan(systemPrompt, history, message) {
  // TODO(第4周)：history 多轮上下文（从 chatMessages 取最近 6 条）
  const resp = await fetch(HUNYUAN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + process.env.HUNYUAN_API_KEY,
    },
    body: JSON.stringify({
      model: 'hunyuan-turbos-latest', // 按开通的模型名调整
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      max_tokens: 400, // 约束输出 ≤ 200 字
    }),
  });
  const data = await resp.json();
  const reply = data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content
    : '（模型未返回内容，请稍后重试）';
  return reply;
}

// ---------- 第五步：留存记录（结题数据留痕用） ----------
async function saveMessage(userId, sessionId, question, reply, poemTitle) {
  // TODO(第4周)：写 chatMessages 集合（role/question/reply/poemTitle/时间）
  // 每条记录都是结题"AI 对话总轮次"的量化数据，务必留存
}

// ---------- 入口 ----------
exports.main = async (event) => {
  try {
    const { message = '', role = 'guest', grade = '', userId = '', sessionId = '' } = event;

    if (!message.trim()) return fail(400, '请输入问题');

    const quotaOk = await checkQuota(role, userId);
    if (quotaOk !== true) return quotaOk;

    const poem = await retrievePoem(message);          // 结构化检索
    const sys = buildSystemPrompt(poem, role, grade);  // 提示词注入
    const reply = await callHunyuan(sys, [], message); // 调模型
    await saveMessage(userId, sessionId, message, reply, poem && poem.title);

    return ok({ reply, source: poem ? `${poem.title}·平台诗词库` : '' });
  } catch (err) {
    console.error('[chat]', err);
    return fail(500, '导师暂时不在，请稍后重试');
  }
};
