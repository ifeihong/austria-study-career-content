'use strict';
// Templates control visual treatment; S1–S5 still describe the information task.
const presets={
 T1:{name:'温暖陪伴叙事',theme:{background:'#f8f2e8',ink:'#243d34',accent:'#b66a43'}},
 T2:{name:'雾蓝完整编辑',theme:{background:'#edf3f8',ink:'#203b53',accent:'#b57b4d'}},
 T3:{name:'暖白酒红精排',theme:{background:'#fcf7f3',ink:'#6c2f40',accent:'#bc7857'}}
};
const css=`
.curated{padding:54px 70px 36px;gap:28px}
.curated header{flex:none}.curated .eyebrow{font-size:24px;letter-spacing:1px;padding-bottom:16px}
.curated h1{font-size:63px;font-weight:700;line-height:1.38;letter-spacing:-1px;margin-top:24px;overflow-wrap:normal;word-break:normal;line-break:strict}
.curated .subtitle{font-size:30px;line-height:1.75;margin-top:20px;max-width:none}
.curated h2,.curated p{overflow-wrap:normal;word-break:normal;line-break:strict}
.curated .body{gap:26px}.curated .item{border:0;border-radius:16px;padding:28px 30px;background:#ffffffa8}
.curated .item h2{font-size:35px;line-height:1.55}.curated .item p{font-size:31px;line-height:1.8;margin-top:16px}
.curated .note{font-size:29px;line-height:1.8;padding:22px 26px;border-radius:14px}
.curated .foot{font-size:24px;letter-spacing:.5px;min-height:52px}
.curated.poster h1{font-size:76px;line-height:1.32;margin-top:24px}
.curated.poster .media img{height:550px;border-radius:20px}
.curated.poster .items{grid-template-columns:1fr;gap:0}
.curated.poster .item{padding:20px 0 0;border:0;background:transparent}
.curated.poster .item h2{font-size:31px;line-height:1.7}.curated.poster .item p{font-size:30px;line-height:1.8;margin-top:10px}
.curated.cards .items{gap:26px;grid-auto-rows:1fr;flex:1}
.curated.cards .item{border-top:3px solid var(--accent);padding:30px;justify-content:center;min-height:290px}
.curated.cards .item h2{font-size:37px}.curated.cards .item p{font-size:31px;line-height:1.8}
.curated.feature .media img{height:430px}
.curated.feature-aside .body{display:grid;grid-template-columns:1fr 1fr;gap:26px 34px;align-content:start}
.curated.feature-aside .media{grid-column:2;grid-row:1;height:760px}
.curated.feature-aside .media img{height:100%;border-radius:20px}
.curated.feature-aside .items{grid-column:1;grid-row:1;gap:0;align-self:stretch}
.curated.feature-aside .item{padding:22px 0;border-bottom:1px solid #927c7738;background:transparent;border-radius:0}
.curated.feature-aside .item h2{font-size:32px}.curated.feature-aside .item p{font-size:30px;line-height:1.75}
.curated.feature-aside .note{grid-column:1/-1}
.curated.bands .items{gap:24px;flex:1;grid-auto-rows:1fr}.curated.bands .item{border:1px solid #927c7738;padding:28px 32px;display:flex;flex-direction:column;justify-content:center}
.curated.bands .item:nth-child(2){background:color-mix(in srgb,var(--accent) 13%,var(--bg))}
.curated.bands .item h2{font-size:36px}.curated.bands .item p{font-size:31px;line-height:1.85;margin-top:15px}
.curated.metric-panels .items{display:grid;grid-template-columns:1fr 1fr;gap:28px;flex:1}
.curated.metric-panels .item{padding:32px;display:flex;flex-direction:column;gap:22px;border:1px solid #927c7738;justify-content:center}
.curated.metric-panels .item:nth-child(2){background:var(--ink);color:var(--bg)}
.curated.metric-panels .item h2{font-size:34px;line-height:1.6}
.curated.metric-panels .metric{font-family:Georgia,'Microsoft YaHei',serif;font-size:87px;line-height:1.25;font-weight:400;letter-spacing:-3px;margin:24px 0}
.curated.metric-panels .metric small{font-family:'Microsoft YaHei','Noto Sans CJK SC',sans-serif;font-size:28px;letter-spacing:0;margin-left:10px}
.curated.metric-panels .item p{font-size:30px;line-height:1.85;margin:0;white-space:pre-line}
.curated.service-grid .items{grid-template-columns:1fr 1fr;grid-auto-rows:1fr;flex:1;gap:0 32px;background:color-mix(in srgb,var(--accent) 10%,var(--bg));border-radius:18px;padding:12px 28px}
.curated.service-grid .item{padding:28px 0;background:transparent;border-bottom:1px solid #927c7738;border-radius:0;display:flex;flex-direction:column;justify-content:center}
.curated.service-grid .item h2{font-size:32px}.curated.service-grid .item p{font-size:30px;line-height:1.8}
.curated.step-grid .items{grid-template-columns:1fr 1fr;grid-auto-rows:1fr;flex:1;gap:0 38px}
.curated.step-grid .item{padding:26px 0 26px 70px;min-height:172px;background:transparent;border-radius:0;border-top:1px solid #927c7760}
.curated.step-grid .number{left:0;top:29px;font-family:Georgia,serif;font-size:48px;font-weight:400;border:0;padding:0}
.curated.step-grid .item h2{font-size:32px;line-height:1.7}.curated.step-grid .item p{font-size:29px;margin-top:10px;line-height:1.75}
.curated.worksheet table{font-size:30px;line-height:1.8;flex:initial}.curated.worksheet td{padding:26px 23px}
.template-T2 .item{box-shadow:0 8px 24px #203b5309}.template-T2 .note{border-radius:0 18px 18px 0;border-left:5px solid var(--accent)}
.template-T2.poster .body{display:grid;grid-template-columns:1fr 1.1fr;gap:30px;align-content:start}
.template-T2.poster .media{grid-column:2;grid-row:1}.template-T2.poster .media img{height:660px;border-radius:120px 20px 20px 20px}
.template-T2.poster .items{grid-column:1;grid-row:1;align-self:center}.template-T2.poster .item{padding:25px 0;box-shadow:none;border-bottom:1px solid #203b5330}
.template-T2.poster .note{grid-column:1/-1}
.template-T2.poster .media{position:relative;background:radial-gradient(ellipse at 50% 65%,#d6e4f1 0 48%,transparent 49%)}
.template-T2.bands .item{display:grid;grid-template-columns:280px 1fr;gap:30px;align-items:center;padding:32px}
.template-T2.bands .item p{margin:0;border-left:1px solid #a9bfce;padding-left:28px}
.template-T2.step-grid .items{gap:22px 26px}.template-T2.step-grid .item{padding:28px 25px 28px 108px;background:#fbfdff;border:1px solid #c6d8e6;border-radius:16px}
.template-T2.step-grid .number{left:24px;color:#3165bd}
.template-T2.service-grid .item{box-shadow:none}
.template-T2.metric-panels .items,.template-T3.metric-panels .items{grid-template-columns:1fr;gap:28px}
.template-T2.metric-panels .item,.template-T3.metric-panels .item{display:grid;grid-template-columns:310px 1fr;gap:20px 35px;align-content:center;padding:32px 36px}
.template-T2.metric-panels .item h2,.template-T3.metric-panels .item h2{grid-column:1/-1}
.template-T2.metric-panels .metric,.template-T3.metric-panels .metric{grid-column:1;align-self:center;margin:18px 0;font-size:83px}
.template-T2.metric-panels .item p,.template-T3.metric-panels .item p{grid-column:2;align-self:center;border-left:1px solid #927c7760;padding-left:30px}
.template-T3.bands .item{padding:27px 32px}.template-T3.bands .item p{line-height:1.9}
`;
module.exports={presets,css};
