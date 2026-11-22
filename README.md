# Pyrocardian · 卡迪安

source and assets of the Cardian world。

登录网站，即进入卡牌世界：一切皆卡——角色卡、技能卡、单词卡、场景卡。

设计文档见 [docs/DESIGN.md](docs/DESIGN.md)。

## 技术栈

- `apps/web`：Vite + React + TypeScript 前端（小镇广场 / 收藏馆 / 图书馆 / 竞技场）
- `apps/server`：单个 Node 进程——Hono 提供 REST API，Colyseus 挂在同一 HTTP server 上提供 WebSocket 战斗房间（服务端权威），同时托管前端构建产物与卡图
- `packages/shared`：卡牌类型定义 + JSON 内容校验，前后端共用一份卡牌定义
- `packages/db`：better-sqlite3 访问 SQLite 单文件（WAL 模式），手写迁移
- `content/cards`：卡牌定义（JSON，数据驱动，改数值直接编辑）；`content/assets/cards`：卡图（文件名 = 卡牌 id，职业立绘为 `class_<职业id>.jpg`）

## 卡图管线

卡图统一为暖色奇幻 TCG 风格，由内置图像生成工具产出：

1. 为每个卡牌 id 生成一张图，把返回的下载链接 JSON 写入 `/tmp/gen/<card-id>.json`
2. 运行 `node scripts/download-art.mjs`，自动下载为 `content/assets/cards/<card-id>.jpg`
   （目标子目录可用 `OUT_SUBDIR=town` 指定，如小镇场景图存到 `content/assets/town/`）

新卡牌只要同名 jpg 放入该目录即可，前端自动按 id 加载（缺图时自动隐藏图片）。
世界页面素材：`content/assets/town/street.jpg`（广场全景）、`building_<id>.jpg`（建筑外景）、`interior_<id>.jpg`（建筑内部背景），建筑 id 为 arena/portal/forge/tavern/shop/library。

## 界面语言

支持中英双语：默认跟随浏览器语言，可在广场右上角手动切换（存于 localStorage）。
卡牌内容的英文字段为可选：职业 `nameEn`/`descriptionEn`，技能卡与召唤物 `nameEn`/`textEn`；缺省时回退到中文。
服务端错误以错误码（如 `auth.unauthorized`）返回，由客户端翻译。

## CI

GitHub Actions（`.github/workflows/ci.yml`）：push / PR 时自动跑 `npm ci`、`typecheck`、`build`，以及服务端冒烟测试（`scripts/smoke-test.mjs`，临时库 + 注册/鉴权/背单词全链路）。

## 本地开发

要求 Node.js >= 20。

```bash
npm install
npm run dev
```

- 前端：http://localhost:5173（`/api`、`/assets` 自动代理到 3000）
- 服务端：http://localhost:3000

## 生产部署（自己的服务器，无 root，单端口 IP 访问）

```bash
# 首次：服务器上没有 node 时，先用户态安装（解压到 ~/.local，按提示把 PATH 加进 ~/.bashrc）
bash scripts/setup-node.sh

# 把仓库放到服务器上后：
bash scripts/deploy.sh restart     # install + build + 后台启动，默认 0.0.0.0:12345
bash scripts/deploy.sh status      # 看是否健康
bash scripts/deploy.sh logs        # 看日志
bash scripts/deploy.sh stop        # 停止
```

- 只需开放一个端口（默认 `12345`），访问 `http://<服务器IP>:12345`；开发阶段无需域名/HTTPS。
- 可覆盖环境变量：`PORT=12345 HOST=0.0.0.0 DB_PATH=... bash scripts/deploy.sh restart`
- 单进程托管 API + 战斗房间 + 前端页面 + 卡图；数据库 `data/pyrocardian.db`，日志 `data/server.log`，PID `data/server.pid`。
- 备份：停止服务瞬间复制 `data/pyrocardian.db`（及同目录 `-wal` / `-shm`），或直接复制（WAL 模式下建议先停服务）。

手动部署（不用脚本）也可以：

```bash
npm ci
npm run build
PORT=12345 npm run start -w @pyrocardian/server
```

## 目录结构

```
apps/web         前端（Vite + React + TS）
apps/server      API + 战斗房间（Hono + Colyseus，单进程）
packages/shared  类型与卡牌校验
packages/db      SQLite 数据层
content/cards    卡牌 JSON（classes / skills / summons / words）
content/assets   卡图等静态资源
docs             设计文档
```
