# 配图生成与复用记录

## V10.1 同套延伸配图清单

| 页面 | 素材 | 新增画面任务 | 保持统一 |
|---|---|---|---|
| 文化封面 | coffeehouse.png | 桌面与空间氛围 | 暖光、奶油石材、墨绿、弯木家具 |
| 文化细节 | coffeehouse-details.png | 新的桌椅纵深和报纸架 | 同上 |
| 文化收束 | coffeehouse-reading.png | 阅读动作与书本近景 | 同上 |
| 家庭封面 | family-planning.png | 一起规划 | 暖色绘画、虚构家庭特征与服装 |
| 家庭讨论 | family-discussion.png | 孩子表达想法、卡片与资料夹 | 同上 |

以下三张通过内置 image_gen 以原封面为风格参考，分别独立生成；原封面未改。完成后检查了场景/动作差异，不能用裁切或改名替代新图。护理样稿只有一张配图，没有同套重复。

### coffeehouse-details.png

```text
Use reference only as visual style and fictional cafe continuity. Generate a NEW horizontal 3:2 editorial photograph-style scene, NOT a crop/recolor of reference. Same warm cream stone, forest green upholstery, bentwood furniture, soft golden natural light. New wide diagonal composition looking along several small marble tables toward a freestanding traditional wooden newspaper reading rack holding folded blank newspapers, with chairs clearly visible. Emphasize objects and spatial use; no main cup still-life foreground, no people, no readable print, logo or watermark. Plausible fictional Viennese-style cafe, not documentary or an identifiable business.
```

### coffeehouse-reading.png

```text
Use reference only as visual style and fictional cafe continuity. Generate a NEW horizontal 3:2 editorial photograph-style close scene from above and side of a quiet window-side reading corner. A new composition showing an open blank cream book, reading glasses and one hand of an anonymous adult turning a page, edge of small marble table, curved bentwood chair and muted dark green upholstery, soft warm cream and golden light, small distant coffee cup secondary. No newspaper stack, no duplicate reference composition, no readable text, logos or watermark. Fictional cafe illustration, no identifiable real business or location.
```

### family-discussion.png

```text
Use reference as style and fictional character continuity ONLY. Generate NEW horizontal 3:2 premium warm gouache painterly editorial illustration, same fictional East Asian mother with loose dark hair and dark green sweater, father glasses dark green shirt, school-age girl cream sweater, warm cream/sage/apricot palette. Different scene and perspective: three-quarter side view from the mother's shoulder, father listening while daughter shows a small blank note and mother arranges three separate plain cream cards on a wooden dining table. A closed green folder and pencil, no cups and fruit foreground; softly blurred home bookshelves and plant background, NO landmark window view. Natural relaxed expressions and convincing hands. No readable text, numbers, logos, certificates, money or watermark. Fictional family discussion not clients; not a crop or remake of reference.
```


工具：内置 image_gen。新图生成于 2026-11-02，随后复制到本项目。没有用程序生成摄影/插画占位；关键中文与署名均由排版层制作。以下是实际生成提示词，图片用于虚构说明场景，不作亲历或客户证据。

## coffeehouse.png

```text
Create a sophisticated editorial photograph-style illustration asset for a Chinese educational social media post about Viennese coffeehouse culture. Horizontal 3:2 landscape composition, no text no logo no watermark. Beautiful plausible historic Viennese-style cafe interior: small white marble round table, one porcelain coffee cup and glass of water, neatly folded blank newspaper with no legible print, bentwood chairs, soft tall window light, warm cream stone walls and muted sage-green upholstery, natural morning sunlight, calm lived-in textures. An elegant intimate still life with visual depth, not stock photo, no people, no identifiable actual cafe or claimed landmark, no giant food spread. Palette cream, forest green and tiny burnt orange details. Frame table and window carefully so usable even as a medium-width crop. This is a fictional scene illustration, not documentary evidence.
```

成图检查：桌面、杯子、玻璃杯和椅子用于氛围与观察任务；窗外建筑不标具体地标。报纸不得视为可阅读真实资料。成品加“AI 场景示意”。

## nursing-study.png

```text
Create a premium warm editorial gouache watercolor illustration asset for a Chinese nursing career preparation educational post. Horizontal 3:2 landscape composition, no text no logos no watermark, no generated writing anywhere. A fictional young adult East Asian nursing graduate in simple pale sage scrubs seated at a warm oak desk, thoughtfully comparing plain blank paper documents and a closed dark-green folder, a modest cream notebook, pencil, small calendar with blank cells and a potted plant. No patient, no hospital signage, no medical treatment, no stethoscope used as a gimmick, no certifications or money. Beautiful convincing hands holding a blank page, dignified and calm, soft natural window light, layered painterly details with elegant negative space. Restrained cream, forest green, apricot and burnt orange palette, sophisticated magazine illustration rather than flat corporate clipart. Clearly fictional educational scenario, not a real nurse or customer.
```

成图检查：人物学习与整理资料，未表现诊疗或患者；纸张与日历不作有效材料。成品加“AI 职业情境插画”，不称奥地利在岗护士或客户。

## family-planning.png

复用本项目早期五风格 DEMO 的 s2 AI 家庭插画，未修改原文件。家庭围坐讨论与预算主题匹配，窗外建筑仅为 AI 情境，不标现实住址或实拍地点。沿用生成性质，在成品上标“AI 家庭情境插画”，不称真实客户案例。原始早期提示词不在本轮重构或补猜。
