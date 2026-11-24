# 自定义排版：真实页记录与交付审计

Python、设计软件或其他自定义排版可以继续使用。统一的是内容、素材、成图和发布文字的对应，不要求把每个设计改写成内置渲染器。

`scripts/custom-package.cjs` 只校验本地交付包，不生成图片、不执行排版代码、不登记历史、不联网。需要Node.js 20+。它检查PNG文件头和尺寸，不做完整解码、OCR、品牌可见性、事实或美观判断。

## 输入与文件结构

```text
新版本发布包/
  source/
    custom-post.json
    build.py
    assets/scene.png
    fonts/（实际使用时同时保留字体及许可）
  images/01.png
  publish-title.txt
  publish-body.txt
  publish-topics.txt
  publish.md（可选）
```

`source/custom-post.json` 是实际成品对应的输入。一个page必须对应一张最终页面，不把66段文字记录成66页。完整上版文字写在`text`，或使用历史工具支持的`title/subtitle/body/note/items/columns/rows`；未知页字段会拒绝，不能只保存标题而遗漏条件。

以下为结构示例，路径和内容需替换为实际制作产物：

```json
{
  "title": "冬日散步",
  "brand": "奥地利求学就业桔",
  "style": "S3",
  "template": "T4",
  "templateVariant": "winter-editorial",
  "medium": "photo",
  "primaryGoal": "appreciation",
  "producer": "Codex",
  "publish": {
    "title": "冬天的晚上去散步",
    "body": "沿着亮灯的街道慢慢走。",
    "topics": ["奥地利生活"]
  },
  "pages": [
    {"id": "cover", "text": "一个冬日生活的片段", "image": "assets/scene.png"}
  ],
  "outputs": [{"id": "cover", "file": "images/01.png"}],
  "files": ["source/build.py", "source/assets/scene.png"]
}
```

- `style`是S1—S8信息方向；`template`是实际采用的T1—T8，真正自定义可写`custom`，不假记模板。`templateVariant`记录变体；它不让内置`render-post.cjs`接受`custom`。
- `medium`可为`photo/illustration/comic/evidence/mixed/none`；摄影感生成场景仍需内部素材记录，不能写成实拍证据。
- 可选`primaryGoal`为`attract/save/follow/questions/appreciation`。`topic/audience/angle/platform/producer/createdAt/plannedPublishAt`可记录实际元信息；计划发布日期不是实际发布证明。
- 每页`id`唯一，`outputs`按页面顺序一一对应。输出位于`images/`，PNG尺寸1080×1440；不接受同一最终图片重复充页。
- 页内`image`相对`source/`；`files`相对包根目录，列出**所有实际源文件**，包括排版脚本、输入以外的资料、字体许可与图像素材。`custom-post.json`自动列入。发现源目录中未声明文件会拒绝封存，不自动猜测哪个是最终版。
- 所有路径用`/`，禁止绝对路径、父目录跳转和源/输出目录链接。素材需实际位于包内；不引用只有本机才能找到的生成缓存。
- 图片可省略，但每页必须有非空实际文字；不因资料页没有配图就判失败。同一场景源图不得重复，必要原文对照只有在相关页都标记`imageRole: evidence`并说明至少8字的`imageReuseReason`时允许；这不等于已经核验素材真实性。

## 发布文字

三份复制文件必须与`publish`完全一致，复用当前小红书保守字段预算：

- `publish-title.txt`：仅标题。
- `publish-body.txt`：正文＋两个换行＋一次话题串。
- `publish-topics.txt`：空格分隔的`#话题`串。

可选`publish.md`采用内置渲染器格式：`# 推荐标题`、`# 正文`、`# 话题`，各段之间两个换行，文件最后一个换行。工具比对其内容，避免审阅稿与复制稿不同。预算通过不表示实际投稿界面已接受。

文字一致性检查仅将Windows的CRLF行尾统一为LF；不裁掉首尾空白、不合并空行、不放宽标点或其他文字。清单摘要仍对原始文件字节计算，封存后只更换行尾也会在审计中报错。

## 封存与复查

完成实际渲染、文字核对与目视检查后运行：

```sh
node scripts/custom-package.cjs seal --dir /absolute/path/to/new-package
node scripts/custom-package.cjs audit --dir /absolute/path/to/new-package
```

Windows可将目录替换为对应绝对路径。`seal`验证后创建`custom-manifest.json`，记录输入、全部声明源文件、逐页PNG和发布文字摘要；已有清单拒绝覆盖。修改内容、图像、源脚本或文案应输出新版本，再封存，不能重签旧版本来掩盖变动。

`audit`只读，不修改清单。源文件、最终图、复制文案被改动、缺失源文件、增加未列PNG、重复页面、页数不一致都会报错。清单将`visualReview`保留为`required`；即使摘要通过，也要单独保存人工审核范围，不把输入中的昵称当作成图中已确认可见，不声称已经做OCR或真机检查。

## 登记历史与修复旧记录

自定义输入的`pages`与历史工具兼容。先用`content-history.cjs check --input`查询，再制作；审计通过后显式登记：

```sh
node scripts/content-history.cjs record --input /absolute/package/source/custom-post.json --out /absolute/package
```

`--out`填实际绝对输出目录，历史目录按本地配置解析。已存在作品修订时增加`--revision-of 实际旧记录ID`，保留旧记录及真实登记时间；不要伪造ID、删除台账或写理由绕过重复。无需另写一份缺少页面和图片的简化历史JSON。

`coverage`应反映实际页面、文字页与图片页数量；图片哈希只能发现完全相同文件，不能代替跨页近似画面检查。seal/audit本身不登记历史，避免重复登记；历史登记成功也不表示已经发布到小红书。
