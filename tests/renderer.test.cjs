const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {validatePost,renderPost:renderWithHistory}=require('../scripts/render-post.cjs');
// Rendering fixtures are not real editorial output and must never pollute a user's ledger.
const renderPost=options=>renderWithHistory({...options,history:false});

function post(){return {title:'预算整理方法',publish:{title:'家庭预算怎么列？',body:'先整理，再核对。',topics:['家庭规划']},pages:[
 {id:'cover',layout:'cover',style:'S1',title:'一家人的预算\n先从哪里开始？',subtitle:'先整理生活假设，再核对费用。',items:[{heading:'出发前',text:'一次性支出'}]},
 {id:'list',layout:'checklist',style:'S2',title:'把生活假设写清楚',items:[{heading:'家庭人数',text:'记录实际情况。'}]},
 {id:'steps',layout:'steps',style:'S3',title:'按顺序整理',items:[{heading:'列清单',text:'先写项目。'},{heading:'核对来源',text:'再查当前资料。'}]},
 {id:'table',layout:'table',style:'S4',title:'预算整理表示例',columns:['项目','核对重点'],rows:[['住房','金额与时间']],note:'自制示例，非官方文件。'},
 {id:'finish',layout:'steps',style:'S5',title:'下一步',items:[{heading:'列出待确认项',text:'问谁、查哪里、何时确认。'}]}
]};}

test('reject ambiguous page IDs, unknown layouts and malformed table rows',()=>{
 const a=post();a.pages[1].id='cover';assert.throws(()=>validatePost(a),/duplicate/i);
 const b=post();b.pages[0].layout='dashboard';assert.throws(()=>validatePost(b),/layout/i);
 const c=post();c.pages[3].rows=[['missing']];assert.throws(()=>validatePost(c),/column/i);
});

test('reject external image URLs and unsafe CSS values',()=>{
 const a=post();a.pages[0].image='https://example.com/image.png';assert.throws(()=>validatePost(a),/local/i);
 const b=post();b.theme={accent:'red; background:url(https://example.com)'};assert.throws(()=>validatePost(b),/color/i);
});

test('reject misspelled or layout-incompatible fields instead of silently dropping content',()=>{
 const a=post();a.pages[0].subTitle='不能漏掉的说明';assert.throws(()=>validatePost(a),/subTitle/);
 const b=post();b.publish.topic=['护理'];assert.throws(()=>validatePost(b),/topic/);
 const c=post();c.pages[0].rows=[['不可丢失']];assert.throws(()=>validatePost(c),/table/);
 const d=post();d.pages[0].items[0].body='不能漏掉的正文';assert.throws(()=>validatePost(d),/body/);
});

test('validate image-dependent captions and explicit image framing',()=>{
 const a=post();a.pages[0].imageLabel='不得遗漏的说明';assert.throws(()=>validatePost(a),/image/i);
 const b=post();b.pages[0].image='media.png';b.pages[0].imageFit='contain';b.pages[0].imageHeight=400;b.pages[0].imageFocus={x:25,y:60};
 assert.equal(validatePost(b).pages[0].imageFocus.x,25);
 for(const [field,value] of [['imageFit','stretch'],['imageHeight',0],['imageFocus',{x:101,y:50}],['imageFocus',{x:50,y:50,z:1}]]){
  const c=structuredClone(b);c.pages[0][field]=value;assert.throws(()=>validatePost(c),/image/i);
 }
});

test('editorial layouts require an intentional design and real local image for image-led pages',()=>{
 const a=post();a.design='unknown';assert.throws(()=>validatePost(a),/design/i);
 const b=post();b.design='editorial';b.pages[0].layout='poster';assert.throws(()=>validatePost(b),/image/i);
 b.pages[0].image='media.png';assert.equal(validatePost(b).pages[0].layout,'poster');
 const c=post();c.design='editorial';c.pages[3].layout='worksheet';assert.equal(validatePost(c).pages[3].rows.length,1);
});

test('publishing fields enforce conservative standard-note limits including emoji and topics',()=>{
 const a=post();a.publish.title='字'.repeat(18)+'🌿';assert.doesNotThrow(()=>validatePost(a));
 a.publish.title+='字';assert.throws(()=>validatePost(a),/title.*20/i);
 const b=post();b.publish.topics=['护理'];b.publish.body='字'.repeat(995);assert.doesNotThrow(()=>validatePost(b));
 b.publish.body+='字';assert.throws(()=>validatePost(b),/body.*1000/i);
 const c=post();c.publish.topics=['护理','#护理'];assert.throws(()=>validatePost(c),/duplicate.*topic/i);
 const d=post();d.publish.topics=['护理 学习'];assert.throws(()=>validatePost(d),/topic.*format/i);
 const e=post();e.publish.topics=Array.from({length:9},(_,i)=>'主题'+i);assert.throws(()=>validatePost(e),/8.*editorial/i);
 const f=post();f.publish.title='两行\n标题';assert.throws(()=>validatePost(f),/single line/i);
});

