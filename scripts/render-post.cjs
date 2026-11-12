'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const history=require('./content-history.cjs');
const templates=require('./visual-templates.cjs');
const STYLES=['S1','S2','S3','S4','S5','S6','S7','S8'];
const EDITORIAL_LAYOUTS=['poster','feature','cards','worksheet','journey','bands','metric-panels','service-grid','step-grid','feature-aside','qa','dialogue'];
const LAYOUTS=['cover','checklist','steps','table','split',...EDITORIAL_LAYOUTS];
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
function need(ok,message){if(!ok)throw new Error(message);}
function text(value,label,required=false){need(typeof value==='string'&&(!required||value.trim().length>0),label+' must be text');}
function keys(value,allowed,label){for(const key of Object.keys(value))need(allowed.includes(key),'Unknown '+label+' field: '+key);}
function readJson(file){return JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));}
// Conservative local profile for standard image-text notes, not a replica of the platform counter.
// Recheck the dated evidence and live editor before changing: references/xiaohongshu-publish-fields.md.
function publishStats(publish){
 const topicsText=publish.topics.map(t=>'#'+t).join(' ');
 const bodyWithTopics=publish.body+'\n\n'+topicsText;
 return {profile:'xhs-standard-conservative-2026-11-02',countMethod:'UTF-16 code units; includes spaces, newlines, emoji and topic text',titleUnits:publish.title.length,bodyUnits:publish.body.length,bodyWithTopicsUnits:bodyWithTopics.length,topicCount:publish.topics.length,titleBudget:20,bodyWithTopicsBudget:1000,topicEditorialCap:8,platformEditorVerified:false};
}
function validatePublish(publish){
 need(publish&&typeof publish==='object'&&!Array.isArray(publish),'publish must be an object');
 keys(publish,['title','body','topics'],'publish');text(publish.title,'publish title',true);text(publish.body,'publish body',true);
 need(!/[\r\n]/.test(publish.title),'publish title must be a single line');
 need(Array.isArray(publish.topics)&&publish.topics.length>0,'topics must be a nonempty array');
 publish.topics=publish.topics.map(v=>{text(v,'topic',true);const t=v.trim().replace(/^#/, '').normalize('NFC');need(/^[\p{L}\p{N}_]+$/u.test(t),'Invalid topic format: use a single name without spaces, punctuation or emoji');return t;});
 need(new Set(publish.topics.map(t=>t.toLowerCase())).size===publish.topics.length,'Duplicate topic');
 const stats=publishStats(publish);
 need(stats.titleUnits<=20,'publish title exceeds the local 20-unit standard-note budget');
 need(stats.bodyWithTopicsUnits<=1000,'publish body including topics exceeds the local 1000-unit standard-note budget');
 need(stats.topicCount<=8,'Use at most 8 topics under the local editorial cap, not a verified platform maximum');
 return publish;
}
function validatePost(input){
 need(input&&typeof input==='object'&&!Array.isArray(input),'Post must be an object');
 keys(input,['title','brand','style','theme','design','template','pages','publish'],'post');
 const post=structuredClone(input);text(post.title,'title',true);
 post.brand??='奥地利求学就业桔';text(post.brand,'brand',true);need(post.brand==='奥地利求学就业桔','Brand must be 奥地利求学就业桔; preserve the 桔 character');
 post.style??='S1';need(STYLES.includes(post.style),'Unknown global style');
 post.design??='basic';need(['basic','editorial'].includes(post.design),'Unknown design mode');
 if(post.template!==undefined){need(Object.hasOwn(templates.presets,post.template),'Unknown template');need(post.design==='editorial','Template requires editorial design');}
 post.theme??={};need(post.theme&&typeof post.theme==='object'&&!Array.isArray(post.theme),'theme must be an object');
 for(const [k,v] of Object.entries(post.theme))need(['background','ink','accent'].includes(k)&&typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v),'Invalid theme color');
 if(post.template)post.theme={...templates.presets[post.template].theme,...post.theme};
 need(Array.isArray(post.pages)&&post.pages.length>0,'pages must be a nonempty array');
 const ids=new Set();
 for(const p of post.pages){
  need(p&&typeof p==='object'&&!Array.isArray(p),'Each page must be an object');
  keys(p,['id','title','layout','style','subtitle','eyebrow','note','imageLabel','image','imageFit','imageHeight','imageFocus','imageRole','imageReuseReason','items','columns','rows'],'page');
  need(typeof p.id==='string'&&/^[a-z0-9][a-z0-9-]{0,48}$/.test(p.id),'Invalid page ID');
  need(!ids.has(p.id),'Duplicate page ID');ids.add(p.id);
  text(p.title,'page title',true);p.layout??='checklist';need(LAYOUTS.includes(p.layout),'Unknown page layout');
  if(EDITORIAL_LAYOUTS.includes(p.layout))need(post.design==='editorial','Editorial layout requires editorial design');
  if(['bands','metric-panels','service-grid','step-grid','feature-aside','qa','dialogue'].includes(p.layout))need(post.template,'Curated layout requires a template');
  if(['poster','feature','feature-aside'].includes(p.layout))need(p.image!==undefined,'Image-led layout requires image');
  if(p.style!==undefined)need(STYLES.includes(p.style),'Unknown page style');
  for(const k of ['subtitle','eyebrow','note','imageLabel'])if(p[k]!==undefined)text(p[k],k);
  if(p.image!==undefined){text(p.image,'image',true);need(!/^[a-z]+:/i.test(p.image)&&!path.isAbsolute(p.image)&&!p.image.split(/[\\/]/).includes('..'),'image must be a local relative path without parent traversal');}
  for(const field of ['imageLabel','imageFit','imageHeight','imageFocus','imageRole','imageReuseReason'])if(p[field]!==undefined)need(p.image!==undefined,field+' requires image');
  if(p.imageRole!==undefined)need(['scene','evidence'].includes(p.imageRole),'Unknown imageRole');
  if(p.imageReuseReason!==undefined){text(p.imageReuseReason,'imageReuseReason',true);need(p.imageRole==='evidence'&&p.imageReuseReason.trim().length>=8,'Image reuse requires evidence role and a specific reason');}
  if(p.imageFit!==undefined)need(['contain','cover'].includes(p.imageFit),'Invalid imageFit');
  if(p.imageHeight!==undefined)need(Number.isInteger(p.imageHeight)&&p.imageHeight>=160&&p.imageHeight<=800,'imageHeight must be 160 to 800 pixels');
  if(p.imageFocus!==undefined){need(p.imageFocus&&typeof p.imageFocus==='object'&&!Array.isArray(p.imageFocus),'imageFocus must be an object');keys(p.imageFocus,['x','y'],'imageFocus');for(const axis of ['x','y'])need(Number.isFinite(p.imageFocus[axis])&&p.imageFocus[axis]>=0&&p.imageFocus[axis]<=100,'imageFocus coordinates must be 0 to 100');}
  p.items??=[];need(Array.isArray(p.items),'items must be an array');
  for(const item of p.items){need(item&&typeof item==='object'&&!Array.isArray(item),'item must be an object');keys(item,['heading','text','value','unit'],'item');text(item.heading,'item heading',true);if(item.text!==undefined)text(item.text,'item text');
   for(const field of ['value','unit'])if(item[field]!==undefined){text(item[field],field,true);need(p.layout==='metric-panels',field+' requires metric-panels');}
   if(item.unit!==undefined)need(item.value!==undefined,'unit requires value');
  }
  if(!['table','worksheet'].includes(p.layout))need(p.columns===undefined&&p.rows===undefined,'columns and rows require table or worksheet layout');
  if(['table','worksheet'].includes(p.layout)){
   need(Array.isArray(p.columns)&&p.columns.length>0,'table columns required');p.columns.forEach(v=>text(v,'column',true));
   need(Array.isArray(p.rows),'table rows required');
   for(const row of p.rows){need(Array.isArray(row)&&row.length===p.columns.length,'Row must match table column count');row.forEach(v=>text(v,'cell'));}
  }
 }
 if(post.publish!==undefined)post.publish=validatePublish(post.publish);
 return post;
}
function readImage(root,relative){
 const base=fs.realpathSync(root),file=fs.realpathSync(path.resolve(root,relative));const rel=path.relative(base,file);
 need(rel!==''&&rel!=='..'&&!rel.startsWith('..'+path.sep)&&!path.isAbsolute(rel),'Image must remain inside input directory');
 const mime={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'}[path.extname(file).toLowerCase()];
 need(mime,'Unsupported local image format');const bytes=fs.readFileSync(file);
 return {bytes,mime,data:'data:'+mime+';base64,'+bytes.toString('base64'),extension:path.extname(file).toLowerCase()};
}
const CSS=`*{box-sizing:border-box}body{margin:0;background:#e8e5dd;color:#21372f;font-family:'Microsoft YaHei','PingFang SC','Noto Sans CJK SC',sans-serif}.page{--bg:#f7f3e9;--ink:#21372f;--accent:#cd5b30;width:1080px;height:1440px;padding:64px 72px 42px;background:var(--bg);color:var(--ink);display:flex;flex-direction:column;gap:27px;overflow:hidden}.style-S2{--bg:#f9e9d8}.style-S3{--bg:#edf0eb}.style-S4{--bg:#e9ede8}.style-S5{--bg:#f4f3e5}.eyebrow{font-size:27px;line-height:1.5;color:var(--ink);opacity:.7;border-bottom:2px solid #b8b6a660;padding-bottom:20px}h1{font-size:75px;line-height:1.25;letter-spacing:-1px;white-space:pre-line;overflow-wrap:anywhere;margin:24px 0 0}h1.cover-title{font-size:92px}.subtitle{font-size:34px;line-height:1.6;margin:20px 0 0;white-space:pre-line}.body{flex:1;min-height:0;overflow:hidden}.media{margin:0 0 24px}.media img{display:block;width:100%;height:330px;object-fit:contain}.style-S2 .media img,.style-S3 .media img{object-fit:cover}.cover.has-image .items{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.cover.has-image .item{padding:16px 0}.cover.has-image .item h2{font-size:30px}.cover.has-image .item p{font-size:31px}.media figcaption{font-size:26px;line-height:1.5;margin-top:10px;opacity:.72}.item{border-bottom:2px solid #b8b6a660;padding:23px 0}.item h2{font-size:39px;line-height:1.45;margin:0;white-space:pre-line}.item p{font-size:33px;line-height:1.65;margin:12px 0 0;white-space:pre-line;overflow-wrap:anywhere}.steps .item{padding-left:85px;position:relative}.number{position:absolute;left:0;top:25px;font-size:36px;font-weight:700;color:var(--accent)}.split .items{display:grid;grid-template-columns:1fr 1fr;gap:0 28px}.note{border-left:7px solid var(--accent);padding:13px 0 13px 24px;font-size:30px;line-height:1.7;margin-top:27px;white-space:pre-line}table{width:100%;border-collapse:collapse;font-size:31px;line-height:1.65}th{text-align:left;background:#dce2d55c;padding:21px 14px;font-size:29px}td{padding:24px 14px;border-bottom:2px solid #b8b6a660;white-space:pre-line;overflow-wrap:anywhere}td:first-child{font-weight:700}.foot{flex:none;display:flex;justify-content:space-between;align-items:end;border-top:2px solid #b8b6a660;padding-top:20px;gap:24px;font-size:25px;line-height:1.5}.foot span:last-child{white-space:nowrap}.emoji{font-family:'Segoe UI Emoji',sans-serif}`;
// Style families vary hierarchy and grouping as well as palette; complex artwork remains external.
const STYLE_CSS=`.style-S2 .items{display:grid;gap:18px}.style-S2 .item{border:0;border-radius:24px;background:#ffffff70;padding:20px 24px}.style-S2 .item h2{font-size:36px}.style-S2.steps .item{padding-left:92px}.style-S2 .number{left:24px}.style-S3 h1{border-left:10px solid var(--accent);padding-left:26px}.style-S3 .eyebrow{letter-spacing:2px}.style-S3 .item{border-bottom:0;padding:22px 0}.style-S4 th{background:var(--ink);color:var(--bg)}.style-S4 .item{border-left:4px solid var(--accent);padding:16px 22px;margin-bottom:18px}.style-S4 .item h2{font-size:36px}.style-S4.steps .item{padding-left:90px}.style-S4 .number{left:20px}.style-S5.steps .item{padding-left:96px;border-bottom:0;border-left:3px solid #b8b6a660}.style-S5 .number{left:16px;top:24px;border:2px solid var(--accent);border-radius:12px;padding:3px 9px;font-size:30px}.style-S5.split .item{border-top:5px solid var(--accent);border-bottom:0;padding-top:24px}`;
const EDITORIAL_CSS=`
.editorial{padding:54px 64px 38px;gap:22px;background:var(--bg)}
.editorial .eyebrow{font-size:25px;letter-spacing:2px;padding-bottom:17px;border-bottom:2px solid #21372f25}
.editorial h1{font-size:70px;line-height:1.18;letter-spacing:-2px;margin-top:26px;border:0;padding:0;font-weight:800}
.editorial .subtitle{font-size:33px;line-height:1.55;margin-top:20px;max-width:880px;opacity:.88}
.editorial .body{display:flex;flex-direction:column;gap:22px}
.editorial .items{display:grid;gap:18px}
.editorial .item{position:relative;padding:26px 28px;border:0;margin:0;background:#ffffff8c;border-radius:20px}
.editorial .item h2{font-size:36px;line-height:1.35;margin:0}
.editorial .item p{font-size:31px;line-height:1.65;margin-top:14px}
.editorial .note{margin:0;padding:22px 26px;border:0;background:var(--ink);color:var(--bg);font-size:29px;line-height:1.6;border-radius:14px}
.editorial .foot{font-size:24px;border-top:2px solid #21372f25;padding-top:17px}
.editorial .media{margin:0;flex:none}
.editorial .media img{border-radius:18px;width:100%;object-fit:cover}
.editorial .media figcaption{font-size:24px;line-height:1.4;margin-top:8px}
.editorial.poster h1{font-size:92px;line-height:1.16;max-width:940px;margin-top:28px}
.editorial.poster .media img{height:550px}
.editorial.poster .items{grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
.editorial.poster .item{background:transparent;border-radius:0;padding:22px 0 0;border-top:3px solid var(--accent)}
.editorial.poster .item h2{font-size:30px}
.editorial.poster .item p{font-size:28px;margin-top:9px;line-height:1.5}
.editorial.poster .note{font-size:28px;padding:15px 22px}
.editorial.cards .items{grid-template-columns:repeat(2,minmax(0,1fr));flex:1;grid-auto-rows:1fr;gap:24px}
.editorial.cards .item{padding:38px 32px;border-top:7px solid var(--accent);display:flex;flex-direction:column;justify-content:center;background:#ffffffa8}
.editorial.cards .item h2{font-size:42px}
.editorial.cards .item p{font-size:33px;line-height:1.7}
.editorial.cards .item:nth-child(2),.editorial.cards .item:nth-child(3){background:#21372f0b}
.editorial.feature .media img{height:380px}
.editorial.feature .items{grid-template-columns:repeat(2,minmax(0,1fr));gap:22px}
.editorial.feature .item{padding:25px 28px;border-left:5px solid var(--accent)}
.editorial.feature .item h2{font-size:35px}
.editorial.feature .item p{font-size:30px;line-height:1.6}
.editorial.worksheet table{font-size:32px;line-height:1.7;table-layout:fixed;flex:1}
.editorial.worksheet th{background:var(--ink);color:var(--bg);font-size:29px;padding:22px 23px}
.editorial.worksheet th:first-child{width:28%}
.editorial.worksheet td{padding:28px 23px;vertical-align:middle;background:#ffffff80;border-bottom:2px solid #21372f20}
.editorial.worksheet td:first-child{width:28%;color:var(--accent)}
.editorial.worksheet .item{padding:22px 28px}
.editorial.journey .items{flex:1;gap:22px}
.editorial.journey .item{padding:30px 32px 30px 115px;display:flex;flex-direction:column;justify-content:center;background:#ffffffad;border-radius:18px}
.editorial.journey .number{left:26px;top:32px;font-size:43px;line-height:1.3;padding:0;border:0;color:var(--accent);font-weight:800}
.editorial.journey .item h2{font-size:40px}
.editorial.journey .item p{font-size:32px;line-height:1.6}
.editorial.split .items{grid-template-columns:1fr 1fr;flex:1}
.editorial.checklist .items,.editorial.steps .items{flex:1}
`;
function pageHtml(post,p,index,asset){
 const label=(key,value)=>`data-text-key="${esc(p.id+'.'+key)}"`;
 const style=p.style||post.style;const theme=Object.entries(post.theme).map(([k,v])=>'--'+({background:'bg',ink:'ink',accent:'accent'}[k])+':'+v).join(';');
 const framing=[p.imageHeight!==undefined?'height:'+p.imageHeight+'px':'',p.imageFit?'object-fit:'+p.imageFit:'',p.imageFocus?'object-position:'+p.imageFocus.x+'% '+p.imageFocus.y+'%':''].filter(Boolean).join(';');
 const media=asset?`<figure class="media"><img alt="${esc(p.imageLabel||'主题素材')}" style="${framing}" src="${asset.data}">${p.imageLabel?'<figcaption '+label('imageLabel')+'>'+esc(p.imageLabel)+'</figcaption>':''}</figure>`:'';
 const items=p.items.map((item,i)=>`<div class="item">${['steps','journey','step-grid'].includes(p.layout)?'<span class="number">'+String(i+1).padStart(2,'0')+'</span>':''}<h2 ${label('items.'+i+'.heading')}>${esc(item.heading)}</h2>${item.value!==undefined?'<div class="metric"><span '+label('items.'+i+'.value')+'>'+esc(item.value)+'</span>'+ (item.unit?'<small '+label('items.'+i+'.unit')+'>'+esc(item.unit)+'</small>':'')+'</div>':''}${item.text?'<p '+label('items.'+i+'.text')+'>'+esc(item.text)+'</p>':''}</div>`).join('');
 const table=['table','worksheet'].includes(p.layout)?`<table><thead><tr>${p.columns.map((c,i)=>'<th '+label('columns.'+i)+'>'+esc(c)+'</th>').join('')}</tr></thead><tbody>${p.rows.map((row,i)=>'<tr>'+row.map((c,j)=>'<td '+label('rows.'+i+'.'+j)+'>'+esc(c)+'</td>').join('')+'</tr>').join('')}</tbody></table>`:'';
 const templateClass=post.template?((post.template==='T1'&&!['bands','metric-panels','service-grid','step-grid','feature-aside','qa','dialogue'].includes(p.layout)?'':'curated ')+'template-'+post.template):'';
 return `<article class="page style-${style} ${post.design==='editorial'?'editorial':''} ${templateClass} ${p.layout} ${asset?'has-image':''}" id="page-${p.id}" style="${theme}"><header><div class="eyebrow" ${label('eyebrow')}>${esc(p.eyebrow||post.brand)}</div><h1 ${label('title')} class="${p.layout==='cover'?'cover-title':''}">${esc(p.title)}</h1>${p.subtitle?'<p class="subtitle" '+label('subtitle')+'>'+esc(p.subtitle)+'</p>':''}</header><section class="body" data-check-overflow>${media}${table}${p.items.length?'<div class="items">'+items+'</div>':''}${p.note?'<div class="note" '+label('note')+'>'+esc(p.note)+'</div>':''}</section><footer class="foot"><span ${label('brand')}>${esc(post.brand)}</span><span>${String(index+1).padStart(2,'0')} / ${String(post.pages.length).padStart(2,'0')}</span></footer></article>`;
}
function expectedText(post){
 const entries={};
 for(const p of post.pages){
  const put=(key,value)=>{entries[p.id+'.'+key]=value;};
  put('eyebrow',p.eyebrow||post.brand);put('title',p.title);put('brand',post.brand);
  for(const key of ['subtitle','note','imageLabel'])if(p[key])put(key,p[key]);
  p.items.forEach((item,i)=>{for(const key of ['heading','text','value','unit'])if(item[key])put('items.'+i+'.'+key,item[key]);});
  if(p.columns)p.columns.forEach((v,i)=>put('columns.'+i,v));
  if(p.rows)p.rows.forEach((row,i)=>row.forEach((v,j)=>put('rows.'+i+'.'+j,v)));
 }
 return entries;
}
function loadPlaywright(){
 try{return require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');}
 catch{throw new Error('Playwright unavailable: install dependencies or set PLAYWRIGHT_MODULE_PATH to a local package.');}
}
async function renderPost(options){
 need(options.input&&options.out,'input and out are required');
 const input=path.resolve(options.input),out=path.resolve(options.out);
 need(!fs.existsSync(out),'Output directory already exists; choose a new version.');
 const post=validatePost(readJson(input));
 const assets=new Map(post.pages.filter(p=>p.image).map(p=>[p.id,readImage(path.dirname(input),p.image)]));
 const imageGroups=new Map();
 for(const p of post.pages.filter(p=>p.image)){const hash=sha(assets.get(p.id).bytes);if(!imageGroups.has(hash))imageGroups.set(hash,[]);imageGroups.get(hash).push(p);}
 for(const group of imageGroups.values())if(group.length>1)need(group.every(p=>p.imageRole==='evidence'&&p.imageReuseReason),'Repeated scene image content on pages '+group.map(p=>p.id).join(', ')+'. Use distinct scenes; evidence reuse needs explicit role and reason on every occurrence.');
 const rootConfig={...post};delete rootConfig.pages;delete rootConfig.publish;
 const rendererFingerprint=sha(fs.readFileSync(__filename))+':'+sha(fs.readFileSync(require.resolve('./visual-templates.cjs')));
 const globalFingerprint=sha(JSON.stringify({config:rootConfig,renderer:rendererFingerprint}));
 const specs=post.pages.map((p,i)=>{const clean={...p};delete clean.image;return {id:p.id,file:'images/'+String(i+1).padStart(2,'0')+'-'+p.id+'.png',fingerprint:sha(JSON.stringify({globalFingerprint,page:clean,image:assets.has(p.id)?sha(assets.get(p.id).bytes):null}))};});
 let previous,base,selected=new Set(post.pages.map(p=>p.id));
 if(options.base||options.pages){
  need(options.base&&Array.isArray(options.pages)&&options.pages.length>0,'Partial revision requires base and nonempty pages');
  base=path.resolve(options.base);previous=readJson(path.join(base,'manifest.json'));
  need(previous.schemaVersion===1&&Array.isArray(previous.pages),'Unsupported base manifest');
  need(previous.globalFingerprint===globalFingerprint,'Global settings changed; create a full revision');
  need(JSON.stringify(previous.pages.map(p=>p.id))===JSON.stringify(specs.map(p=>p.id)),'Page order changed; create a full revision');
  selected=new Set(options.pages);for(const id of selected)need(specs.some(p=>p.id===id),'Unknown selected page ID');
  for(const spec of specs)if(!selected.has(spec.id))need(previous.pages.find(p=>p.id===spec.id).fingerprint===spec.fingerprint,'Unselected page content or image changed; expand revision scope');
 }
 const historyDirectory=options.history===false?null:history.historyRoot(options.historyDir);
 const historyCandidate=historyDirectory?history.candidate(post,path.dirname(input)):null;
 const revisionOf=options.revisionOf||previous?.history?.recordId;
 const historyOptions={revisionOf,reason:options.historyReason,outputPath:out};
 if(historyDirectory)history.assertAllowed(history.checkHistory(historyDirectory,historyCandidate,historyOptions),options.historyReason);
 const html='<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>'+esc(post.title)+'</title><style>'+CSS+STYLE_CSS+EDITORIAL_CSS+templates.css+'</style><body>'+post.pages.map((p,i)=>pageHtml(post,p,i,assets.get(p.id))).join('')+'</body></html>';
 const {chromium}=loadPlaywright();
 const launch={headless:true};if(options.browser||process.env.BROWSER_EXECUTABLE)launch.executablePath=options.browser||process.env.BROWSER_EXECUTABLE;
 const browser=await chromium.launch(launch);const buffers=new Map();const checks=[];let preview,textAudit;
 try{
  const tab=await browser.newPage({viewport:{width:1080,height:1440},deviceScaleFactor:1});
  await tab.route('**/*',route=>route.abort());
  await tab.setContent(html);await tab.evaluate(()=>document.fonts.ready);
  need(await tab.locator('img').evaluateAll(images=>images.every(i=>i.complete&&i.naturalWidth>0)),'Image decode failure');
  const actual=await tab.locator('[data-text-key]').evaluateAll(nodes=>Object.fromEntries(nodes.map(n=>[n.dataset.textKey,n.textContent])));
  const expected=expectedText(post);
  need(Object.keys(actual).length===Object.keys(expected).length&&Object.entries(expected).every(([key,value])=>actual[key]===value),'Rendered text differs from input');
  textAudit={exactInputMatch:true,entryCount:Object.keys(expected).length,entries:actual,scope:'Input JSON to rendered DOM; does not compare to an earlier user manuscript or prove facts/visual quality.'};
  for(const spec of specs){
   // Keep the target on a single viewport; long scrolling documents can capture unpainted tiles.
   await tab.locator('.page').evaluateAll((pages,id)=>{for(const page of pages)page.style.display=page.id==='page-'+id?'flex':'none';},spec.id);
   await tab.evaluate(async()=>{window.scrollTo(0,0);await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);});
   const el=tab.locator('#page-'+spec.id);
   const check=await el.evaluate(e=>({width:e.clientWidth,height:e.clientHeight,overflow:e.scrollWidth>e.clientWidth+2||e.scrollHeight>e.clientHeight+2||[...e.querySelectorAll('[data-check-overflow]')].some(x=>x.scrollHeight>x.clientHeight+2||x.scrollWidth>x.clientWidth+2)}));
   need(!check.overflow,'Layout overflow on page '+spec.id+'; shorten or split content');
   const clipped=await el.evaluate(article=>{
    const footer=article.querySelector('.foot').getBoundingClientRect();
    return [...article.querySelectorAll('[data-text-key]')].filter(node=>{
     const box=node.getBoundingClientRect();
     if(node.closest('.body')&&box.bottom>footer.top-6)return true;
     for(let parent=node.parentElement;parent&&parent!==article.parentElement;parent=parent.parentElement){
      const style=getComputedStyle(parent),rect=parent.getBoundingClientRect();
      if(['hidden','clip'].includes(style.overflowX)&&(box.left<rect.left-2||box.right>rect.right+2))return true;
      if(['hidden','clip'].includes(style.overflowY)&&(box.top<rect.top-2||box.bottom>rect.bottom+2))return true;
     }
     return node.scrollWidth>node.clientWidth+2;
    }).map(node=>node.dataset.textKey);
   });
   need(!clipped.length,'Text clipping on page '+spec.id+': '+clipped.join(', '));
   const brandFooter=await el.evaluate(article=>{
    const node=article.querySelector('.foot [data-text-key]'),footer=node.closest('footer');
    const box=node.getBoundingClientRect(),area=article.getBoundingClientRect(),foot=footer.getBoundingClientRect(),style=getComputedStyle(node);
    return {text:node.textContent,visible:box.width>0&&box.height>0&&box.left>=area.left+20&&box.right<=area.right-20&&box.top>=foot.top&&box.bottom<=area.bottom-15&&foot.top>area.top+1200&&style.visibility!=='hidden'&&Number(style.opacity)>0&&parseFloat(style.fontSize)>=22};
   });
   need(brandFooter.text===post.brand&&brandFooter.visible,'Brand footer missing, clipped or too small on page '+spec.id);
   check.brandFooter=brandFooter;
   checks.push({id:spec.id,...check});
   let bytes;
   if(selected.has(spec.id))bytes=await el.screenshot({type:'png'});
   else{
    const old=previous.pages.find(p=>p.id===spec.id);need(/^images\/[a-z0-9-]+\.png$/.test(old.file),'Invalid base image path');
    const oldPath=fs.realpathSync(path.join(base,old.file));const basePath=fs.realpathSync(base);const rel=path.relative(basePath,oldPath);
    need(rel!=='..'&&!rel.startsWith('..'+path.sep)&&!path.isAbsolute(rel),'Base image outside base directory');
    bytes=fs.readFileSync(oldPath);need(sha(bytes)===old.sha256,'Base image hash mismatch');
   }
   buffers.set(spec.id,bytes);spec.sha256=sha(bytes);
  }
  const cols=Math.min(3,specs.length),width=cols*360+(cols+1)*20;
  await tab.setViewportSize({width,height:600});
  await tab.setContent('<!doctype html><html><meta charset="utf-8"><style>body{margin:0;padding:20px;background:#e8e5dd;display:grid;grid-template-columns:repeat('+cols+',360px);gap:20px}img{display:block;width:360px;height:480px}</style><body>'+specs.map(s=>'<img alt="'+s.id+'" src="data:image/png;base64,'+buffers.get(s.id).toString('base64')+'">').join('')+'</body></html>');
  await tab.locator('img').evaluateAll(images=>Promise.all(images.map(i=>i.decode())));
  preview=await tab.screenshot({type:'jpeg',quality:94,fullPage:true});
 }finally{await browser.close();}
 // Write a new version only after all pages pass layout/decode checks.
 fs.mkdirSync(path.dirname(out),{recursive:true});fs.mkdirSync(out);
 fs.mkdirSync(path.join(out,'images'));fs.mkdirSync(path.join(out,'source'));
 for(const spec of specs)fs.writeFileSync(path.join(out,spec.file),buffers.get(spec.id));
 fs.writeFileSync(path.join(out,'preview.jpg'),preview);
 fs.writeFileSync(path.join(out,'source/post.html'),html);
 const portable=structuredClone(post);
 if(assets.size){fs.mkdirSync(path.join(out,'source/media'));for(const p of portable.pages)if(assets.has(p.id)){const a=assets.get(p.id);p.image='media/'+p.id+a.extension;fs.writeFileSync(path.join(out,'source',p.image),a.bytes);}}
 fs.writeFileSync(path.join(out,'source/post.json'),JSON.stringify(portable,null,2)+'\n');
 fs.writeFileSync(path.join(out,'source/text-audit.json'),JSON.stringify(textAudit,null,2)+'\n');
 if(post.publish){
  const topics=post.publish.topics.map(t=>'#'+t).join(' ');
  fs.writeFileSync(path.join(out,'publish.md'),'# 推荐标题\n\n'+post.publish.title+'\n\n# 正文\n\n'+post.publish.body+'\n\n# 话题\n\n'+topics+'\n');
  fs.writeFileSync(path.join(out,'publish-title.txt'),post.publish.title);
  fs.writeFileSync(path.join(out,'publish-body.txt'),post.publish.body+'\n\n'+topics);
  fs.writeFileSync(path.join(out,'publish-topics.txt'),topics);
  fs.writeFileSync(path.join(out,'publish-check.json'),JSON.stringify(publishStats(post.publish),null,2)+'\n');
 }
 const sourceFiles=['source/post.html','source/post.json','source/text-audit.json',...portable.pages.filter(p=>p.image).map(p=>'source/'+p.image)];
 const sourceHashes=Object.fromEntries(sourceFiles.map(file=>[file,sha(fs.readFileSync(path.join(out,file)))]));
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({schemaVersion:1,globalFingerprint,sourceHashes,pages:specs,renderedPages:[...selected],baseVersion:base?path.basename(base):null,automatedChecks:checks,visualReview:'required; not performed by this script'},null,2)+'\n');
 let receipt;
 if(historyDirectory){
  try{receipt=history.recordHistory(historyDirectory,historyCandidate,historyOptions);}
  catch(error){throw new Error('Files exported to '+out+' but local history registration failed: '+error.message);}
  const manifestPath=path.join(out,'manifest.json'),manifest=readJson(manifestPath);
  manifest.history={recordId:receipt.id,workId:receipt.workId,day:receipt.day};
  fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
  fs.writeFileSync(path.join(out,'history-check.json'),JSON.stringify(receipt.check,null,2)+'\n');
 }
 return {out,pages:specs.length,rendered:[...selected],history:receipt?{recordId:receipt.id,workId:receipt.workId,day:receipt.day}:null};
}
function cli(argv){
 const o={};const flags={'--input':'input','--out':'out','--base':'base','--pages':'pages','--browser':'browser','--history-dir':'historyDir','--revision-of':'revisionOf','--history-reason':'historyReason'};
 for(let i=0;i<argv.length;i++){const k=flags[argv[i]];need(k&&argv[i+1]&&!argv[i+1].startsWith('--'),'Usage: node scripts/render-post.cjs --input post.json --out new-version [--browser executable] [--base previous-version --pages page-id,...] [--history-dir absolute-path] [--revision-of record-id] [--history-reason explanation]');need(o[k]===undefined,'Duplicate option');o[k]=argv[++i];}
 if(o.pages)o.pages=o.pages.split(',').map(s=>s.trim()).filter(Boolean);return o;
}
module.exports={validatePost,renderPost};
if(require.main===module)renderPost(cli(process.argv.slice(2))).then(r=>console.log('Exported '+r.pages+' pages; rendered: '+r.rendered.join(', ')+'. Visual review still required.')).catch(e=>{console.error(e.message);process.exitCode=1;});
