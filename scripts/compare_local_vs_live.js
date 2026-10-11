// 对比测试：本地跑 v2.1 代码 + 用 CLI 凭证查线上 DB poems 集合
process.env.GLM_API_KEY = process.env.GLM_API_KEY || '';
const path = require('path');
const fs = require('fs');

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
new Function('module', 'exports', 'require', 'process', 'console', src)(
  module_, module_.exports, localRequire, process, console);
const main = module_.exports.main;

(async () => {
  // 与线上失败的完全相同的问题
  const r = await main({ message: '《使至塞上》的作者是谁？', mode: 'qa', agent: 'xiaodan' });
  console.log('=== 本地 v2.1 同题对比 ===');
  console.log('source:', JSON.stringify(r.data && r.data.source));
  console.log('回复前120字:', (r.data && r.data.reply || '').slice(0, 120));
  console.log('KB 首条:', kbData[0] && kbData[0].title, '| KB 总数:', kbData.length);
  // 直接验证检索
  console.log('KB 中含使至塞上:', kbData.some(p => (p.title || '').indexOf('使至塞上') >= 0));
  console.log('KB 中含静夜思:', kbData.some(p => (p.title || '').indexOf('静夜思') >= 0));
})();
