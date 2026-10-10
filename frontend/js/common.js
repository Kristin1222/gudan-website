/* ============================================================
   古调新弹 · 全站公共脚本（common.js）
   所有页面在 </body> 前引入：css/common.css + js/common.js
   ============================================================ */

/* ---------- 滚动渐显（IntersectionObserver，二期同款效果） ---------- */
(function () {
  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  document.querySelectorAll('.scroll-reveal').forEach(function (el) {
    observer.observe(el);
  });
})();

/* ---------- 导航当前页高亮（按 pathname 或 data-page 匹配） ---------- */
(function () {
  var current = (document.body.dataset.page || location.pathname).toLowerCase();
  document.querySelectorAll('.site-nav .links a').forEach(function (a) {
    var target = (a.dataset.page || a.getAttribute('href') || '').toLowerCase();
    if (target && current.indexOf(target) > -1) {
      a.classList.add('active');
    }
  });
})();

/* ---------- 统一请求封装（对接云函数，12 页复用） ----------
   用法：GudanAPI.call('chat', { message: '床前明月光的作者是谁' })
        .then(function (res) { console.log(res.data); });
   约定云函数统一返回 { code: 0, data: ..., msg: '' }；
   code !== 0 时自动 toast msg。                                            */
var GudanAPI = (function () {
  // TODO(第1周)：部署后替换为 CloudBase 云函数访问地址（或 JS-SDK 调用）
  var BASE_URL = ''; // 例：https://xxxx.service.tcloudbase.com/chat

  function toast(msg) {
    var el = document.createElement('div');
    el.textContent = msg;
    el.style.cssText =
      'position:fixed;top:76px;left:50%;transform:translateX(-50%);' +
      'background:#C3272B;color:#fff;padding:8px 20px;border-radius:8px;' +
      'font-size:14px;z-index:999;';
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 2500);
  }

  function call(name, payload) {
    return fetch(BASE_URL.replace(/\/$/, '') + '/' + name, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {})
    })
      .then(function (res) { return res.json(); })
      .then(function (res) {
        if (res.code !== 0) {
          toast(res.msg || '请求失败，请重试');
          return Promise.reject(res);
        }
        return res;
      })
      .catch(function (err) {
        toast('网络异常，请检查网络后重试');
        return Promise.reject(err);
      });
  }

  return { call: call, toast: toast };
})();
