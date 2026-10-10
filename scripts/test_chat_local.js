// 本地验证 chat 云函数 v2.0 核心逻辑（stub 掉 CloudBase SDK，直连智谱）
const path = require('path');
const fs = require('fs');

// 用法：GLM_API_KEY=你的key node scripts/test_chat_local.js
if (!process.env.GLM_API_KEY) {
  console.error('请先设置环境变量 GLM_API_KEY');
  process.exit(1);
}

const src = fs.readFileSync(
  path.join(__dirname, '..', 'cloudfunctions', 'chat', 'index.js'), 'utf8');

const cloudStub = {
  init: () => ({
    database: () => ({
      command: { inc: (x) => x },
      collection: () => ({
        doc: () => ({ get: async () => ({ data: [] }), set: async () => {}, update: async () => {} }),
        limit: () => ({ get: async () => ({ data: [] }), add: async () => {} }),
      }),
      serverDate: () => new Date(),
    }),
    ai: () => ({ createModel: () => ({ generateText: async () => { throw new Error('AI+ not available'); } }) }),
  }),
  SYMBOL_CURRENT_ENV: 'test',
};

const kbData = require(path.join(__dirname, '..', 'cloudfunctions', 'chat', 'poems_data.json'));

function localRequire(m) {
  if (m === '@cloudbase/node-sdk') return cloudStub;
  if (m === './poems_data.json') return kbData;
  return null;
}

const module_ = { exports: {} };
// 沙箱执行：module/exports/require/process/console 均注入
const fn = new Function('module', 'exports', 'require', 'process', 'console', src);
fn(module_, module_.exports, localRequire, process, console);

const main = module_.exports.main;

async function test(name, data) {
  const t0 = Date.now();
  const r = await main(data);
  const ms = Date.now() - t0;
  console.log('\n===== ' + name + ' (' + ms + 'ms) =====');
  console.log('code:', r.code, '| aiMode:', r.data && r.data.mode, '| agent:', r.data && r.data.agent);
  if (r.data) console.log('回复:\n' + r.data.reply);
  if (r.data && r.data.source) console.log('来源:', r.data.source);
}

(async () => {
  await test('答疑：问静夜思"疑"字', {
    message: '《静夜思》里的"疑"字妙在哪里？', mode: 'qa', agent: 'xiaodan', grade: 'xiaoxue',
  });

  await test('答疑：多轮追问', {
    message: '那他的另一首送别诗呢？',
    messages: [
      { role: 'user', content: '《静夜思》的作者是谁？' },
      { role: 'assistant', content: '《静夜思》的作者是李白，唐代大诗人。' },
    ],
    mode: 'qa', agent: 'xiaodan', grade: 'xiaoxue',
  });

  await test('李白智能体', {
    message: '李白先生，您写诗时一般喝多少酒？', mode: 'qa', agent: 'libai', grade: 'gaozhong',
  });

  await test('个性化推荐（初中）', {
    message: '我喜欢边塞诗和历史，帮我推荐几首并做个学习计划', mode: 'recommend', agent: 'xiaodan', grade: 'chuzhong',
  });

  await test('创作辅助（杜甫点评习作）', {
    message: '我写了一句"秋风扫叶落满地"，帮我看哪里可以改',
    mode: 'creation', agent: 'dufu', grade: 'chuzhong',
  });
})().catch(e => { console.error('TEST FAIL:', e); process.exit(1); });