test('render full post, preserve unselected pages and reject unsafe partial revision',
 {skip:process.env.RUN_RENDER_TESTS!=='1'},async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'austria-render-test-'));
 const config=path.join(dir,'post.json');const original=post();
 original.pages[0].title='<img src=x onerror=alert(1)>\n标题按文字显示';
 // Windows editors commonly emit a UTF-8 BOM; it must not prevent a valid export.
 fs.writeFileSync(config,'\uFEFF'+JSON.stringify(original));
 const a=path.join(dir,'v01');await renderPost({input:config,out:a});
 assert.ok(fs.existsSync(path.join(a,'preview.jpg')));
 const m1=JSON.parse(fs.readFileSync(path.join(a,'manifest.json')));
 assert.equal(m1.pages.length,5);
 for(const p of m1.pages){const b=fs.readFileSync(path.join(a,p.file));assert.equal(b.readUInt32BE(16),1080);assert.equal(b.readUInt32BE(20),1440);}
 assert.match(fs.readFileSync(path.join(a,'source/post.html'),'utf8'),/&lt;img/);
 original.pages[1].items[0].text='人数与阶段要分别写。';fs.writeFileSync(config,JSON.stringify(original));
 const b=path.join(dir,'v02');await renderPost({input:config,out:b,base:a,pages:['list']});
 const m2=JSON.parse(fs.readFileSync(path.join(b,'manifest.json')));
 assert.notEqual(m1.pages[1].sha256,m2.pages[1].sha256);
 for(const id of ['cover','steps','table','finish']){
  const before=m1.pages.find(p=>p.id===id),after=m2.pages.find(p=>p.id===id);
  assert.equal(after.sha256,before.sha256);
  assert.deepEqual(fs.readFileSync(path.join(a,before.file)),fs.readFileSync(path.join(b,after.file)));
 }
 original.pages[2].title='未经允许的改动';fs.writeFileSync(config,JSON.stringify(original));
 const c=path.join(dir,'v03');await assert.rejects(renderPost({input:config,out:c,base:b,pages:['list']}),/unselected/i);assert.equal(fs.existsSync(c),false);
 original.pages[2].title='按顺序整理';original.theme={accent:'#225533'};fs.writeFileSync(config,JSON.stringify(original));
 await assert.rejects(renderPost({input:config,out:c,base:b,pages:['list']}),/global/i);
 await assert.rejects(renderPost({input:config,out:a}),/exists/i);
 const huge=post();huge.pages[0].items=Array.from({length:40},()=>({heading:'过多信息',text:'此页应拆分，而非截断。'}));fs.writeFileSync(config,JSON.stringify(huge));
 const d=path.join(dir,'overflow');await assert.rejects(renderPost({input:config,out:d}),/overflow/i);assert.equal(fs.existsSync(d),false);
 const withImage=post();withImage.pages[0].image='media.png';withImage.pages[0].imageLabel='测试排版素材';
 withImage.pages[0].imageFit='contain';withImage.pages[0].imageHeight=400;withImage.pages[0].imageFocus={x:25,y:60};
 fs.copyFileSync(path.join(a,m1.pages[0].file),path.join(dir,'media.png'));
 fs.writeFileSync(config,JSON.stringify(withImage));const imageOut=path.join(dir,'with-image');await renderPost({input:config,out:imageOut});
 assert.deepEqual(fs.readFileSync(path.join(imageOut,'source/media/cover.png')),fs.readFileSync(path.join(dir,'media.png')));
 assert.match(fs.readFileSync(path.join(imageOut,'source/post.html'),'utf8'),/height:400px;object-fit:contain;object-position:25% 60%/);
 await renderPost({input:path.join(imageOut,'source/post.json'),out:path.join(dir,'portable-rerender')});
 fs.copyFileSync(path.join(a,m1.pages[1].file),path.join(dir,'media.png'));
 await assert.rejects(renderPost({input:config,out:path.join(dir,'image-change'),base:imageOut,pages:['list']}),/unselected/i);
 console.log('Renderer evidence directory:',dir);
});

test('export all five complete style examples with publishing copy',
 {skip:process.env.RUN_RENDER_TESTS!=='1'},async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'austria-style-examples-'));
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
 const launch={headless:true};if(process.env.BROWSER_EXECUTABLE)launch.executablePath=process.env.BROWSER_EXECUTABLE;
 const browser=await chromium.launch(launch);const tab=await browser.newPage();
 try{
 for(const style of ['s1','s2','s3','s4','s5']){
  const out=path.join(dir,style);await renderPost({input:path.join(__dirname,'../assets/examples/'+style+'.json'),out});
  const manifest=JSON.parse(fs.readFileSync(path.join(out,'manifest.json'),'utf8'));
  assert.equal(manifest.pages.length,4);assert.ok(fs.readFileSync(path.join(out,'publish.md'),'utf8').includes('# 正文'));
  for(const p of manifest.pages){
   const bytes=fs.readFileSync(path.join(out,p.file));assert.equal(bytes.readUInt32BE(16),1080);assert.equal(bytes.readUInt32BE(20),1440);
   // Uniform light backgrounds in these fixtures let us detect missing rendered text, not just PNG dimensions.
   const ink=await tab.evaluate(async data=>{
    const img=new Image();img.src='data:image/png;base64,'+data;await img.decode();
    const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);
    const count=(y,h)=>{const d=ctx.getImageData(72,y,936,h).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]+d[i+1]+d[i+2]<300&&d[i+3]>250)n++;return n;};
    return {header:count(100,350),footer:count(1300,120)};
   },bytes.toString('base64'));
   assert.ok(ink.header>80,style+'/'+p.id+' missing heading pixels');assert.ok(ink.footer>50,style+'/'+p.id+' missing footer pixels');
  }
 }
 }finally{await browser.close();}
 console.log('Complete style examples directory:',dir);
});

