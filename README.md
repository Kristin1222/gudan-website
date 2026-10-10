# 古调新弹 · 三期网站（开发仓库）

## 仓库与线上地址

- 代码仓库：<https://github.com/Kristin1222/gudan-website>（私有，成员由仓库主邀请协作者后可访问）
- 线上地址（均已部署）：
  - 首页：<https://gudiaoxintan-d6gcb88dxc336fac5-1503325630.tcloudbaseapp.com/>
  - 诗词库：<https://gudiaoxintan-d6gcb88dxc336fac5-1503325630.tcloudbaseapp.com/poems.html>
  - 数字导师：<https://gudiaoxintan-d6gcb88dxc336fac5-1503325630.tcloudbaseapp.com/tutor.html>
- 环境 ID：`gudiaoxintan-d6gcb88dxc336fac5`（上海 · 体验版，有效期至 2027-04-10）
- 当前状态（2026-10-10）：首页、诗词库、数字导师三页 + chat 云函数全部就绪，**50 首诗全部配齐结构化赏析（译文/注释/赏析/背景/作者/体裁）**，由智谱 GLM-4-Flash 批量生成初稿（仍有少量需人工校审）。数字导师走 智谱 GLM-4-Flash → 兜底 demo 三级链路。

### 新成员开工三步

```bash
# 1. 克隆（校园网下 GitHub 连接不稳定时需自备代理）
git clone https://github.com/Kristin1222/gudan-website.git

# 2. 安装 CLI（需 Node.js ≥ 18；内容线成员可跳过）
npm install -g @cloudbase/cli

# 3. 登录并验证
tcb login
tcb env:list
```

> 部署权限仅限项目负责人（环境归属其腾讯云账号）；其他成员改代码 → 提 PR 或由负责人统一部署。

## 目录结构

```
frontend/            前端页面（静态托管根目录）
  index.html         首页
  css/common.css     全站公共样式（二期茶褐色板 CSS 变量）
  js/common.js       公共脚本（滚动渐显/导航高亮/统一请求封装）
cloudfunctions/
  chat/              数字导师云函数（骨架，第 4 周填 AI 逻辑）
data/
  poems_template.csv 50 首诗词数据模板（内容线按此格式填写）
cloudbaserc.json     CloudBase 部署配置
```

## 常用命令（在 `三期开发/` 目录下执行）

```bash
# 部署前端（改了 frontend/ 里任何文件后执行）
tcb hosting deploy ./frontend / -e gudiaoxintan-d6gcb88dxc336fac5

# 部署 chat 云函数（待 AI 逻辑写完后）
tcb fn deploy chat -e gudiaoxintan-d6gcb88dxc336fac5

# 查看托管文件列表
tcb hosting list / -e gudiaoxintan-d6gcb88dxc336fac5

# 首次使用需登录（浏览器授权一次即可）
tcb login
```

> 团队成员安装 CLI：`npm install -g @cloudbase/cli`（需 Node.js ≥ 18）
> 改完页面 5 分钟内 CDN 未刷新属正常，用无痕窗口验证。

## 开发约定（详见《分页面设计报告》与《开发执行指引》）

1. 视觉规范冻结：沿用二期茶褐体系（色板变量在 `frontend/css/common.css`），禁止引入第二套组件库
2. 密钥一律存云函数环境变量，严禁写进前端代码或本仓库
3. 每周五 main 分支必须有一个可打开演示的版本
4. AI 限额计数在服务端（user_quota 集合），前端只做提示

## 里程碑

- M1（11 月中）：公共 4 页 + 数字导师 + RAG 诗词库跑通
- M2（12 月底）：意境生成 + 教师端三页
