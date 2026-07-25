# CF-Workers-UsagePanel

<div align="center">

📊 **Cloudflare Workers/Pages/D1/KV/R2 免费额度统计面板**

一个优雅、现代的 Cloudflare 免费额度监控仪表板

[![License](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange.svg)](https://workers.cloudflare.com/)
[![Made with Love](https://img.shields.io/badge/Made%20with-❤-red.svg)](https://github.com/cmliu/CF-Workers-UsagePanel)

</div>

---

[![](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/iliYF/CFUsagePanel)

## 📖 项目简介

**CF-Workers-UsagePanel** 是一个基于 Cloudflare Workers 构建的免费额度统计监控面板,帮助您实时追踪和管理多个 Cloudflare 账户的 Workers、Pages、D1、Workers KV 和 R2 使用情况。

### 为什么需要这个面板?

- ✅ **多账号管理** - 在一个面板中管理所有 Cloudflare 账号的请求量
- ✅ **实时监控** - 自动定时更新请求数据,掌握最新使用情况
- ✅ **精美界面** - 采用现代化设计,支持亮色/暗色主题切换
- ✅ **移动优化** - 完美适配移动端,随时随地查看数据
- ✅ **零成本部署** - 完全免费,部署在 Cloudflare Workers 上

---

## 🎯 快速体验

### Demo 站点

👉 **[点击预览演示](https://usagepanel.pages.dev)**

| 项目 | 内容 |
|------|------|
| 🌐 站点地址 | https://UsagePanel.pages.dev |
| 👤 账号 | `admin` |
| 🔐 密码 | `admin` |

> 💡 Demo 站点已预配置多个示例账号,你可以直接登录体验完整功能

---

## ✨ 功能特性

### 🎯 核心功能

- **实时数据展示**
  - Workers 请求数统计
  - Pages 请求数统计
  - D1 行读取、行写入和存储统计
  - Workers KV 读、写、删除、列表和存储统计
  - R2 Class A、Class B 操作和存储统计
  - 总请求数及各项免费额度使用百分比
  - 可视化进度条展示

- **多账号管理**
  - 支持添加无限个 Cloudflare 账号
  - 每个账号独立显示使用情况
  - 一键删除不需要的账号

- **自动更新机制**
  - 过期自动更新
  - D1/KV 按 UTC 当日统计,R2 操作按当月统计
  - 数据持久化存储在 KV

- **管理员系统**
  - 密码保护的管理面板
  - Cookie 认证机制
  - 安全的登录/登出功能

### 🎨 界面特性

- **现代化设计**
  - 玻璃态(Glassmorphism)设计风格  
  - 流畅的动画过渡效果
  - 渐变色彩搭配

- **主题切换**
  - 支持亮色/暗色主题
  - 自动检测系统偏好
  - 主题偏好本地持久化

- **响应式布局**
  - 完美适配桌面端
  - 优化移动端显示
  - 自适应各种屏幕尺寸

---

## 🚀 快速部署

### 方法一:通过 Cloudflare Dashboard 部署

#### 1. 创建 Workers

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **Workers & Pages**
3. 点击 **创建应用程序** → **创建 Worker**
4. 为你的 Worker 命名(例如:`usage-panel`)
5. 点击 **部署**

#### 2. 配置代码

1. 点击 **快速编辑** 或 **编辑代码**
2. 将 `_worker.js` 的全部内容复制粘贴到编辑器中
3. 点击 **保存并部署**

#### 3. 创建 KV 命名空间 (⚠️ 必须步骤)

1. 在左侧菜单中,点击 **KV**
2. 点击 **创建命名空间**
3. 命名为 `UsagePanel_KV`(名称可自定义)
4. 点击 **添加**
5. 记下创建的 **命名空间 ID**

#### 4. 绑定 KV 到 Worker (⚠️ 必须步骤)

1. 返回你的 Worker 页面
2. 进入 **设置** → **变量**
3. 滚动到 **KV 命名空间绑定** 部分
4. 点击 **添加绑定**
   - **变量名称**: `KV` (⚠️ 必须是大写 `KV`,不能修改)
   - **KV 命名空间**: 选择刚才创建的 `UsagePanel_KV`
5. 点击 **保存并部署**

#### 5. 设置环境变量 (⚠️ 必须步骤)

在 **设置** → **变量** → **环境变量** 中添加:

| 变量名 | 是否必须 | 说明 | 示例值 |
|--------|---------|------|--------|
| `PASSWORD` | ✅ **必须** | 管理员密码,用于登录管理面板 | `mySecurePassword123` |
| `USERNAME` | ⚪ 可选 | 管理员账号,默认为 `admin` | `admin` |

**添加步骤:**
1. 点击 **添加变量**
2. **变量名称** 填写 `PASSWORD`
3. **值** 填写你的密码(请使用强密码)
4. 点击 **保存并部署**

---



### 方法二:使用 Wrangler 本地开发与部署（推荐）

#### 前置条件

- [Node.js](https://nodejs.org/) 20+
- Cloudflare 账号

#### 1. 克隆项目并安装依赖

```bash
git clone https://github.com/<your-username>/CF-Workers-UsagePanel.git
cd CF-Workers-UsagePanel
npm install
```

#### 2. 本地预览（无需真实 KV）

```bash
cp .dev.vars.example .dev.vars
# 编辑 .dev.vars，设置 PASSWORD

npx wrangler dev
```

打开 http://localhost:8787 即可访问。

> **说明**：`npx wrangler dev` 默认使用 Miniflare 在本地模拟 KV，数据保存在 `.wrangler/state/`，因此本地开发阶段**不需要创建真实 KV 命名空间**，`wrangler.jsonc` 里的占位符 ID 不影响本地预览。

#### 3. 创建 KV 命名空间（仅部署前需要）

准备部署到 Cloudflare 时，再创建真实 KV：

```bash
# 生产环境 KV
npx wrangler kv namespace create KV
# 预览环境 KV（可选，用于 wrangler dev --remote）
npx wrangler kv namespace create KV --preview
```

将返回的 `id` 和 `preview_id` 分别填入 `wrangler.jsonc` 中 `kv_namespaces[0].id` 和 `kv_namespaces[0].preview_id`。

#### 4. 部署上线

```bash
# 生产环境密码请以 secret 形式设置，避免明文提交
npx wrangler secret put PASSWORD

# 部署
npx wrangler deploy
```

#### 5. CI 自动部署

在仓库 **Settings → Secrets and variables → Actions** 中添加：

- `CLOUDFLARE_API_TOKEN`：具有 `Cloudflare Workers:Edit`、`Workers KV Storage:Edit`、`Account Settings:Read` 权限的 API Token。
- `CLOUDFLARE_ACCOUNT_ID`：你的 Cloudflare 账户 ID。

推送代码到 `main` 分支后将自动触发 `wrangler deploy`。

> **Cron 说明**：`wrangler.jsonc` 中已默认注册 `*/20 * * * *`（每 20 分钟）。如果你修改了 `ACCOUNT_CHECK_INTERVAL_MINUTES`，请同步调整 cron 表达式。

---

## ⚙️ 配置说明

### 🔑 环境变量

| 变量名 | 类型 | 是否必须 | 默认值 | 说明 |
|--------|------|---------|--------|------|
| `PASSWORD` | String | ✅ **必须** | 无 | 管理员密码,用于登录管理面板。**强烈建议使用强密码** |
| `USERNAME` | String | ⚪ 可选 | `admin` | 管理员账号名 |
| `ACCOUNT_CHECK_INTERVAL_MINUTES` | Number | ⚪ 可选 | `20` | 单账号最短刷新间隔，按 `UpdateTime` 判断；未超过时使用历史数据 |
| `MAX_EXTERNAL_SUBREQUESTS_PER_RUN` | Number | ⚪ 可选 | `50` | 每次汇总最多使用的外部子请求预算，最大不会超过 50 |

每个账号刷新约消耗 4 个外部子请求；如果账号没有保存 `AccountID`，需要额外查询账户列表，约消耗 5 个外部子请求。默认 50 的预算通常可刷新 10-12 个账号。


**⚠️ 重要提示:**
- `PASSWORD` 变量是**必须**设置的,否则 Worker 会返回错误
- 支持多种变量名,优先级从上到下
- 建议使用 `PASSWORD` 和 `USERNAME` 这两个标准变量名

---

### 💾 KV 命名空间绑定

**⚠️ 这是最关键的配置步骤!**

#### 绑定要求

- **变量名称必须是**: `KV` (大写,不能改)
- **绑定类型**: KV 命名空间
- **用途**: 存储以下数据
  - `usage.json` - 汇总的请求使用数据
  - `usage_config.json` - 所有 Cloudflare 账号的配置信息

#### KV 数据结构示例

**`usage.json`** (总使用量):
```json
{
  "success": true,
  "pages": 10900,
  "workers": 9670,
  "total": 20570,
  "max": 200000,
  "resources": {
    "d1": {
      "rowsRead": 120000,
      "rowsReadLimit": 10000000,
      "rowsWritten": 800,
      "rowsWrittenLimit": 200000,
      "storageBytes": 18874368,
      "storageLimitBytes": 10737418240,
      "period": "day"
    },
    "kv": {
      "reads": 15600,
      "readsLimit": 200000,
      "writes": 18,
      "writesLimit": 2000,
      "deletes": 0,
      "deletesLimit": 2000,
      "lists": 3,
      "listsLimit": 2000,
      "storageBytes": 5242880,
      "storageLimitBytes": 2147483648,
      "period": "day"
    },
    "r2": {
      "classA": 2400,
      "classALimit": 2000000,
      "classB": 86000,
      "classBLimit": 20000000,
      "storageBytes": 268435456,
      "storageLimitBytes": 21474836480,
      "period": "month"
    }
  },
  "msg": "✅ 成功加载免费额度使用数据"
}
```

**`usage_config.json`** (账号配置列表):
```json
[
  {
    "ID": 1,
    "Name": "主账号",
    "Email": null,
    "GlobalAPIKey": null,
    "AccountID": "6d7***************************90",
    "APIToken": "duN***********************************fs",
    "UpdateTime": 1736455698819,
    "LastCheckTime": 1736455698819,
    "Usage": {
      "success": true,
      "pages": 10900,
      "workers": 9670,
      "total": 20570,
      "max": 100000,
      "resources": {
        "d1": { "rowsRead": 86000, "rowsReadLimit": 5000000, "rowsWritten": 500, "rowsWrittenLimit": 100000, "storageBytes": 12582912, "storageLimitBytes": 5368709120 },
        "kv": { "reads": 10200, "readsLimit": 100000, "writes": 12, "writesLimit": 1000, "deletes": 0, "deletesLimit": 1000, "lists": 2, "listsLimit": 1000, "storageBytes": 3145728, "storageLimitBytes": 1073741824 },
        "r2": { "classA": 1600, "classALimit": 1000000, "classB": 52000, "classBLimit": 10000000, "storageBytes": 167772160, "storageLimitBytes": 10737418240, "period": "month" }
      }
    }
  }
]
```

---

## 📝 使用指南

### 首次访问

1. 部署完成后,访问你的 Worker 地址: `https://your-worker.workers.dev/`
2. 首页右上角点击会显示一个登录气泡,点击进入管理面板
3. 输入你设置的 `USERNAME` 和 `PASSWORD` 登录

### 添加 Cloudflare 账号

登录管理面板后:

#### 使用 Account ID + API Token

1. 点击 **➕ 添加账号**
2. 填写以下信息:
   - **账号名称**: 自定义名称
   - **Account ID**: 在 Cloudflare Dashboard 右侧可以找到
   - **API Token**: 创建一个具有 **Account → Analytics → Read** 权限的 Token
3. 点击 **确认添加**

**创建 API Token:**
1. 访问 https://dash.cloudflare.com/profile/api-tokens
2. 点击 **Create Token**
3. 使用模板 **Read analytics** 或自定义:
   - **Permissions**: Account → Analytics → Read
   - **Account Resources**: 选择对应账号
4. 点击 **Continue to summary** → **Create Token**
5. 复制生成的 Token

**获取 Account ID:**
1. 登录 Cloudflare Dashboard
2. 选择任意域名或进入 Workers 页面
3. 在页面右侧栏可以看到 **Account ID**

### 查看请求数据

#### 在管理面板查看

- 登录后自动显示所有账号的使用情况
- 可以看到每个账号的 Workers、Pages、D1、KV、R2 使用明细

#### 在主页查看

- 访问 `https://your-worker.workers.dev/`
- 显示所有账号的汇总数据
- 包含 Workers/Pages 总请求量以及 D1、KV、R2 免费额度占比

#### 通过 API 获取

```bash
# 使用管理员 Token
curl https://your-worker.workers.dev/usage.json?token=ADMIN_TOKEN
```

**获取 Token:**
- 在主页或管理面板中,查看网络请求中的 `token` 参数
- 或使用 MD5(MD5(PASSWORD + USERNAME)) 计算管理员 Token

### 删除账号

1. 进入管理面板
2. 找到要删除的账号
3. 点击 **🗑️ 删除** 按钮
4. 确认删除

---

## 🛣️ API 路由说明

| 路径 | 方法 | 说明 | 认证要求 |
|------|------|------|---------|
| `/` | GET | 主页,显示汇总免费额度数据 | 无 |
| `/admin` | GET | 管理面板 | Cookie 认证 |
| `/api/login` | POST | 管理员登录接口 | 无 |
| `/api/add` | POST | 添加 CF 账号 | Cookie 认证 |
| `/api/del` | POST | 删除 CF 账号 | Cookie 认证 |
| `/api/check` | POST | 管理员手动用 `AccountID/APIToken` 或 `Email/GlobalAPIKey` 查询免费额度用量 | Cookie 认证 |
| `/admin/config.json` | GET | 获取账号配置列表 | Cookie 认证 |
| `/admin/usage.json` | GET | 获取最新汇总使用数据 | Cookie 认证 |
| `/usage.json` | GET | 公开的使用数据接口 | Token 参数 |
| `/robots.txt` | GET | 搜索引擎爬虫规则 | 无 |

---

## 🔒 安全说明

### 认证机制

1. **Cookie 认证**
   - 登录成功后设置 HttpOnly Cookie
   - Cookie 值 = MD5(管理员TOKEN + User-Agent)
   - 有效期 24 小时
   - 所有管理 API 都需要 Cookie 验证

2. **Token 认证**
   - 临时 Token = MD5(域名 + 管理员TOKEN + UA)
   - 管理员 Token = MD5(MD5(PASSWORD + USERNAME))
   - 用于访问 `usage.json` 接口

### 安全建议

- ✅ 使用强密码(建议 16+ 字符,包含大小写字母、数字、符号)
- ✅ 定期更换密码
- ✅ 不要在公共场所泄露 Worker 域名
- ✅ 使用 API Token 而非 Global API Key(权限更小)
- ✅ 定期检查账号列表,删除不需要的配置
- ⚠️ API Token 和 Global API Key 具有敏感权限,妥善保管

---

## 🎨 界面主题

### 暗色主题 (默认)

- 深色背景配合柔和渐变
- 适合夜间查看,保护眼睛
- 紫色、靛蓝色调为主

### 亮色主题

- 清新明亮的界面
- 适合白天使用
- 自动调整对比度,确保可读性

### 切换主题

- 点击右下角的 **🌙/☀️** 图标
- 主题偏好自动保存在本地
- 首次访问自动检测系统偏好

---

## 📱 移动端适配

- ✅ 完美响应式设计
- ✅ 优化触摸操作
- ✅ 自适应字体大小
- ✅ 紧凑的卡片布局
- ✅ 底部导航按钮优化
- ✅ 支持横竖屏切换

---

## 🛠️ 技术栈

- **运行环境**: Cloudflare Workers
- **存储**: Cloudflare KV
- **前端**: 原生 HTML + CSS + JavaScript
- **字体**: Google Fonts (Outfit)
- **图标**: SVG
- **API**: Cloudflare GraphQL Analytics API

---

## ❓ 常见问题

### 1. 部署后无法访问?

**检查清单:**
- ✅ 是否设置了 `PASSWORD` 环境变量?
- ✅ 是否绑定了 KV 命名空间?
- ✅ KV 绑定的变量名是否为 `KV`(大写)?
- ✅ Worker 是否成功部署?

### 2. 提示 "请先绑定一个KV命名空间到变量KV"?

**解决方法:**
1. 创建一个 KV 命名空间
2. 在 Worker 设置中绑定 KV
3. **变量名称必须是 `KV`**(大写)
4. 保存并重新部署

### 3. 无法登录管理面板?

**检查:**
- 确认 `PASSWORD` 环境变量已设置
- 确认输入的账号密码正确
- 默认账号是 `admin`(除非你设置了 `USERNAME`)
- 清除浏览器 Cookie 后重试

### 4. 添加账号后无数据?

**原因:**
- API Token 或 Global API Key 权限不足
- Account ID 错误
- Cloudflare API 访问失败

**解决:**
1. 检查 API Token 是否有 `Account → Analytics → Read` 权限
2. 确认 Account ID 正确
3. 等待定时任务执行或手动刷新

### 5. 如何自动更新数据?

**方法一:配置 Cron Triggers**
- 在 Worker 设置中添加 Cron 触发器
- 例如: `0 */6 * * *` (每 6 小时)

**方法二:修改 wrangler.jsonc（推荐）**
- 编辑 `wrangler.jsonc` 中的 `triggers.crons`
- 例如: `"0 */6 * * *"` (每 6 小时)
- 修改后运行 `npx wrangler deploy` 重新部署

**方法三:手动刷新**
- 进入管理面板点击 **🔄 手动刷新**

### 6. 免费额度数据不准确?

**说明:**
- 数据来源于 Cloudflare GraphQL Analytics API
- Workers/Pages、D1、KV 统计的是当天 UTC 0:00 到当前时间的数据
- R2 Class A / Class B 操作按当前 UTC 月统计
- D1/KV/R2 存储为最近一次指标快照,不是当天累计量
- 可能有轻微延迟(通常 5-10 分钟)

### 7. 如何迁移到新的 Worker?

**步骤:**
1. 导出旧 KV 的数据:
   ```bash
   wrangler kv:key get "usage_config.json" --binding=KV
   ```
2. 在新 Worker 创建 KV 并绑定
3. 导入数据:
   ```bash
   wrangler kv:key put "usage_config.json" --binding=KV --path=config.json
   ```
4. 设置相同的环境变量

---

## 📄 开源协议

本项目基于 [GNU General Public License v3 (GPLv3)](LICENSE) 开源。

---

## 🙏 致谢

- 感谢 [Cloudflare](https://www.cloudflare.com/) 提供的强大平台
- 感谢所有为这个项目提供建议和反馈的用户
- 界面设计灵感来源于现代化的 Web 设计趋势

---

<div align="center">

**[⬆ 回到顶部](#cf-workers-usagepanel)**

Made with ❤️ by [CM Liu](https://github.com/cmliu)

</div>
