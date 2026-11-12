'use strict';
const fs=require('node:fs'),path=require('node:path');
const directions=require('../assets/information-directions.json');
const catalog=require('../assets/templates/catalog.json');
const history=require('./content-history.cjs');
const purposeToDirection={guide:'S1',scenario:'S2',observation:'S3',document:'S4',comparison:'S5',qa:'S6',narrative:'S7',culture:'S8'};
const media=['photo','illustration','comic','evidence'];
const layouts={S1:['cover','cards','worksheet','checklist'],S2:['poster','dialogue','feature','cards'],S3:['poster','feature','cards','feature'],S4:['cover','feature','worksheet','qa'],S5:['cover','bands','worksheet','step-grid'],S6:['cover','qa','qa','qa'],S7:['poster','feature','journey','cards'],S8:['poster','feature','bands','qa']};
function need(ok,message){if(!ok)throw new Error(message);}
function selectDesign(input){
 need(input&&typeof input==='object'&&!Array.isArray(input),'Brief must be an object');
 const allowed=['purpose','direction','template','density','visualIntent','availableMedia','canGenerate','recentTemplates','evidenceRequired','imageContext'];
 for(const key of Object.keys(input))need(allowed.includes(key),'Unknown brief field: '+key);
 const b={density:'medium',visualIntent:'auto',availableMedia:[],canGenerate:[],recentTemplates:[],evidenceRequired:false,imageContext:false,...input};
 if(b.purpose!==undefined)need(Object.hasOwn(purposeToDirection,b.purpose),'Unknown purpose');
 const direction=b.direction||purposeToDirection[b.purpose];
 need(directions.some(d=>d.id===direction),'Provide a valid direction or purpose');
 if(b.template!==undefined)need(catalog.some(t=>t.id===b.template),'Unknown template');
 need(['low','medium','high'].includes(b.density),'Unknown density');
 need(['auto','none','photo','illustration','comic'].includes(b.visualIntent),'Unknown visualIntent');
 for(const key of ['availableMedia','canGenerate'])need(Array.isArray(b[key])&&b[key].every(m=>media.includes(m)&&(key!=='canGenerate'||m!=='evidence')),'Invalid '+key+'; generated evidence is never accepted');
 need(Array.isArray(b.recentTemplates)&&b.recentTemplates.every(t=>catalog.some(c=>c.id===t)),'Invalid recentTemplates');
 need(typeof b.evidenceRequired==='boolean'&&typeof b.imageContext==='boolean','Evidence and image context must be boolean');
 if(direction==='S4')b.evidenceRequired=true;
 const preferred=directions.find(d=>d.id===direction).templates.split('/').map(s=>s.trim());
 const ranked=catalog.map(t=>{
  const reasons=[];let score=30,index=preferred.indexOf(t.id);
  if(index>=0){score=100-index*12;reasons.push('Fits '+direction+' information task');}
  if(b.density==='high'){
   const adjustment={T1:-5,T2:15,T3:40,T4:-35,T5:-35,T6:-40,T7:10,T8:20}[t.id];score+=adjustment;
   reasons.push('High-density suitability adjustment: '+adjustment);
  }
  const visualTarget={photo:'T4',illustration:'T5',comic:'T6'}[b.visualIntent];
  if(t.id===visualTarget){score+=80;reasons.push('Matches requested medium preference');}
  const requiredMedium={T4:'photo',T5:'illustration',T6:'comic'}[t.id];
  if(requiredMedium&&!b.availableMedia.includes(requiredMedium)&&b.availableMedia.some(m=>m!=='evidence')){score-=b.canGenerate.includes(requiredMedium)?8:50;reasons.push('Accounts for available scene material and generation capability');}
  const recency=b.recentTemplates.slice(0,3).reduce((n,id,i)=>n+(id===t.id?[18,10,5][i]:0),0);
  if(recency){score-=Math.min(b.density==='high'?6:24,recency);reasons.push('Soft recent-use penalty; never overrides explicit choice');}
  const evidenceConflict=b.evidenceRequired&&!['T2','T3','T8'].includes(t.id);
  return {template:t.id,name:t.name,score,reasons,evidenceConflict};
 }).sort((a,c)=>c.score-a.score||a.template.localeCompare(c.template));
 const compatible=ranked.filter(t=>!t.evidenceConflict);
 const chosen=b.template?ranked.find(t=>t.template===b.template):compatible[0];
 const conflicts=[];
 if(chosen.evidenceConflict)conflicts.push('Requested template is unsuitable as the primary original-document reading system; use T2/T3/T8 or explicitly design a separate evidence page.');
 if(b.evidenceRequired&&b.visualIntent!=='auto'&&b.visualIntent!=='none')conflicts.push('Scene artwork cannot replace the required original evidence.');
 const required={T4:'photo',T5:'illustration',T6:'comic'}[chosen.template];
 const missing=[];
 if(required&&!b.availableMedia.includes(required))missing.push(required);
 if(b.evidenceRequired&&!b.availableMedia.includes('evidence'))missing.push('evidence');
 if(required&&b.visualIntent==='none')conflicts.push('The requested no-image treatment conflicts with this image-led template.');
 const illustrated=['T7','T8'].includes(chosen.template)&&b.imageContext&&b.visualIntent!=='none'&&b.availableMedia.some(m=>m!=='evidence');
 const pageLayouts=[...layouts[direction]];
 if(illustrated)pageLayouts[0]='poster';
 if(b.evidenceRequired)pageLayouts[0]='cover';
 return {
  status:conflicts.length?'needs-review':missing.length?'needs-assets':'ready-for-planning',direction,template:chosen.template,
  sampleInput:'assets/templates/'+chosen.template.toLowerCase()+(illustrated?'-illustrated':'')+'.json',
  selection:b.template?'explicit-user-choice':'ranked-heuristic',reasons:chosen.reasons,
  alternatives:compatible.filter(t=>t.template!==chosen.template).slice(0,2),conflicts,
  missingMedia:missing.map(type=>({type,canGenerate:type!=='evidence'&&b.canGenerate.includes(type)})),
  imagePolicy:b.evidenceRequired?'Original evidence required; contextual scenes optional':required?'Image-led; independent matching scenes required':illustrated?'Contextual image cover; keep information pages readable':'Images optional; use only when they explain or support the content',
  sampleIsReference:true,
  suggestedLayouts:pageLayouts,densityAction:b.density==='high'?'Use wide columns or split pages; preserve all protected content, never silently shrink or remove it':'Use content-sized groups; avoid stretching short answers into empty tall cards',
  footer:'奥地利求学就业桔',reviewRequired:'Agent checks semantic intent, evidence, media relevance, actual layout and recent work. Scores are editorial heuristics, not measured quality probabilities.'
 };
}
module.exports={selectDesign};
if(require.main===module){try{
 const flags={};for(let i=2;i<process.argv.length;i+=2){need(['--input','--history-dir'].includes(process.argv[i])&&process.argv[i+1]&&!process.argv[i+1].startsWith('--'),'Usage: node scripts/select-design.cjs --input brief.json [--history-dir absolute-path]');need(!flags[process.argv[i]],'Duplicate option');flags[process.argv[i]]=process.argv[i+1];}
 need(flags['--input'],'Input brief required');
 const brief=JSON.parse(fs.readFileSync(path.resolve(flags['--input']),'utf8').replace(/^\uFEFF/,''));
 let historyContext={source:'explicit brief',recordsChecked:0};
 if(brief.recentTemplates===undefined){
  const records=history.listHistory(history.historyRoot(flags['--history-dir']));const seen=new Set();const recent=[];
  for(const record of [...records].reverse()){const template=record.content?.snapshot?.template;if(!seen.has(record.workId)&&catalog.some(t=>t.id===template)){seen.add(record.workId);recent.push(template);}}
  brief.recentTemplates=recent.slice(0,3);historyContext={source:'configured local ledger, read-only',recordsChecked:records.length,worksWithKnownTemplate:seen.size,scope:'Records without explicit template metadata are not guessed; no account or chat scanning.'};
 }
 console.log(JSON.stringify({...selectDesign(brief),historyContext},null,2));
}catch(e){console.error(e.message);process.exitCode=1;}}
