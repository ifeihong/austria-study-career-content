'use strict';
const fs=require('node:fs');
const {spawnSync}=require('node:child_process');
function assertNodeVersion(version=process.versions.node){
 if(!/^\d+\./.test(version)||Number(version.split('.')[0])<20)throw new Error('Node.js 20+ required; current version: '+version+'. Use a configured newer Node executable; no automatic installation is performed.');
}
function checkEnvironment(options={}){
 const mode=options.mode||'core';if(!['core','render','metrics'].includes(mode))throw new Error('Unknown environment mode');
 const checks=[];
 try{assertNodeVersion();checks.push({name:'node',ok:true,version:process.versions.node,executable:process.execPath});}
 catch(e){checks.push({name:'node',ok:false,message:e.message});}
 if(mode==='render'){
  try{
   const pw=require(options.playwrightModule||process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
   checks.push({name:'playwright',ok:true});
   const browser=options.browser||process.env.BROWSER_EXECUTABLE||pw.chromium.executablePath();
   checks.push({name:'browser',ok:fs.existsSync(browser),executable:browser,message:'File existence only; render still needs a launch check and readable Chinese fonts.'});
  }catch(e){checks.push({name:'playwright',ok:false,message:e.message});}
 }
 if(mode==='metrics'){
  const executable=options.python||process.env.PYTHON_EXECUTABLE||(process.platform==='win32'?'python':'python3');
  const r=spawnSync(executable,['-c','import sys; print(".".join(map(str,sys.version_info[:3]))); sys.exit(0 if sys.version_info >= (3,10) else 1)'],{encoding:'utf8',timeout:10000,windowsHide:true});
  checks.push({name:'python',ok:r.status===0,executable,version:r.stdout?.trim()||null,message:r.error?.message||r.stderr?.trim()||'Python 3.10+ standard library required.'});
 }
 return {mode,ok:checks.every(c=>c.ok),checks,scope:'Read-only dependency check; no installation, network request, render, font or platform verification.'};
}
module.exports={assertNodeVersion,checkEnvironment};
if(require.main===module){try{
 const opts={},flags={'--mode':'mode','--python':'python','--browser':'browser'};
 for(let i=2;i<process.argv.length;i+=2){const k=flags[process.argv[i]];if(!k||!process.argv[i+1]||opts[k])throw new Error('Usage: node scripts/check-env.cjs [--mode core|render|metrics] [--python executable] [--browser executable]');opts[k]=process.argv[i+1];}
 const report=checkEnvironment(opts);console.log(JSON.stringify(report,null,2));if(!report.ok)process.exitCode=1;
}catch(e){console.error(e.message);process.exitCode=1;}}
