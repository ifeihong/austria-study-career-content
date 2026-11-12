const {test}=require('node:test');
const assert=require('node:assert/strict');
const {selectDesign}=require('../scripts/select-design.cjs');
test('selects based on the actual information task, density and required evidence',()=>{
 assert.equal(selectDesign({purpose:'qa'}).template,'T7');
 assert.equal(selectDesign({purpose:'guide',density:'high'}).template,'T3');
 assert.equal(selectDesign({purpose:'document',evidenceRequired:true,availableMedia:['evidence']}).template,'T8');
 assert.equal(selectDesign({purpose:'culture',availableMedia:['illustration']}).template,'T5');
 assert.equal(selectDesign({purpose:'culture',availableMedia:['photo']}).template,'T4');
});
test('missing media remains visible and generated scenes never substitute for evidence',()=>{
 const a=selectDesign({purpose:'observation',canGenerate:['photo']});assert.equal(a.template,'T4');assert.equal(a.status,'needs-assets');assert.deepEqual(a.missingMedia,[{type:'photo',canGenerate:true}]);
 const b=selectDesign({purpose:'document',evidenceRequired:true,availableMedia:['photo']});assert.equal(b.status,'needs-assets');assert.ok(b.missingMedia.some(m=>m.type==='evidence'&&!m.canGenerate));
 assert.equal(selectDesign({purpose:'document',availableMedia:['photo']}).status,'needs-assets');
 assert.throws(()=>selectDesign({purpose:'document',canGenerate:['evidence']}),/generated evidence/i);
});
test('explicit choices are preserved and conflicts are reported without pretending success',()=>{
 const a=selectDesign({purpose:'qa',template:'T3',recentTemplates:['T3','T3']});assert.equal(a.template,'T3');
 const b=selectDesign({purpose:'document',template:'T6',evidenceRequired:true,availableMedia:['comic','evidence']});assert.equal(b.template,'T6');assert.equal(b.status,'needs-review');assert.ok(b.alternatives.every(t=>['T2','T3','T8'].includes(t.template)));
});
test('recent use can break a suitable tie without forcing all eight styles into rotation',()=>{
 assert.equal(selectDesign({purpose:'guide'}).template,'T2');
 assert.equal(selectDesign({purpose:'guide',recentTemplates:['T2']}).template,'T3');
 assert.equal(selectDesign({purpose:'guide',density:'high',recentTemplates:['T3']}).template,'T3');
});
test('T7/T8 select an illustrated variant only when imagery has a contextual purpose',()=>{
 assert.match(selectDesign({purpose:'qa',availableMedia:['illustration']}).sampleInput,/t7\.json$/);
 assert.match(selectDesign({purpose:'qa',imageContext:true,availableMedia:['illustration']}).sampleInput,/t7-illustrated\.json$/);
 assert.match(selectDesign({direction:'S1',template:'T8',imageContext:true,availableMedia:['photo']}).sampleInput,/t8-illustrated\.json$/);
});
test('rejects incomplete or misspelled briefs and covers all eight purposes',()=>{
 assert.throws(()=>selectDesign({}),/valid direction/);
 assert.throws(()=>selectDesign({purpose:'qa',densitty:'high'}),/Unknown brief/);
 for(const [purpose,id] of Object.entries({guide:'S1',scenario:'S2',observation:'S3',document:'S4',comparison:'S5',qa:'S6',narrative:'S7',culture:'S8'}))assert.equal(selectDesign({purpose}).direction,id);
});

test('CLI reads only known local template metadata and never writes a history record',()=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
 const {execFileSync}=require('node:child_process');
 const {candidate,recordHistory,listHistory}=require('../scripts/content-history.cjs');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'austria-selection-history-')),ledger=path.join(dir,'history');
 for(const [i,input] of [
  {title:'空间观察样例',body:'桌椅、光线与空间关系的观察记录。',template:'T4'},
  {title:'无模板元数据的旧记录',body:'已有记录没有明确的视觉模板编号。'},
  {title:'文化资料记录',body:'文化资料的来源与读取日期整理。',template:'T5'}
 ].entries())recordHistory(ledger,candidate(input),{now:`2026-11-10T0${i+1}:00:00Z`});
 const file=path.join(dir,'brief.json');fs.writeFileSync(file,JSON.stringify({purpose:'culture',availableMedia:['illustration']}));
 const result=JSON.parse(execFileSync(process.execPath,[path.join(__dirname,'../scripts/select-design.cjs'),'--input',file,'--history-dir',ledger],{encoding:'utf8'}));
 assert.equal(result.historyContext.recordsChecked,3);assert.equal(result.historyContext.worksWithKnownTemplate,2);assert.equal(listHistory(ledger).length,3);
 assert.equal(result.sampleIsReference,true);assert.ok(!JSON.stringify(result).includes('无模板元数据的旧记录'));
});
