// 用本机 CLI 凭证直接调用【线上】chat 云函数，验证 v2.0 是否真的部署生效
const fs = require('fs');
const path = require('path');

const auth = JSON.parse(fs.readFileSync(
  'C:\\Users\\86593\\.config\\.cloudbase\\auth.json', 'utf8')).credential;
const cred = {
  secretId: auth.tmpSecretId,
  secretKey: auth.tmpSecretKey,
  sessionToken: auth.tmpToken, // 临时密钥的 sessionToken
};

const cloud = require('@cloudbase/node-sdk');
const app = cloud.init({
  env: 'gudiaoxintan-d6gcb88dxc336fac5',
  ...cred,
});

async function call(name, data) {
  const t0 = Date.now();
  const res = await app.callFunction({ name: 'chat', data });
  const ms = Date.now() - t0;
  const r = res.result;
  console.log('\n===== ' + name + ' (' + ms + 'ms) =====');
  console.log('code:', r.code, '| aiMode:', r.data && r.data.mode, '| agent:', r.data && r.data.agent);
  if (r.data) console.log('回复:\n' + r.data.reply);
  if (r.data && r.data.source) console.log('来源:', r.data.source);
  if (r.msg) console.log('msg:', r.msg);
}

(async () => {
  // 探针 1：推荐模式（v1.3 会忽略 mode，回复无目录；v2.0 会推荐目录内篇目）
  await call('线上探针·推荐模式', {
    message: '我是初中生，喜欢边塞诗，推荐几首',
    mode: 'recommend', agent: 'xiaodan', grade: 'chuzhong',
  });

  // 探针 2：李白智能体（v1.3 会忽略 agent，以小弹口吻；v2.0 以李白第一人称）
  await call('线上探针·李白智能体', {
    message: '阁下尊姓大名？',
    mode: 'qa', agent: 'libai', grade: 'gaozhong',
  });
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
