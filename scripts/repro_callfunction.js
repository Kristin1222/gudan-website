// 复现 tutor.html 前端完整链路：匿名登录 → callFunction
// 目的：拿到第一手真实报错，定位 403 EXCEED_AUTHORITY 的准确层级

// ---- 最小浏览器环境垫片（让纯浏览器版 SDK 能在 Node 里跑）----
if (typeof window === 'undefined') {
  global.window = global;
  global.self = global;
  global.localStorage = {
    _s: {},
    getItem(k) { return Object.prototype.hasOwnProperty.call(this._s, k) ? this._s[k] : null; },
    setItem(k, v) { this._s[k] = String(v); },
    removeItem(k) { delete this._s[k]; },
    clear() { this._s = {}; }
  };
  global.sessionStorage = Object.assign(Object.create(global.localStorage), { _s: {} });
  global.location = { origin: 'https://gudiaoxintan-d6gcb88dxc336fac5-1503325630.tcloudbaseapp.com', href: 'https://gudiaoxintan-d6gcb88dxc336fac5-1503325630.tcloudbaseapp.com/tutor.html', protocol: 'https:', host: 'gudiaoxintan-d6gcb88dxc336fac5-1503325630.tcloudbaseapp.com' };
  global.navigator = { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) NodeRepro', language: 'zh-CN' };
  global.document = {
    cookie: '',
    addEventListener() {},
    removeEventListener() {},
    createElement() { return { style: {}, setAttribute() {}, getElementsByTagName: () => [] }; },
    getElementsByTagName() { return []; },
    documentElement: { style: {} },
    head: {},
    body: {}
  };
}

const cloudbase = require('@cloudbase/js-sdk');

// ---- 抓包：包装 fetch，记录所有 SDK 网络请求的原始请求/响应 ----
const _fetch = global.fetch;
let reqSeq = 0;
global.fetch = async function (url, opts) {
  const id = ++reqSeq;
  const headers = {};
  if (opts && opts.headers) {
    for (const [k, v] of Object.entries(opts.headers)) { headers[k] = v; }
  }
  // 模拟浏览器带 Origin，观察安全域名校验行为
  headers['Origin'] = 'https://gudiaoxintan-d6gcb88dxc336fac5-1503325630.tcloudbaseapp.com';
  headers['Referer'] = 'https://gudiaoxintan-d6gcb88dxc336fac5-1503325630.tcloudbaseapp.com/tutor.html';
  if (opts && opts.headers) { opts.headers['Origin'] = headers['Origin']; opts.headers['Referer'] = headers['Referer']; }
  console.log(`\n>>> [${id}] ${opts && opts.method || 'GET'} ${url}`);
  if (opts && opts.body) console.log(`    body: ${String(opts.body).slice(0, 500)}`);
  const res = await _fetch.call(this, url, opts);
  const clone = res.clone();
  const text = await clone.text().catch(() => '(binary)');
  console.log(`<<< [${id}] HTTP ${res.status}`);
  console.log(`    resp: ${text.slice(0, 600)}`);
  return res;
};

const ENV_ID = 'gudiaoxintan-d6gcb88dxc336fac5';

(async () => {
  console.log('[1] 初始化 SDK...');
  const app = cloudbase.init({ env: ENV_ID });

  console.log('[2] 匿名登录...');
  try {
    const auth = app.auth({ persistence: 'local' });
    await auth.signInAnonymously();
    const state = auth.hasLoginState();
    console.log('    登录成功, uid =', state && state.user ? state.user.uid : '(unknown)');
  } catch (e) {
    console.error('    匿名登录失败:', e.code || '', e.message);
    process.exit(1);
  }

  console.log('[3] 调用 chat 云函数...');
  try {
    const res = await app.callFunction({
      name: 'chat',
      data: { message: '你好', mode: 'qa', messages: [] }
    });
    console.log('    调用成功!');
    console.log(JSON.stringify(res.result, null, 2).slice(0, 800));
  } catch (e) {
    console.error('    调用失败!');
    console.error('    code =', e.code);
    console.error('    message =', e.message);
    if (e.requestId) console.error('    requestId =', e.requestId);
    // 打印全部可枚举属性，不放过任何线索
    const dump = {};
    for (const k of Object.keys(e)) dump[k] = e[k];
    console.error('    完整错误对象:', JSON.stringify(dump, null, 2).slice(0, 2000));
  }
})().catch(e => { console.error('未捕获异常:', e); process.exit(1); });
