'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const STYLES=['S1','S2','S3','S4','S5'];
const LAYOUTS=['cover','checklist','steps','table','split'];
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
function need(ok,message){if(!ok)throw new Error(message);}
function text(value,label,required=false){need(typeof value==='string'&&(!required||value.trim().length>0),label+' must be text');}
function keys(value,allowed,label){for(const key of Object.keys(value))need(allowed.includes(key),'Unknown '+label+' field: '+key);}
function readJson(file){return JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));}
function validatePost(input){
 need(input&&typeof input==='object'&&!Array.isArray(input),'Post must be an object');
 keys(input,['title','brand','style','theme','pages','publish'],'post');
 const post=structuredClone(input);text(post.title,'title',true);
 post.brand??='奥地利求学就业桔';text(post.brand,'brand',true);
 post.style??='S1';need(STYLES.includes(post.style),'Unknown global style');
 post.theme??={};need(post.theme&&typeof post.theme==='object'&&!Array.isArray(post.theme),'theme must be an object');
 for(const [k,v] of Object.entries(post.theme))need(['background','ink','accent'].includes(k)&&typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v),'Invalid theme color');
 need(Array.isArray(post.pages)&&post.pages.length>0,'pages must be a nonempty array');
 const ids=new Set();
 for(const p of post.pages){
  need(p&&typeof p==='object'&&!Array.isArray(p),'Each page must be an object');
  keys(p,['id','title','layout','style','subtitle','eyebrow','note','imageLabel','image','items','columns','rows'],'page');
  need(typeof p.id==='string'&&/^[a-z0-9][a-z0-9-]{0,48}$/.test(p.id),'Invalid page ID');
  need(!ids.has(p.id),'Duplicate page ID');ids.add(p.id);
  text(p.title,'page title',true);p.layout??='checklist';need(LAYOUTS.includes(p.layout),'Unknown page layout');
  if(p.style!==undefined)need(STYLES.includes(p.style),'Unknown page style');
  for(const k of ['subtitle','eyebrow','note','imageLabel'])if(p[k]!==undefined)text(p[k],k);
  if(p.image!==undefined){text(p.image,'image',true);need(!/^[a-z]+:/i.test(p.image)&&!path.isAbsolute(p.image)&&!p.image.split(/[\\/]/).includes('..'),'image must be a local relative path without parent traversal');}
  p.items??=[];need(Array.isArray(p.items),'items must be an array');
  for(const item of p.items){need(item&&typeof item==='object'&&!Array.isArray(item),'item must be an object');keys(item,['heading','text'],'item');text(item.heading,'item heading',true);if(item.text!==undefined)text(item.text,'item text');}
  if(p.layout!=='table')need(p.columns===undefined&&p.rows===undefined,'columns and rows require table layout');
  if(p.layout==='table'){
   need(Array.isArray(p.columns)&&p.columns.length>0,'table columns required');p.columns.forEach(v=>text(v,'column',true));
   need(Array.isArray(p.rows),'table rows required');
   for(const row of p.rows){need(Array.isArray(row)&&row.length===p.columns.length,'Row must match table column count');row.forEach(v=>text(v,'cell'));}
  }
 }
 if(post.publish!==undefined){need(post.publish&&typeof post.publish==='object'&&!Array.isArray(post.publish),'publish must be an object');keys(post.publish,['title','body','topics'],'publish');text(post.publish.title,'publish title',true);text(post.publish.body,'publish body',true);need(Array.isArray(post.publish.topics),'topics must be an array');post.publish.topics.forEach(v=>text(v,'topic',true));}
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
function pageHtml(post,p,index,asset){
 const style=p.style||post.style;const theme=Object.entries(post.theme).map(([k,v])=>'--'+({background:'bg',ink:'ink',accent:'accent'}[k])+':'+v).join(';');
 const media=asset?`<figure class="media"><img alt="${esc(p.imageLabel||'主题素材')}" src="${asset.data}">${p.imageLabel?'<figcaption>'+esc(p.imageLabel)+'</figcaption>':''}</figure>`:'';
 const items=p.items.map((item,i)=>`<div class="item">${p.layout==='steps'?'<span class="number">'+String(i+1).padStart(2,'0')+'</span>':''}<h2>${esc(item.heading)}</h2>${item.text?'<p>'+esc(item.text)+'</p>':''}</div>`).join('');
 const table=p.layout==='table'?`<table><thead><tr>${p.columns.map(c=>'<th>'+esc(c)+'</th>').join('')}</tr></thead><tbody>${p.rows.map(row=>'<tr>'+row.map(c=>'<td>'+esc(c)+'</td>').join('')+'</tr>').join('')}</tbody></table>`:'';
 return `<article class="page style-${style} ${p.layout} ${asset?'has-image':''}" id="page-${p.id}" style="${theme}"><header><div class="eyebrow">${esc(p.eyebrow||post.brand)}</div><h1 class="${p.layout==='cover'?'cover-title':''}">${esc(p.title)}</h1>${p.subtitle?'<p class="subtitle">'+esc(p.subtitle)+'</p>':''}</header><section class="body" data-check-overflow>${media}${table}<div class="items">${items}</div>${p.note?'<div class="note">'+esc(p.note)+'</div>':''}</section><footer class="foot"><span>${esc(post.brand)}</span><span>${String(index+1).padStart(2,'0')} / ${String(post.pages.length).padStart(2,'0')}</span></footer></article>`;
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
 const rootConfig={...post};delete rootConfig.pages;delete rootConfig.publish;
 const globalFingerprint=sha(JSON.stringify({config:rootConfig,renderer:sha(fs.readFileSync(__filename))}));
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
 const html='<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>'+esc(post.title)+'</title><style>'+CSS+'</style><body>'+post.pages.map((p,i)=>pageHtml(post,p,i,assets.get(p.id))).join('')+'</body></html>';
 const {chromium}=loadPlaywright();
 const launch={headless:true};if(options.browser||process.env.BROWSER_EXECUTABLE)launch.executablePath=options.browser||process.env.BROWSER_EXECUTABLE;
 const browser=await chromium.launch(launch);const buffers=new Map();const checks=[];let preview;
 try{
  const tab=await browser.newPage({viewport:{width:1080,height:1440},deviceScaleFactor:1});
  await tab.route('**/*',route=>route.abort());
  await tab.setContent(html);await tab.evaluate(()=>document.fonts.ready);
  need(await tab.locator('img').evaluateAll(images=>images.every(i=>i.complete&&i.naturalWidth>0)),'Image decode failure');
  for(const spec of specs){
   const el=tab.locator('#page-'+spec.id);
   const check=await el.evaluate(e=>({width:e.clientWidth,height:e.clientHeight,overflow:e.scrollWidth>e.clientWidth+2||e.scrollHeight>e.clientHeight+2||[...e.querySelectorAll('[data-check-overflow]')].some(x=>x.scrollHeight>x.clientHeight+2||x.scrollWidth>x.clientWidth+2)}));
   need(!check.overflow,'Layout overflow on page '+spec.id+'; shorten or split content');
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
 if(post.publish)fs.writeFileSync(path.join(out,'publish.md'),'# 推荐标题\n\n'+post.publish.title+'\n\n# 正文\n\n'+post.publish.body+'\n\n# 话题\n\n'+post.publish.topics.map(t=>'#'+t.replace(/^#+/,'')).join(' ')+'\n');
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({schemaVersion:1,globalFingerprint,pages:specs,renderedPages:[...selected],baseVersion:base?path.basename(base):null,automatedChecks:checks,visualReview:'required; not performed by this script'},null,2)+'\n');
 return {out,pages:specs.length,rendered:[...selected]};
}
function cli(argv){
 const o={};const flags={'--input':'input','--out':'out','--base':'base','--pages':'pages','--browser':'browser'};
 for(let i=0;i<argv.length;i++){const k=flags[argv[i]];need(k&&argv[i+1]&&!argv[i+1].startsWith('--'),'Usage: node scripts/render-post.cjs --input post.json --out new-version [--browser executable] [--base previous-version --pages page-id,...]');need(o[k]===undefined,'Duplicate option');o[k]=argv[++i];}
 if(o.pages)o.pages=o.pages.split(',').map(s=>s.trim()).filter(Boolean);return o;
}
module.exports={validatePost,renderPost};
if(require.main===module)renderPost(cli(process.argv.slice(2))).then(r=>console.log('Exported '+r.pages+' pages; rendered: '+r.rendered.join(', ')+'. Visual review still required.')).catch(e=>{console.error(e.message);process.exitCode=1;});
