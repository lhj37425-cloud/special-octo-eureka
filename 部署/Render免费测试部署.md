# Render 免费测试部署（deploy-demo-render 分支）

> 目标：把**前台**放到免费公网 HTTPS 地址，用于验收和问题排查。
> 不部署后台，不暴露管理员账号、真实留言和真实上传目录。测试数据是脱敏副本。
> 轻量测试数据（11MB）不含视频片段，课程页不显示“学习预览”；用于页面、表单、移动端验收。完整视频版在本地 `deploy-demo` 分支，网络稳定后再推。

## 一、先创建账号

### 1. GitHub 账号
仓库已经在 GitHub：`https://github.com/lhj37425-cloud/special-octo-eureka`。
如果你能登录这个仓库的账号，直接跳到第 2 步；否则先在 `https://github.com/signup` 注册并让仓库所有者把仓库加给你。

### 2. Render 账号（免费）
1. 打开 `https://dashboard.render.com/register`。
2. 选择 **Sign up with GitHub**（推荐），按提示授权 Render 读取你的仓库。
3. 验证邮箱，进入 Dashboard。
4. 免费 Web Service 一般不需要信用卡；如果页面要求付款方式，先不要填，改用文末的备选方案。

## 二、部署步骤

### 1. 确认 `deploy-demo-render` 分支已推到 GitHub
本地已经准备好该分支（包含脱敏测试数据和 `render.yaml`）。在 `D:\项目` 执行：

```bash
git push -u origin deploy-demo-render
```

如果 GitHub 推送失败，先用 GitHub Desktop 打开 `D:\项目`，切到 `deploy-demo-render` 分支，点 **Push origin**。

### 2. 在 Render 创建服务
1. Dashboard → **New +** → **Web Service**。
2. 选择 **Build and deploy from a Git repository**，连接 GitHub，选择 `special-octo-eureka`。
3. 分支选 **`deploy-demo-render`**。
4. Name：`evol-dream-demo`。
5. Region：**Singapore**（离越南/中国最近）。
6. Runtime：**Node**。
7. Build Command：`npm install --omit=dev`。
8. Start Command：`node server.js`。
9. Instance Type：**Free**。
10. 展开 **Environment Variables**，添加：

| Key | Value |
|---|---|
| `HOST` | `0.0.0.0` |
| `MVP_DATA_DIR` | `/opt/render/project/src/demo-data` |
| `ADMIN_DATA_DIR` | `/opt/render/project/src/demo-data/admin-backend` |
| `NODE_VERSION` | `22` |

11. 点 **Create Web Service**，等待构建和启动。

### 3. 打开测试地址
构建完成后，Render 会给出类似：

```text
https://evol-dream-demo.onrender.com
```

测试：
- `/vi/`、`/zh/`、`/en/`
- 课程页、专家页、案例页
- 手机宽度
- 联系表单可以提交（写入测试数据副本，实例重启后会清空）
- **没有后台**：`/admin/` 不应该存在；不要尝试登录后台

## 三、免费实例的限制

- 15 分钟无访问会休眠，下一次访问要等 30–60 秒。
- 磁盘是临时的：重启/重新部署后，测试留言和上传会丢；测试数据会恢复成 `demo-data` 的初始内容。
- 不要把这个地址当正式站；正式上线仍走 `部署/上线部署说明.md` 的 Linux + Nginx + 持久磁盘方案。
- 测试页 robots.txt 已设为禁止抓取，避免临时地址被搜索引擎收录。
- canonical / og:url 仍指向 `https://www.evoldream.tech`；这是为了不改变正式站 SEO，临时测试忽略即可。

## 四、如果 Render 要求信用卡

可以改用以下免费方案（同样只部署前台）：
1. **Replit**：新建 Node repl，上传项目压缩包；运行 `node server.js`，设置 `HOST=0.0.0.0`、`MVP_DATA_DIR`、`ADMIN_DATA_DIR`。
2. **Glitch**：新建 Node 项目，导入 GitHub 仓库的 `deploy-demo-render` 分支，设置同样环境变量。
3. **Cloudflare Quick Tunnel**：在一台出网正常的机器上运行：
   `cloudflared tunnel --url http://127.0.0.1:5173`
   这是临时地址，不经过 Render。

## 五、删除测试服务

测试结束后，在 Render Dashboard → 服务 → Settings → **Delete Web Service**。
GitHub 上的 `deploy-demo-render` 分支可保留（便于下次测试）或删除。
