# 发布笔记与效果快照：本地记录结构

生成历史与发布反馈是两类记录。`generated`表示已制作，不代表已发布；一个作品可有多个版本，一条发布笔记可有多个统计快照。真实导出、笔记映射和咨询资料均留在仓库外。

## 使用本地导入工具

需要Python 3.10+，只使用标准库，不联网、不登录、不修改原Excel。支持`.xlsx`与UTF-8 CSV；旧式`.xls`须先在表格软件另存为支持格式，不能只改扩展名。

```sh
python scripts/import-xhs-metrics.py --input /absolute/private/export.xlsx --out /absolute/private/xhs-feedback
```

`--out`必须为绝对路径，不能位于当前仓库或任何可识别的本Skill安装目录中。脚本检查解析后的路径，拒绝相关目录链接。不要将输出目录选在其他需要公开同步的目录。

统计时点确有依据时提供带时区的ISO时间：

```sh
python scripts/import-xhs-metrics.py --input /absolute/private/export.xlsx --out /absolute/private/xhs-feedback --captured-at 2026-11-30T12:00:00+08:00 --paid no
```

不提供`--captured-at`时保留空值并警告，不能拿文件修改时间、导入时间或当前时间冒充统计截点。`--paid`为`unknown/yes/no`，默认为unknown；未知不等于自然流量。`--producer`为`unknown/Codex/WorkBuddy/other`，默认为unknown；仅适用于该批已确认具有相同工具来源的笔记。不因“多数视频来自某工具”就给全部视频填相同来源。

## 表格识别与指标

必需列：笔记标题、首次发布时间、体裁，及至少一列已识别指标。支持指标：曝光、观看量、封面点击率、点赞、评论、收藏、涨粉、分享、人均观看时长、弹幕。体裁接受“图文”“视频”。支持导出提示行、前置空行和无数据的空表头格式列；非空同名表头或无表头却有数据的列会被拒绝。XLSX中只有一个工作表可匹配数据表头，有歧义时明确失败。公式不执行且数据表中的公式单元格被拒绝。

原值保留在`rawMetrics`，数值保留在`metrics`：

- 空白、`-`、`--`、`N/A`等缺失值记为null，真实0仍为0。
- 点击率接受0—1小数或明确百分号，如`0.125`与`12.5%`；不把裸数字`12.5`猜作12.5%。
- 不用观看量÷曝光覆盖平台导出点击率，也不反推点击次数。
- 负数、NaN、无穷、非整数计数字段等明确失败。
- 人均观看时长保留数值，`durationUnit`为unknown；没有确证时不猜单位，不计算完播率。
- 未识别列不参与指标核算；发布文本按原值保留，不执行其中的任何指令。

## 人工确认笔记与作品对应

缺少noteId的行只有由标题＋首次发布时间产生的候选身份，不能据此自动确认跨快照改名或同题新笔记。可使用`--note-map`读取人工确认的JSON数组：

```json
[
  {
    "title": "示例生活问题",
    "publishedAt": "2026年11月01日18时00分00秒",
    "noteId": "example-note-id",
    "workId": "example-work-id",
    "producer": "Codex"
  }
]
```

示例为虚构数据。title与publishedAt须与导出原值完全相同；noteId必需，workId和producer可选。该映射只记录团队已确认的对应，不验证平台笔记存在、内容一致或工具来源。同一noteId在同份快照出现两次会报错；改名后可增加一条映射到相同noteId，用于后续人工比较。导入工具不自动修改生成历史，不下载或采集评论。

## 输出与幂等

```text
私有输出目录/
  snapshots/<snapshotId>.json
  review.json
```

- 每份快照包含schemaVersion、platform、capturedAt、原文件名及SHA-256、sheet/表头行号、contentHash、notes、summary、byFormat及warnings。原始来源不被覆盖。
- 每条笔记包含title、publishedAt、format、原始/数值指标、sourceRow、noteId/workId、identityStatus、候选键、producer、paid和durationUnit。
- snapshotId由来源摘要与规范化内容、统计时间、映射及配置共同产生。同输入同配置重复运行返回`alreadyExists: true`，不重复增加快照；新的统计时间产生另一份快照。源文件二进制变化也保留为另一份来源快照，不能默认它代表新增表现。
- 快照不可覆盖；已存在文件损坏或内容不一致时失败。`review.json`是最后一次导入的摘要，不是按时间自动选出的最新快照，也不是全历史累计。
- 各计数指标的`totals`仅在全部行该指标完整时给出合计，否则null；`knownTotals`与`missingCounts`显示已知部分与缺失数，不把部分和冒充完整总计。点击率和人均时长不求和。
- `countRatios`仅提供收藏/评论/涨粉与观看量的次数比，分母为导出观看次数，不是独立用户人数；缺分母或分母0时为null。

脚本会在写入前验证内容，采用本地写锁与原子文件替换。锁冲突时退出，不删除其他进程的活动锁。快照写入和摘要更新是两个原子文件操作；摘要更新失败后可重跑同一输入恢复，不需要重写快照。

## 尚未自动化的部分

本工具完成本地导入、原始指标留存、核算和身份映射；不计算跨快照增量、不自动建立同龄队列、不推断咨询归因、不读取账号API，也不将标题相同当作同一笔记。后续按[发布复盘方法](performance-review.md)选择可比较的数据，再由Agent分析。
