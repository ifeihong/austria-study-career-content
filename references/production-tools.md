# 可复用图文制作工具

## 能做什么

`scripts/render-post.cjs` 从本地 JSON 生成独立 PNG、360 像素宽整套预览、发布文案、可编辑 HTML/JSON 与修改记录。支持五种风格方向、basic 兼容模式与 editorial 制作模式。正式设计资源见 [V10 样稿](../assets/editorial/README.md)，可选本地图片。

这是一套稳定起点，不是对五张风格 DEMO 的逐像素复刻。复杂的实景叠字、自由构图和艺术设计仍可使用其他排版工具，最终检查标准相同。脚本不负责 AI 图片生成，也不会联网下载素材。

## 依赖与运行

需要 Node.js 20 及以上、Playwright 和可启动的 Chromium 系浏览器。优先复用环境已有依赖；仓库中没有附带字体、浏览器或 node_modules。

在有 npm 的环境，可在仓库根目录执行 `npm install` 安装声明的依赖。此步骤会联网获取软件包，只有环境允许且用户授权相关安装时执行；不要自动安装大型浏览器。已有 Chrome/Edge 可用 `--browser` 指定可执行文件。

已有 Playwright 时可以用环境变量 `PLAYWRIGHT_MODULE_PATH` 指向该模块目录，避免重复安装；`BROWSER_EXECUTABLE` 可指定浏览器。两者为可选本机配置，不写死绝对路径到公共代码。

## 完整导出

在仓库根目录运行：

```sh
node scripts/render-post.cjs --input assets/editorial/family.json --out output/family-editorial-v01
```

如默认浏览器不可用，使用实际存在的可执行文件：

```sh
node scripts/render-post.cjs --input assets/editorial/family.json --out output/family-editorial-v01 --browser /actual/path/to/browser
```

上面的浏览器路径是需替换的示意值。输出目录必须不存在；使用新版本目录，避免覆盖已确认内容。

## 输入字段

参考 [正式示例](../assets/editorial/family.json)。字段中的文本全部转义后排版，不接受 HTML 或 CSS 片段。

输入使用 UTF-8 JSON，支持 Windows 编辑器可能附带的 UTF-8 BOM。字段名严格按下表填写，未知字段或在非 table 页面填写 columns/rows 会报错，避免拼写错误导致内容静默遗漏。内部来源记录、提示词与审核状态另存文件，不向排版 JSON 任意加字段。

| 层级 | 字段与含义 |
|---|---|
| 全局 | `design` 为 basic 或 editorial，省略时保留 basic 兼容行为；正式图文显式采用 editorial 或自定义设计；`title` 文档名称；`brand` 品牌署名，默认既定品牌；`style` 为 S1—S5；可选 `theme` 的 background、ink、accent 为六位十六进制颜色 |
| 发布文案 | 可选 `publish`，含 title、body、topics 数组；存在时输出 publish.md、标题/正文/话题 TXT 与内部 publish-check.json；按 [普通图文字段规范](xiaohongshu-publish-fields.md) 校验保守 20/1000 单元预算及本地最多 8 个话题，否则只是图片制作任务，不是完整发布包 |
| 页面 | `pages` 数组；每页必须有唯一的英文小写字母、数字及连字符 `id`，以及非空 `title` |
| 页面排版 | `layout` 的基础值为 cover、checklist、steps、table、split；editorial 模式另支持 poster、feature、cards、worksheet、journey；可选页级 style、eyebrow、subtitle、note |
| 内容条目 | `items` 数组，每项有 heading 和可选 text |
| 表格 | table/worksheet 布局需 columns 与 rows，每行单元格数等于列数，单元格为文字 |
| 图片 | `image` 为相对 JSON 文件的本地 PNG/JPEG/WebP 路径；`imageLabel` 为成图标识或说明 |
| 图片适配 | 可选 `imageFit` 为 contain（完整呈现）或 cover（填充裁切）；`imageHeight` 为 160—800 的整数像素；`imageFocus` 为 x/y 两个 0—100 的百分比坐标 |

`imageLabel` 和适配字段必须同时有 `image`，否则报错，避免说明静默丢失。需要保留证据全貌时先选 contain；cover 用于允许裁切的情境图，焦点控制不替代成图检查。增加图片高度后仍可能溢出，应调整版面或拆页，不隐藏内容。

正式图文从 [V10 图片设计资源](../assets/editorial/README.md) 开始。poster/feature 是图片主导页面，必须提供本地 image；其他角色按内容选图。旧 [基础示例](../assets/examples/README.md) 保留为回归/极简测试，不是正式图文默认设计。内置脚本不自动取图或生成 AI 图。

图片应放在 JSON 同目录或子目录，不接受网络 URL、绝对路径与向上跳转，也不接受逃出输入目录的符号链接。授权素材可先复制到该项目的 media 子目录。该工具不能把私有素材自动上传。

字体由操作系统提供，中文默认依次尝试微软雅黑、苹方、Noto Sans CJK SC。移到其他机器应先确认中文及 emoji 字体，并目视检查；没有把字体文件打进仓库。

## 仅更新指定页面

修改 JSON 中目标页，保持其他页与全局设置不变，然后执行：

```sh
node scripts/render-post.cjs --input assets/editorial/family.json --out output/family-editorial-v02 --base output/family-editorial-v01 --pages assumptions
```

`--pages` 采用页面 ID，可用逗号列多页。工具核对渲染器版本摘要、页序、全局设置、每页文字和图片内容摘要；未选页变化则拒绝局部更新。未修改图片直接复制并校验 SHA-256，不重新生成。

修改发布正文不影响图片时可沿用相同机制；渲染脚本、全篇公共设置或页序发生变化需完整导出新版本。`manifest.json` 保存实际渲染页与每张图片摘要，不自动证明内容已获业务确认。

## 导出与检查

输出：images/、preview.jpg、source/post.html、source/post.json、必要的 source/media/、manifest.json，以及可选的 publish.md。HTML 内嵌图片，可直接浏览；JSON 与复制的媒体支持再次渲染。

工具检查图片解码、页面和正文区域溢出，发现过密内容时拒绝导出，不静默缩字或截断。只在全部页面通过上述检查后创建新版本目录。导出期间发生磁盘写入错误时可能留下不完整目录，不能将其交付为成品；应检查后换新版本重试。

导出时逐页隔离到单页视口，减少长文档滚动截图出现局部未绘制的风险。基础示例测试另核对标题与页脚区域确有深色内容像素；该测试只适用于这些浅底示例，不能普遍证明每篇的文字、语义和版式正确。

仍须逐张目视检查字体、emoji、内容语义、裁切和对比度，并检查预览。工具不判断政策真伪，不做真机与平台上传测试，不把自动检查标为视觉审核完成。

## 测试

```sh
npm test
```

默认运行输入校验测试。设置 `RUN_RENDER_TESTS=1` 后启用浏览器集成测试，需要依赖与浏览器可用；可与上述两个环境变量配合。测试实际覆盖完整出图、文字转义、本地图片与可迁移源文件、指定页修改、未改页字节一致、全局/未指定页改动拒绝、输出目录冲突及溢出拒绝。

发布文案的本地预算以 UTF-16 单元计数，正文合并话题和换行后校验；超长、重复话题或格式不符时报错，不自动截断。规则依据及未实测边界见 [发布字段规范](xiaohongshu-publish-fields.md)。渲染器不登录平台，不确认真实话题挂接。
