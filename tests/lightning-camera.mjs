// Scores a sequence through a real video/canvas path, using generated camera frames.
import {chromium} from 'playwright';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1151,height:930}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{
 const scene=document.createElement('canvas');scene.width=1280;scene.height=960;const ctx=scene.getContext('2d');ctx.fillStyle='#aaa';ctx.fillRect(0,0,1280,960);
 const video=document.createElement('canvas');video.width=1280;video.height=960;window.__cameraScene=scene;
 const paint=()=>{video.getContext('2d').drawImage(scene,0,0);requestAnimationFrame(paint);};requestAnimationFrame(paint);
 Object.defineProperty(navigator,'mediaDevices',{value:{getUserMedia:async()=>video.captureStream(30),enumerateDevices:async()=>[]}});
});
await page.route('https://quickgrade.test/**',async r=>r.fulfill({contentType:'text/html',body:await readFile('index.html','utf8')}));
await page.goto('https://quickgrade.test');
const quiz={id:'lightning',title:'Lightning test',numQuestions:10,options:['A','B','C','D'],pointsPerQuestion:2,answerKey:Object.fromEntries(Array.from({length:10},(_,i)=>[i+1,'ABCD'[i%4]])),submissions:[]};
await page.evaluate(q=>localStorage.setItem('quickgrade_quizzes_v2',JSON.stringify([q])),quiz);await page.reload();
await page.getByRole('button',{name:'Scan',exact:true}).click();
await page.getByRole('button',{name:'Lightning mode',exact:true}).click();
await page.getByRole('button',{name:'Start Camera',exact:true}).click();
await page.getByText(/Markers: 0\/4/).waitFor();
const source=(await Promise.all(['src/types/quizModel.js','src/utils/sheetLayout.js','src/utils/omrEngine.js','src/utils/sheetGenerator.js'].map(f=>readFile(f,'utf8')))).map(s=>s.replace(/^import .*;\n/gm,'').replace(/export /g,'')).join('\n');
await page.evaluate(()=>{
 window.__scores=[];
 new MutationObserver(()=>{const h=document.querySelector('[data-testid="lightning-score"] h3');const at=document.querySelector('[data-testid="lightning-score"]').dataset.scoredAt;if(h&&window.__scores.at(-1)?.at!==at)window.__scores.push({text:h.textContent,at,time:performance.now()});}).observe(document.querySelector('[data-testid="lightning-score"]'),{subtree:true,childList:true,characterData:true,attributes:true});
});
const paint=async(target,x=640,angle=12)=>page.evaluate(({source,quiz,target,x,angle})=>{
 const scene=window.__cameraScene,ctx=scene.getContext('2d');ctx.fillStyle='#aaa';ctx.fillRect(0,0,1280,960);
 if(target!==null){const api=new Function(source+';return {generateSimulatedTestSheet};')();const {canvas}=api.generateSimulatedTestSheet(quiz,'',target);ctx.save();ctx.translate(x,480);ctx.rotate(angle*Math.PI/180);ctx.drawImage(canvas,-300,-400,600,800);ctx.restore();}
 return performance.now();
},{source,quiz,target,x,angle});
const started=await paint(8);
await page.getByRole('heading',{name:'Lightning score: 16 / 20',exact:true}).waitFor();
const latency=await page.evaluate(t=>window.__scores[0].time-t,started);
assert.ok(latency<1800,`First live score took ${latency}ms`);
// The live video must continue playing while the score is shown.
const videoTime=await page.locator('video').evaluate(v=>v.currentTime);
await page.waitForTimeout(800);
assert.ok(await page.locator('video').evaluate(v=>v.currentTime)>videoTime+.4,'Video froze after scoring');
assert.equal(await page.locator('input[placeholder="e.g. Maya Lin"]').count(),0,'Lightning opened student review');
assert.equal(await page.evaluate(()=>window.__scores.length),1,'Held sheet repeatedly published');
await page.screenshot({path:'tests/lightning-desktop.png',fullPage:true});
// A different answer pattern is detected without requiring a gap.
await paint(6,640,0);
await page.getByRole('heading',{name:'Lightning score: 12 / 20',exact:true}).waitFor();
// A gap permits the next sheet even when its score is identical.
await paint(null);await page.getByText(/Markers: 0\/4/).waitFor();await page.waitForTimeout(450);
const countBefore=await page.evaluate(()=>window.__scores.length);
await paint(10);
await page.getByRole('heading',{name:'Lightning score: 20 / 20',exact:true}).waitFor();
assert.equal(await page.evaluate(()=>window.__scores.length),countBefore+1);
// An identical answer sheet after a gap must publish again without changing the displayed number.
await paint(null);await page.getByText(/Markers: 0\/4/).waitFor();await page.waitForTimeout(450);
await paint(10);
await page.waitForFunction(()=>window.__scores.length===4);
// Missing corners must never fabricate a new score.
await page.evaluate(()=>{window.__cameraScene.getContext('2d').fillStyle='#aaa';window.__cameraScene.getContext('2d').fillRect(200,0,500,170);});
await page.waitForTimeout(800);
assert.equal(await page.evaluate(()=>window.__scores.length),4);
assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('quickgrade_quizzes_v2'))[0].submissions.length),0,'Lightning saved a submission');
await page.setViewportSize({width:390,height:844});
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Lightning mobile overflow');
await page.screenshot({path:'tests/lightning-mobile.png',fullPage:true});
await page.getByRole('button',{name:'Lightning mode',exact:true}).click();
await page.getByRole('button',{name:'Test Demo Paper',exact:true}).click();
await page.getByRole('heading',{name:'Score: 20 / 20 (100%)',exact:true}).waitFor();
assert.deepEqual(errors,[]);
console.log(`Lightning live score in ${Math.round(latency)}ms; video continues, successive sheets update, held sheets do not repeat, missing corners rejected, no records saved, mobile fits, review mode still available.`);
await browser.close();
