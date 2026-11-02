# V10：正式图文设计起点

三套完整样稿分别验证生活文化、护理知识、家庭规划的图片与信息编排。每套四页，带实际 AI 配图、可控文字、发布文案与可迁移源；四页不是后续内容的固定要求。

| 输入文件 | 页面关系 | 素材性质 |
|---|---|---|
| [culture.json](culture.json) | 图片封面—细节解释—活动偏好—自然提问 | 三张同风格独立咖啡馆 AI 场景，不是某店实拍 |
| [nursing.json](nursing.json) | 图片封面—四环节对照—资料工作表—下一项任务 | 新生成职业情境插画，人物不是客户或见证人 |
| [family.json](family.json) | 图片封面—生活假设—预算工作表—家庭讨论 | 早期 DEMO 家庭封面 + 新生成家庭讨论图，不是真实家庭案例 |

这些是能实际制作的设计示例，不是最终内容必须照抄的文案。护理与家庭样稿以方法说明为主，不含具体资格、薪资、当地报价或结果承诺。文化稿的出处链接在正文与 [来源说明](../../references/knowledge-lifestyle-culture.md) 中，图片不作文化史证据。

执行示例：

```sh
node scripts/render-post.cjs --input assets/editorial/family.json --out output/family-editorial-v01
```

需要 Node.js、Playwright、可用浏览器和中文字体；详见 [运行指南](../../references/production-tools.md)。导出后逐页与手机尺寸检查，保留内容与视觉两项验收记录。生成器使用明确的 `design: "editorial"`；省略 design 时仍保留 basic 兼容行为，不表示 basic 就是正式图文默认设计。

配图在 [media](media/)；生成/复用记录见 [PROMPTS.md](PROMPTS.md)。图片只说明场景，不把文中的地区、身份或个案当作真实故事。生成素材和品牌资源不因放在公共仓库就自动具有通用再分发授权。

正式生产方法见 [视觉制作与验收](../../references/visual-production.md)。旧基础示例保留作工具回归，不作为本品牌正式成品的默认视觉质量线。

同套生成主图不重复：文化三张对应空间、物件与阅读；家庭两张对应共同规划与表达需求。文字对照/工作表不强制加图。配图规划与提示词见 [PROMPTS.md](PROMPTS.md)。

三套各有独立匹配的发布标题、含 emoji 正文和 5 个相关话题，保存在对应 JSON 的 publish 字段。导出后使用 publish-title.txt 和 publish-body.txt 分别复制；publish-topics.txt 供独立选择话题时使用，不重复追加。内部统计见 publish-check.json，实际计数和话题挂接按当前投稿界面确认。
