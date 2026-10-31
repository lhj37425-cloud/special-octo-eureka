# AI 只读审计清单（部署前）

> 给协助部署的 AI 助手：拿到包后**先只读审计，不要直接执行部署**。
> 本文与 `部署/上线部署说明.md`、`部署/AI执行契约.md` 配套；数字以 `部署/部署事实.json` 为准。

## 0. 只读规则（先复述给操作者）

- 不修改、不删除、不移动任何文件；
- 不启动/停止服务，不运行 `certbot`，不改 DNS/Cloudflare；
- 不写 `data/`，不跑测试，不连生产数据库；
- 不把密码、Cookie、完整留言写进报告/日志/对话；
- 每步命令和输出保存到 `~/evol-deploy/部署日志/<日期时间>/`；
- 发现不一致或未知项：停止并报告，不要凭经验绕过。

## 1. 阅读顺序

1. `README.md`
2. `部署/部署事实.json`
3. `部署/上线部署说明.md`
4. `部署/AI执行契约.md`
5. `部署/演练记录.md`
6. `部署/上线后验证.sh`、`部署/预检.sh`
7. `上线验收报告.md`
8. `SHA256SUMS` 与两个 tar.gz

不要先读业务代码；部署阶段不需要改代码。

## 2. 包完整性审计

```bash
cd ~/evol-deploy
sha256sum -c SHA256SUMS
tar tzf evol-app-*.tar.gz | head -20
tar tzf evol-data-*.tar.gz | awk -F/ 'NF<=3'
tar xOzf evol-app-*.tar.gz 部署/部署事实.json | head -20
```

检查并报告：

- [ ] 两个包 SHA256 都 OK；
- [ ] app 包不含 `data/`、`node_modules/`、`.env`、密钥、`state.json`；
- [ ] data 包解开直接是 `admin-backend/`、`mvp-leads.json`，没有 `data/data/`；
- [ ] 事实文件 `release.tag` 与包名/手册一致；
- [ ] 包内 `部署/` 有手册、AI 契约、预检/验证脚本、事实文件、README；
- [ ] `.sh` 是 LF，不是 CRLF。

## 3. 数据快照审计

```bash
node -e "const s=require('./data/admin-backend/state.json');console.log('records',s.records.length,'users',s.users.length,'sessions',Object.keys(s.sessions||{}).length)"
node -e "const s=require('./data/admin-backend/state.json');const c={};for(const r of s.records)c[r.type]=(c[r.type]||0)+1;console.log(c)"
find ./data/admin-backend/uploads -type f | wc -l
node -e "JSON.parse(require('fs').readFileSync('./data/mvp-leads.json','utf8'))" && echo leads-json-ok
```

预期：记录 28、账号 1、会话 0、专家 13/课程 2/案例 6/资质 7、上传 67（交付数据包只带被引用文件）、留言合法 JSON。
任何数字不符 → 停止，报告。

## 4. 环境审计（只读命令）

```bash
cat /etc/os-release
node -v
nginx -v
certbot --version
df -h /srv
sudo ss -tlnp | grep -E ':80|:443|:4173|:4181'
dig +short www.evoldream.tech
dig +short evoldream.tech
```

检查并报告：

- [ ] OS 是 Debian 12 / Ubuntu 22.04+；
- [ ] Node ≥ 18（服务里 `/usr/bin/node` 必须存在）；
- [ ] Nginx/certbot 可用；
- [ ] `/srv` 空闲 ≥ 10GB；
- [ ] 80/443 是旧站还是空闲；4173/4181 必须空闲；
- [ ] DNS 是否指向本机；是否 Cloudflare 橙云；
- [ ] 是否已有证书；是否已有旧站/数据库/crontab；
- [ ] 主管理员密码是否由操作者单独持有。

## 5. 文档一致性审计

逐项核对并列出冲突：

