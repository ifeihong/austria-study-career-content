const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {validatePost,renderPost}=require('../scripts/render-post.cjs');

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
 fs.copyFileSync(path.join(a,m1.pages[0].file),path.join(dir,'media.png'));
 fs.writeFileSync(config,JSON.stringify(withImage));const imageOut=path.join(dir,'with-image');await renderPost({input:config,out:imageOut});
 assert.deepEqual(fs.readFileSync(path.join(imageOut,'source/media/cover.png')),fs.readFileSync(path.join(dir,'media.png')));
 await renderPost({input:path.join(imageOut,'source/post.json'),out:path.join(dir,'portable-rerender')});
 fs.copyFileSync(path.join(a,m1.pages[1].file),path.join(dir,'media.png'));
 await assert.rejects(renderPost({input:config,out:path.join(dir,'image-change'),base:imageOut,pages:['list']}),/unselected/i);
 console.log('Renderer evidence directory:',dir);
});
