# ATLAS V GitHub Pages 展示版

这是独立的静态展示项目，保留原网站的省份目录、七类旅行偏好、中文与拼音搜索、季节/月筛选、天数筛选、景点详情、原图查看、候选收藏和返回省份功能。

网页运行不需要原 `chatgpt.site` 域名：资料、照片、图标和拼音库均随项目提供。参考资料的外部链接只在主动点击时打开。没有第三方字体、CDN 或在线接口依赖。

## 与原后台的边界

- 本项目只提供公开浏览，不含后台登录、管理员分配、上传或在线编辑。
- 原网站及其后台不受本次导出影响。
- 这是已发布内容的快照，不是实时同步。原后台发布后，需要在可访问原网站的网络上执行 `npm run sync`，检查变更并提交 GitHub，才会更新 Pages。
- 原公开接口只返回已发布覆盖记录，不提供删除/下架清单。下架内容必须同时在 `data/catalog.json` 的 `cities` 数组中删除；不要把同步命令当作完整数据库镜像。
- 收藏存在各自浏览器的本地存储中，不会跨设备同步；新域名不能自动读取旧域名的收藏。

## 目录

```text
.github/workflows/pages.yml  推送 main 后测试、构建、部署
data/catalog.json           已发布景点快照，图片均指向本地文件
site/                       页面、脚本、样式、全部照片和本地依赖
scripts/build.mjs           离线构建，输出 dist/
scripts/catalog.mjs         分类归并与资源校验
scripts/sync.mjs            手动获取原后台已发布更新和新增照片
scripts/serve.mjs           本地预览，可模拟 GitHub 项目子路径
tests/site.test.mjs          路径、筛选、搜索、详情、收藏等测试
```

## 发布步骤

1. 在 GitHub 新建一个独立仓库，例如 `atlas-v-travel`，默认分支使用 `main`。GitHub Free 可使用公开仓库发布 Pages。公开仓库中的文件和图片也可以被他人查看；发布前请确认图文授权。不要上传原项目的密钥、`.dev.vars`、数据库、管理员信息或 `node_modules`。
2. 将本目录的全部内容提交到仓库根目录，必须包含隐藏目录 `.github`。不要把外层文件夹再嵌套一层。不要把 ZIP 压缩包直接作为网站上传。
3. 在仓库 `Settings > Pages > Build and deployment > Source` 中选择 **GitHub Actions**。
4. 打开 `Actions > Deploy ATLAS V to GitHub Pages`。如果首次推送发生在启用 Pages 之前，选择 `Run workflow`，分支选 `main`。
5. 等待 `build` 和 `deploy` 两个任务成功。发布网址会显示在部署结果和 `Settings > Pages` 中，一般为 `https://你的用户名.github.io/atlas-v-travel/`。这是格式示例，不是已经发布的新地址。
6. 用手机流量分别检查主页、搜索、详情图片及刷新后的深链接。GitHub Pages 的可访问性仍需要实际网络验证，不能保证所有运营商都能访问。

后续推送到 `main` 会自动测试并发布；Pull Request 只测试和构建，不发布。无需填写部署密钥、购买域名或安装项目依赖。

### 使用 Git 提交（可选）

在本项目目录执行；将示例仓库地址替换为自己的地址。需先安装 Git，并通过 GitHub 官方方式完成认证，不要把令牌写入网址或文件。

```sh
git init -b main
git add .
git commit -m "Publish ATLAS V static travel catalog"
git remote add origin https://github.com/YOUR-USER/atlas-v-travel.git
git push -u origin main
```

## 本地检查和预览

安装 Node.js 22 或以上版本，无需 `npm install`，项目没有 npm 依赖。

```sh
npm test
npm run build
npm run preview
```

打开终端显示的 `http://127.0.0.1:4174/`。模拟 GitHub 项目路径：

```sh
npm run preview -- --base /atlas-v-travel/ --port 4175
```

打开 `http://127.0.0.1:4175/atlas-v-travel/`。按 Ctrl+C 结束预览。不要直接打开源码 `site/index.html`，因为 `catalog.js` 由构建生成。

## 更新内容

### 从现有后台导入

```sh
npm run sync
npm test
npm run build
git diff --stat
git add data/catalog.json site/assets
git commit -m "Update published travel catalog"
git push
```

同步只读取原网站的公开景点接口和公开图片，不登录，不读取管理员或草稿。如果网络仍拦截原域名，同步会报错；已有展示快照不受影响，构建和 Pages 访客不需要连接原域名。新增照片按内容哈希保存到 `site/assets/uploads/`，图片说明会随路径一起转换。

也可以指定另一个兼容的公开来源：

```sh
npm run sync -- --source-url https://YOUR-PUBLIC-ORIGIN.example
```

该参数必须是 HTTPS 根地址，不要包含账号、密码或令牌。公开来源必须实现同样的 `/api/catalog` 数据契约。构建流程不会自动联网同步，避免源站被拦截导致发布失败。

### 直接编辑快照

编辑 `data/catalog.json`，在 `site/assets/` 中添加照片；`photos` 仅填写如 `assets/uploads/example.webp` 的相对路径。`photoCaptions` 的键必须与照片路径一致。编辑后执行测试和构建，再提交。

分类仅支持：海岛度假、美食寻味、山水户外、文化漫游、温泉度假、冰雪体验、黄色秋景。

## 路径和部署设计

- 不使用 `<base href="/">`、绝对根目录资源路径或原站图片接口。
- 所有资源相对当前页面目录加载，兼容仓库项目路径和用户主页根路径，不需要手动修改仓库名称。
- 页面路由使用 `#list`、`#city/...` 和 `#picks`，刷新详情不会请求不存在的服务器路由，无需 SPA 404 回退。
- 构建生成 `.nojekyll`，只发布 `dist/`，不发布本地工具、测试文件、原服务器代码或任何环境变量。
- 自动部署只使用 GitHub 自带的短期 `GITHUB_TOKEN`，不需要手动配置 PAT。部署任务使用 `pages: write` 和 `id-token: write`，构建任务仅使用 `contents: read`。
- 如果 Pages 提示 404，先检查 Actions 是否成功、Source 是否选 GitHub Actions、仓库文件是否多套了一层目录，再检查网址末尾的仓库路径。
- 如果页面还是旧版本，等 Actions 部署成功后刷新；不要反复重新上传同一份压缩包。

## 依赖与图文说明

浏览器依赖为本地 Lucide 和 pinyin-pro；保留库文件中的许可证说明及 `site/assets/pinyin-pro-LICENSE.txt`。旅游图文来自用户已有清单及后台公开内容，本项目不授予额外图文版权。

GitHub 官方文档：

- https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

交付时只完成本地整理与验证，未创建 GitHub 仓库，未在 GitHub 执行发布，也未验证手机运营商网络。