test('editorial example illustrations use distinct source content within each post',()=>{
 const {createHash}=require('node:crypto');
 for(const name of ['culture','nursing','family']){
  const input=path.join(__dirname,'../assets/editorial/'+name+'.json');
  const source=JSON.parse(fs.readFileSync(input,'utf8'));
  const hashes=source.pages.filter(p=>p.image).map(p=>createHash('sha256').update(fs.readFileSync(path.resolve(path.dirname(input),p.image))).digest('hex'));
  assert.equal(new Set(hashes).size,hashes.length,name+' repeats the same source illustration; renaming is not a new scene');
 }
});

test('editorial posts export all actual media and portable sources across three content lines',
 {skip:process.env.RUN_RENDER_TESTS!=='1'},async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'austria-editorial-'));
 for(const name of ['culture','nursing','family']){
  const input=path.join(__dirname,'../assets/editorial/'+name+'.json'),out=path.join(dir,name);
  await renderPost({input,out});
  const source=JSON.parse(fs.readFileSync(path.join(out,'source/post.json'),'utf8'));
  const manifest=JSON.parse(fs.readFileSync(path.join(out,'manifest.json'),'utf8'));
  assert.equal(source.design,'editorial');assert.equal(source.pages.length,4);
  assert.ok(new Set(manifest.pages.map(p=>p.sha256)).size===4,'Each editorial page must be a distinct exported image');
  for(const page of source.pages)if(page.image)assert.ok(fs.statSync(path.join(out,'source',page.image)).size>0);
  for(const page of manifest.pages){const png=fs.readFileSync(path.join(out,page.file));assert.equal(png.readUInt32BE(16),1080);assert.equal(png.readUInt32BE(20),1440);}
  assert.ok(fs.existsSync(path.join(out,'publish.md')));
  assert.equal(fs.readFileSync(path.join(out,'publish-title.txt'),'utf8'),source.publish.title);
  assert.equal(fs.readFileSync(path.join(out,'publish-body.txt'),'utf8'),source.publish.body+'\n\n'+source.publish.topics.map(t=>'#'+t).join(' '));
  const copyCheck=JSON.parse(fs.readFileSync(path.join(out,'publish-check.json'),'utf8'));
  assert.ok(copyCheck.titleUnits<=20&&copyCheck.bodyWithTopicsUnits<=1000);
  assert.equal(copyCheck.platformEditorVerified,false);
  assert.equal(fs.readFileSync(path.join(out,'publish-topics.txt'),'utf8'),source.publish.topics.map(t=>'#'+t).join(' '));
  if(name==='nursing')await renderPost({input:path.join(out,'source/post.json'),out:path.join(dir,'portable-nursing')});
 }
 console.log('Editorial validation directory:',dir);
});

test('renderer checks history before export, records successful output and links revisions',
 {skip:process.env.RUN_RENDER_TESTS!=='1'},async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'austria-history-render-'));
 const historyDir=path.join(dir,'history'),input=path.join(dir,'input.json'),a=post();a.pages=a.pages.slice(0,1);
 fs.writeFileSync(input,JSON.stringify(a));
 const first=await renderWithHistory({input,out:path.join(dir,'first'),historyDir});assert.ok(first.history.recordId);
 await assert.rejects(renderWithHistory({input,out:path.join(dir,'duplicate'),historyDir}),/Duplicate/);
 assert.ok(!fs.existsSync(path.join(dir,'duplicate')));
 a.pages[0].subtitle='改进后的说明';fs.writeFileSync(input,JSON.stringify(a));
 const revision=await renderWithHistory({input,out:path.join(dir,'revision'),base:first.out,pages:['cover'],historyDir});
 assert.equal(revision.history.workId,first.history.workId);
 const {listHistory}=require('../scripts/content-history.cjs');assert.equal(listHistory(historyDir).length,2);
 const bad=structuredClone(a);bad.pages[0].title='过长标题'.repeat(2000);fs.writeFileSync(input,JSON.stringify(bad));
 await assert.rejects(renderWithHistory({input,out:path.join(dir,'failed'),historyDir,revisionOf:first.history.recordId}),/overflow/i);
 assert.equal(listHistory(historyDir).length,2);
 console.log('History renderer evidence directory:',dir);
});
