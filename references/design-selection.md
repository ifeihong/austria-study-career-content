# 方向、模板与配图的自动选择

## 先判断任务，再选择视觉

Agent先根据本次内容、受众与实际素材写内部简报，再调用选择器。不是仅凭标题关键词猜模板，也不按固定顺序轮流用八套。

1. 明确主问题：清单、情境、观察、原文、比较、问答、叙事或文化来历；映射到S1—S8。
2. 检查证据、可用媒介与生成能力。真实文件不能用生成图代替；用户明确要某种画面时不能无声降级。
3. 判断文字密度与保护要求。长原稿优先宽栏、完整介绍或资料组件，不为了换风格删掉条件。
4. 按方向、密度和媒介生成模板候选。近期模板使用只作轻度调整，不能压过用户明确选择、证据或长文阅读需求。
5. 为每页决定配图任务。图片能解释场景、动作、物件或关系时使用；资料表和概念页可不配图。写明有图/无图理由。
6. 记录主方向、模板、备选与理由，再试排。实际读起来不舒服时换组件、宽度或页数，不把推荐分数当质量结论。

时间和季节通过选题研究判断；不因月份机械更换模板。历史不足时不声称已覆盖全账号；同文案视觉修订仍关联原作品。

## 可执行选择器

```sh
node scripts/select-design.cjs --input assets/templates/selection-example.json
```

选择器不联网、不写历史、不生成文案或图片。默认只读配置的本地历史，从明确记录的snapshot.template提取最近三个不同作品的模板；不从标题猜模板，不扫描聊天或账号。简报显式recentTemplates时以简报为准。可用--history-dir指定仓库外目录。

| 字段 | 值与作用 |
|---|---|
| purpose | guide/scenario/observation/document/comparison/qa/narrative/culture，分别对应S1—S8 |
| direction | 可明确指定S1—S8，优先于purpose推导 |
| template | 可明确指定T1—T8；工具保留用户选择，有冲突时报告而非擅改 |
| density | low/medium/high；高密度优先宽栏与资料能力，降低近期轮换影响 |
| visualIntent | auto/none/photo/illustration/comic，为媒介偏好 |
| availableMedia | 已有photo/illustration/comic/evidence类型，不代表已核对权限和内容 |
| canGenerate | 可生成photo/illustration/comic；不允许生成evidence |
| evidenceRequired | 是否必须读真实原文或文件；优先T2/T3/T8并检查证据是否存在 |
| imageContext | 图片是否对本篇有实际解释或场景任务；T7/T8有匹配画面时可选带图变体 |
| recentTemplates | 可选、最近在前的模板列表。未提供时读取本地明确记录 |

输出包含方向、模板、理由、两项备选、缺少素材、建议组件与密度处理。ready-for-planning只表示可以继续策划；needs-assets表示仍需素材；needs-review表示用户选择与当前约束存在冲突。分数是编辑启发式，不是科学标定的审美概率。

S4本身属于原文解读，默认要求真实证据，即使简报遗漏evidenceRequired也不会以场景图替代。已有适合媒介时优先考虑可用方案；缺少必要画面时明确列出是否有生成能力。近期风格重复不会迫使高密度长文离开更适合的宽栏方案。

sampleInput是起始示例，不是本篇已完成的内容；实际文字、图像与页面布局仍要按当前简报替换。选择器不自动修改渲染输入，Agent将确认方案写入实际post JSON后制作。

## T7/T8为什么可以没有生成图片

原T7问答版与T8资料手册版的纯文字是有意安排，保持答案、条件、字段与表格清晰。它们具备完整发布文案和实际导出图片，不能将“没有场景配图”误称为“没有生成图文”。

但这不是永久禁图。已附[t7-illustrated.json](../assets/templates/t7-illustrated.json)与[t8-illustrated.json](../assets/templates/t8-illustrated.json)，分别用学习场景插画和资料整理照片提供入口；内页保留原有内容与结构。示例变体共8页，不增加模板编号。

选择原则：场景解释/视觉引入有作用且有合适素材→带图封面或图文解释；密集原文/表格/条件→资料或文字页；没有内容匹配的图→不硬加风景，也不把缺图说成已经完成用户明确的图片要求。每套多图仍使用不同的关联画面，每页页尾保留“奥地利求学就业桔”。