- [ ] 手册步骤号是 S00–S12；`演练记录.md` 的步骤号是否一致；
- [ ] S03 预检提示是否写“进入 S04”，不是 S02；
- [ ] 预检必须 `sudo bash`，因为 `data/admin-backend` 是 700；
- [ ] 数据量：记录 28、上传 67（原始目录 78，其中 11 个未引用未打包）；
- [ ] 磁盘要求 ≥10GB；
- [ ] 证书流程：S06 HTTP-only + ACME challenge → S07 webroot → S08 正式配置；
- [ ] 已有站点分支是否覆盖备份/回滚；
- [ ] Cloudflare 分支是否覆盖 Full (Strict)、real_ip、证书签发；
- [ ] 备份命令是否排除 `data/admin-backend/backups`；
- [ ] 包内是否存在“免费测试站/Render/Replit”等与生产无关的内容（提醒操作者忽略）。

## 6. 脚本审计（先读，不要执行会写文件的命令）

- [ ] `预检.sh`：sudo、端口 4173/4181、记录类型、上传数、JSON、≥10GB；
- [ ] `上线后验证.sh`：三语首页、课程/专家/案例列表页、sitemap 完整性、404、HTTP→HTTPS、apex→www、安全头、后台资源、接口 401、healthz；
- [ ] `nginx.conf`：带 `add_header` 的块是否重写 5 个安全头；apex 是否跳 www；`/admin/` 是否 noindex；
- [ ] `server.js`：`/healthz` 是否读 state；`/sitemap.xml` 是否含 `courses/`、`teachers/`；
- [ ] `后台服务.cjs`：留言读写是否有跨进程锁；`restore()` 是否避免被 `pruneBackups` 删源。

发现问题只记录，不在审计阶段修改。

## 7. 风险分级与报告模板

输出《部署前审计报告》：

```text
一、结论：可以进入部署 / 需要先修 / 阻塞
二、包完整性：PASS/FAIL + 证据
三、数据快照：数字 + 是否符合事实文件
四、环境：OS/Node/Nginx/certbot/磁盘/端口/DNS/Cloudflare/证书/旧站
五、文档冲突：逐条列
六、脚本/配置风险：逐条列，标 P0/P1/P2
七、需要操作者确认：DNS、Cloudflare、证书、旧站、凭据、窗口
八、建议下一步：S00 / 先修某项 / 停止
```

## 8. 停止条件（命中即停）

- SHA256 FAILED；tag/commit/事实文件不一致；
- 数据数字、会话数不符；
- 4173/4181 已被占用；磁盘 <10GB；
- 服务器已有未备份的旧站/数据；
- DNS/Cloudflare/证书方式不明确；
- `initialized:false` 且准备开放公网；
- 预检 FAIL；
- 任何输出与手册预期不符；
- 操作者要求“先跳过验证试试”。

## 9. 可直接复制的提示词

```text
你是部署协助 AI。先只读审计，不修改任何文件，不启动/停止服务，不运行 certbot，
不改 DNS，不写 data/。

按顺序阅读：README.md → 部署/部署事实.json → 部署/上线部署说明.md
→ 部署/AI执行契约.md → 部署/演练记录.md → 部署/AI只读审计清单.md
→ 上线验收报告.md → SHA256SUMS。

按《AI只读审计清单》输出《部署前审计报告》，包含：
1) 包完整性（SHA256、顶层结构、tag/事实文件一致性）
2) 数据快照（记录/账号/会话/类型/上传/留言）
3) 环境（OS/Node/Nginx/certbot/磁盘/端口/DNS/Cloudflare/证书/旧站）
4) 文档冲突（步骤号、数字、路径、命令）
5) 风险与阻塞（P0/P1/P2）
6) 需要我人工确认的问题

遇到以下立即停止并报告：校验失败、数字不符、tag/事实文件不一致、
旧站未备份、initialized:false、预检 FAIL、证书/DNS/Cloudflare 不明确、
输出与预期不符。

未经我明确确认，不执行 sudo apt install、systemctl、certbot、DNS 修改、
数据恢复、删除任何文件。每步命令和输出保存到
~/evol-deploy/部署日志/<日期时间>/Sxx.log。
```
