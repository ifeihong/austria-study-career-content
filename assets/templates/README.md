# 八套小红书设计模板

八套模板各有构图与阅读节奏；S1—S8是独立的信息方向。T1—T3来自用户认可的三个成品，T4—T8扩充摄影、艺术、情境、问答与资料表达。

![八套模板实际封面](../../docs/images/templates-eight.jpg)

| ID | 名称 | 特点 | 输入与完整预览 |
|---|---|---|---|
| T1 | 温暖陪伴叙事 | 暖米白深绿、场景照片、图文解释与叙事推进 | [输入](t1.json) · [9页](../../docs/images/template-t1.jpg) |
| T2 | 雾蓝完整编辑 | 人物文字分区、雾蓝体系、条带比较与步骤卡 | [输入](t2.json) · [7页](../../docs/images/template-t2.jpg) |
| T3 | 暖白酒红精排 | 连续段落、舒适行长、宽栏组件与横向面板 | [输入](t3.json) · [7页](../../docs/images/template-t3.jpg) |
| T4 | 生活摄影杂志 | 大幅照片、方形画框、宋体标题、照片与说明交替 | [输入](t4.json) · [4页](../../docs/images/template-t4.jpg) |
| T5 | 文化艺术画册 | 水彩画面、纸感配色、细框、书卷式章节 | [输入](t5.json) · [4页](../../docs/images/template-t5.jpg) |
| T6 | 轻漫画情境 | 细腻线稿、情境分镜、交替对话框、温暖配色 | [输入](t6.json) · [4页](../../docs/images/template-t6.jpg) |
| T7 | 问答专题编辑 | 问题主导封面、清楚答案、分层解释与条件 | [输入](t7.json) · [4页](../../docs/images/template-t7.jpg) |
| T8 | 实用资料手册 | 清晰表格、字段示例、规则线与注释 | [输入](t8.json) · [4页](../../docs/images/template-t8.jpg) |

共43页样稿，均附实际匹配的发布标题、含适量emoji正文与话题；页数仅演示，后续按内容安排。T4使用三张独立咖啡馆生成照片感场景，T5有两张独立水彩画面，T6有两张关联但不同的漫画场景。T7/T8主要以文字与原生图解承载信息。每页页尾均保留账号昵称。

## T7/T8带图封面变体

原版没有场景配图是有意的资料阅读策略，不是漏做。现在另附[t7-illustrated.json](t7-illustrated.json)（[4页预览](../../docs/images/template-t7-illustrated.jpg)）与[t8-illustrated.json](t8-illustrated.json)（[4页预览](../../docs/images/template-t8-illustrated.jpg)），提供匹配的插画/照片封面，内页保持原版内容。两者是原模板的变体，不是新增两种风格。

可运行`node scripts/select-design.cjs --input assets/templates/selection-example.json`获得方向、模板及是否使用带图变体的建议。按[内容与配图判断](../../references/design-selection.md)使用，不强制每页有图。

```sh
node scripts/render-post.cjs --input assets/templates/t7.json --out output/t7-v01
node scripts/audit-package.cjs output/t7-v01
```

图片、输入与必要素材支持迁移；依赖、字体与浏览器另备。新主题替换内容、素材和发布字段后重新出图，不把示例当成通用事实。流程见[制作工具](../../references/production-tools.md)，选用见[模板指南](../../references/selected-templates.md)。

## 素材性质

T1—T3沿用已认可设计的生成场景；T4沿用原文化样稿的三个关联场景；T5/T6补充四张独立生成的艺术及漫画画面，提示词与来源见[PROMPTS.md](PROMPTS.md)。它们不是真实客户、学校、医院、房源或合作证明，也不是文化史证据。

成品不自动添加AI来源字样；素材对应与声明提醒保存在内部说明，由团队实际发布时手动使用平台声明功能。工具/平台要求保留的已有标识不移除。公开展示也不自动授予第三方素材、品牌与人物的通用再分发权。
