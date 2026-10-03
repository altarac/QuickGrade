import { chromium } from 'playwright';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,args:["--use-fake-device-for-media-stream","--use-fake-ui-for-media-stream"]});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const requests=[];page.on('request',r=>requests.push(r.url()));
await page.route('https://quickgrade.test/**',async route=>route.fulfill({contentType:'text/html',body:await readFile('index.html','utf8')}));
await page.goto('https://quickgrade.test');
await page.getByRole('heading',{name:'Welcome to QuickGrade'}).waitFor();
const files=['src/types/quizModel.js','src/utils/sheetLayout.js','src/utils/omrEngine.js','src/utils/sheetGenerator.js'];
const source=(await Promise.all(files.map(f=>readFile(f,'utf8')))).map(s=>s.replace(/^import .*;\n/gm,'').replace(/export /g,'')).join('\n')+'\n// TEST_SEED='+String(process.env.TEST_SEED||1)+'\n';
const results=await page.evaluate(source=> {
  let seed=Number(source.match(/TEST_SEED=(\d+)/)?.[1]||1);Math.random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const api=new Function(source+';return {drawBubbleSheetToCanvas,scanBubbleSheet,mapPoint,generateSimulatedTestSheet,detectCornerMarkers};')();
  const results=[];
  for(const n of [1,5,10,25,50,100])for(const optionCount of [4,5]) {
    const quiz={id:'test',title:'Test',numQuestions:n,options:'ABCDE'.slice(0,optionCount).split(''),answerKey:{},pointsPerQuestion:2};
    for(let q=1;q<=n;q++)quiz.answerKey[q]=quiz.options[(q-1)%optionCount];
    for(const target of [0,Math.round(n*.8),n]) {
      const {canvas}=api.generateSimulatedTestSheet(quiz,'Test Student',target);
      const scan=api.scanBubbleSheet(canvas,quiz);
      if(scan.score!==target*2)throw new Error(`Scan ${n}/${optionCount} target ${target}: got ${scan.score/2}; `+JSON.stringify(Object.values(scan.answers).filter(a=>!a.isCorrect).map(a=>[a.questionNumber,a.selected])));
      results.push(`${n} questions/${optionCount} options: ${target}/${n} correct`);
    }
    const reduced=document.createElement('canvas');reduced.width=600;reduced.height=800;
    const full=api.generateSimulatedTestSheet(quiz,'Reduced camera frame',n).canvas;
    reduced.getContext('2d').drawImage(full,0,0,600,800);
    if(api.scanBubbleSheet(reduced,quiz).score!==n*2)throw new Error('Reduced live-frame accuracy failed '+n+'/'+optionCount);
    const blank=document.createElement('canvas');blank.width=1200;blank.height=1600;api.drawBubbleSheetToCanvas(blank,quiz);
    const scan=api.scanBubbleSheet(blank,quiz);
    if(Object.values(scan.answers).some(a=>a.selected!=='BLANK'))throw new Error('Blank sheet misread '+n);
    if(n===10&&optionCount===4) {
      const ctx=blank.getContext('2d');
      for(const opt of ['A','B']) {const o=scan.answers[1].options[opt];ctx.fillStyle='#111';ctx.beginPath();ctx.arc(o.pixelX,o.pixelY,o.radius*.88,0,Math.PI*2);ctx.fill();}
      if(api.scanBubbleSheet(blank,quiz).answers[1].selected!=='MULTI')throw new Error('Double mark missed');
      ctx.fillStyle='white';ctx.fillRect(0,0,130,140);
      let rejected=false;try {api.scanBubbleSheet(blank,quiz);}catch{rejected=true;}
      if(!rejected)throw new Error('Missing corner accepted');
    }
  }
  const quiz={id:'photo',title:'Photo test',numQuestions:50,options:['A','B','C','D','E'],answerKey:{},pointsPerQuestion:1};
  for(let q=1;q<=50;q++)quiz.answerKey[q]=quiz.options[(q-1)%5];
  const {canvas}=api.generateSimulatedTestSheet(quiz,'Photo',40);
  const src=canvas.getContext('2d').getImageData(0,0,1200,1600);
  const c={tl:{x:190,y:80},tr:{x:720,y:125},bl:{x:110,y:795},br:{x:820,y:740}};
  const dx1=c.tr.x-c.br.x,dx2=c.bl.x-c.br.x,dy1=c.tr.y-c.br.y,dy2=c.bl.y-c.br.y;
  const sx=c.tl.x-c.tr.x+c.br.x-c.bl.x,sy=c.tl.y-c.tr.y+c.br.y-c.bl.y,det=dx1*dy2-dx2*dy1;
  const g=(sx*dy2-dx2*sy)/det,h=(dx1*sy-sx*dy1)/det;
  const a=c.tr.x-c.tl.x+g*c.tr.x,b=c.bl.x-c.tl.x+h*c.bl.x,d=c.tr.y-c.tl.y+g*c.tr.y,e=c.bl.y-c.tl.y+h*c.bl.y;
  const photo=document.createElement('canvas');photo.width=1000;photo.height=900;
  const pc=photo.getContext('2d');const out=pc.createImageData(1000,900);
  for(let y=0;y<900;y++)for(let x=0;x<1000;x++) {
    const A=a-x*g,B=b-x*h,D=d-y*g,E=e-y*h,F=x-c.tl.x,G=y-c.tl.y,z=A*E-B*D;
    const u=(F*E-B*G)/z,v=(A*G-F*D)/z;
    const px=Math.round((.06+.88*u)*1200),py=Math.round((.05+.90*v)*1600),i=(y*1000+x)*4;
    let rgb=[130,132,134];
    if(px>=0&&px<1200&&py>=0&&py<1600) {const k=(py*1200+px)*4;const shadow=.72+.23*x/1000;rgb=[src.data[k]*shadow,src.data[k+1]*shadow,src.data[k+2]*shadow];}
    out.data[i]=rgb[0];out.data[i+1]=rgb[1];out.data[i+2]=rgb[2];out.data[i+3]=255;
  }
  pc.putImageData(out,0,0);
  let photoScan;try{photoScan=api.scanBubbleSheet(photo,quiz);}catch(e){throw new Error(e.message+JSON.stringify(api.detectCornerMarkers(out,1000,900)));}
  if(photoScan.score!==40)throw new Error('Perspective / shadow test expected 40, got '+photoScan.score);
  results.push('Perspective distortion and uneven lighting: 40/50 correct');
  const legacyQuiz={id:'legacy',title:'Older sheet',numQuestions:5,options:['A','B','C','D'],answerKey:{1:'A',2:'A',3:'A',4:'A',5:'A'},pointsPerQuestion:1};
  const legacy=document.createElement('canvas');legacy.width=1200;legacy.height=1600;
  api.drawBubbleSheetToCanvas(legacy,legacyQuiz);
  const lc=legacy.getContext('2d');lc.fillStyle='white';lc.fillRect(110,300,1000,1170);
  const known=[];
  for(let q=1;q<=5;q++)for(let i=0;i<4;i++) {
    const x=72+1056*(.333+i*.177),y=80+1440*(.27+(q-1)*.15);known.push({q,i,x,y});
    lc.strokeStyle='#475569';lc.lineWidth=1.8;lc.beginPath();lc.arc(x,y,22,0,Math.PI*2);lc.stroke();
    if(i===(['A','B','A','A','B'][q-1].charCodeAt(0)-65)) {lc.fillStyle='#0f172a';lc.beginPath();lc.arc(x,y,19.5,0,Math.PI*2);lc.fill();}
    else {lc.font='bold 19px sans-serif';lc.textAlign='center';lc.textBaseline='middle';lc.fillStyle='#64748b';lc.fillText('ABCD'[i],x,y);}
  }
  const legacyScan=api.scanBubbleSheet(legacy,legacyQuiz);
  if(legacyScan.score!==3)throw new Error('Legacy spacing should score 3/5, got '+legacyScan.score);
  for(const p of known){const opt=legacyScan.answers[p.q].options['ABCD'[p.i]];if(Math.hypot(opt.pixelX-p.x,opt.pixelY-p.y)>3)throw new Error('Legacy overlay center mismatch');}
  if(api.scanBubbleSheet(legacy,legacyQuiz,{previousLayout:legacyScan.layout}).score!==3)throw new Error('Validated legacy layout cache changed score');
  const current=api.generateSimulatedTestSheet(legacyQuiz,'New layout',5).canvas;
  const newScan=api.scanBubbleSheet(current,legacyQuiz,{previousLayout:legacyScan.layout});
  if(newScan.score!==5||Math.abs(newScan.answers[1].options.A.pixelX-(.06+.88*.3675)*1200)>3)throw new Error('Old layout cache was reused on a different printed grid');
  window.__legacySheet=legacy.toDataURL('image/png');
  results.push('Older five-question layout with letters: 3/5, all overlay centers within 3 pixels');
  const empty=document.createElement('canvas');empty.width=800;empty.height=1000;empty.getContext('2d').fillStyle='white';empty.getContext('2d').fillRect(0,0,800,1000);
  let rejected=false;try{api.scanBubbleSheet(empty,quiz)}catch{rejected=true;}if(!rejected)throw new Error('No-sheet image accepted');
  return results;
},source);
console.log('OMR cases passed:',results.length,results.at(-1));
const legacyUrl=await page.evaluate(()=>window.__legacySheet);
if(process.env.OMR_ONLY){await browser.close();process.exit(0);}
await page.locator('input[type=text]').first().fill('Verification Quiz');
await page.getByRole('button',{name:'Create Quiz & Set Answer Key'}).click();
await page.getByRole('button',{name:'ABCD Pattern',exact:true}).click();
await page.getByRole('button',{name:'Scan',exact:true}).click();
await page.getByRole('button',{name:'Test Demo Paper',exact:true}).click();
await page.getByRole('heading',{name:/Score: 10 \/ 10/}).waitFor();
await page.getByRole('button',{name:'Question 1: set B',exact:true}).click();
await page.getByRole('heading',{name:/Score: 9 \/ 10/}).waitFor();
await page.getByRole('button',{name:'Question 1: set BLANK',exact:true}).click();
await page.locator('input[placeholder="e.g. Maya Lin"]').fill('Student "Quoted", Name');
await page.getByRole('button',{name:'Save & Scan Next Student'}).click();
await page.getByRole('button',{name:'Gradebook',exact:true}).click();
await page.getByText('Student "Quoted", Name',{exact:true}).waitFor();
await page.evaluate(()=>scrollTo(0,0));
await page.screenshot({path:'tests/desktop.png',fullPage:true});
await page.reload();
await page.getByRole('button',{name:'Gradebook',exact:true}).click();
await page.getByText('Student "Quoted", Name',{exact:true}).waitFor();
await page.setViewportSize({width:390,height:844});
await page.getByRole('button',{name:'Answer Key',exact:true}).click();
await page.screenshot({path:'tests/mobile.png',fullPage:true});
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Mobile horizontal overflow');
await page.setViewportSize({width:1440,height:1000});
await page.getByRole('button',{name:'Bubble Sheets',exact:true}).click();
await page.getByRole('button',{name:'Fill 100% Score',exact:true}).click();
await page.evaluate(()=>{window.print=()=>{window.__printed=true;};});
await page.getByRole('button',{name:'Print Sheet Now',exact:true}).click();
await page.waitForFunction(()=>window.__printed);
const printedBlank=await page.evaluate(source=> {
  const api=new Function(source+';return {scanBubbleSheet};')();
  const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=1600;
  canvas.getContext('2d').drawImage(document.getElementById('print-sheet'),0,0);
  const quiz=JSON.parse(localStorage.getItem('quickgrade_quizzes_v2'))[0];
  return Object.values(api.scanBubbleSheet(canvas,quiz).answers).every(a=>a.selected==='BLANK');
},source);
assert.equal(printedBlank,true,'Printing retained simulated student marks');
await page.emulateMedia({media:'print'});
assert.equal(await page.locator('#print-sheet').isVisible(),true);
await page.emulateMedia({media:'screen'});
const dataUrl=await page.evaluate(source=> {
  const api=new Function(source+';return {generateSimulatedTestSheet};')();
  const quiz=JSON.parse(localStorage.getItem('quickgrade_quizzes_v2'))[0];
  return api.generateSimulatedTestSheet(quiz,'Upload Test',7).canvas.toDataURL('image/png');
},source);
await page.getByRole('button',{name:'Scan',exact:true}).click();
await page.locator('input[type=file]').last().setInputFiles({name:'student-sheet.png',mimeType:'image/png',buffer:Buffer.from(dataUrl.split(',')[1],'base64')});
await page.getByRole('heading',{name:/Score: 7 \/ 10/}).waitFor();
await page.getByRole('button',{name:'Discard & Rescan'}).click();
await page.getByRole('button',{name:'Gradebook',exact:true}).click();
const csvPending=page.waitForEvent('download');
await page.getByRole('button',{name:'Export CSV',exact:true}).click();
const csvDownload=await csvPending;
const stream=await csvDownload.createReadStream();let csv='';for await(const chunk of stream)csv+=chunk.toString();
assert.ok(csv.includes('"Student ""Quoted"", Name"'),'CSV did not escape quotes and commas');
const backupPending=page.waitForEvent('download');
await page.getByRole('button',{name:'Download backup',exact:true}).click();
const backup=await backupPending;const bs=await backup.createReadStream();let json='';for await(const chunk of bs)json+=chunk.toString();
assert.equal(JSON.parse(json)[0].submissions.length,1);
await page.getByLabel('Restore quiz backup').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(json)});
await page.getByText('Restored 1 quizzes. Existing quizzes were kept.',{exact:true}).waitFor();
assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('quickgrade_quizzes_v2')).length),2);
console.log('Photo upload, blank printing, CSV quoting, backup export and restore passed.');
await page.evaluate(()=>localStorage.setItem('quickgrade_quizzes_v2',JSON.stringify([{id:'legacy-ui',title:'Older five-question sheet',numQuestions:5,options:['A','B','C','D'],pointsPerQuestion:1,answerKey:{1:'A',2:'A',3:'A',4:'A',5:'A'},submissions:[]}])));
await page.reload();await page.getByRole('button',{name:'Scan',exact:true}).click();
await page.getByRole('button',{name:'Start Camera',exact:true}).click();
await page.locator('video').waitFor({state:'visible'});
await page.waitForFunction(()=>document.querySelector('video').videoWidth>0);
const aspect=await page.evaluate(()=>{const v=document.querySelector('video'),r=v.parentElement.getBoundingClientRect();return {frame:r.width/r.height,video:v.videoWidth/v.videoHeight};});
assert.ok(Math.abs(aspect.frame-aspect.video)<.02,'Camera guide container did not match video aspect');
assert.equal(await page.getByText('Align 4 black corner squares inside markers',{exact:true}).count(),0);
await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'tests/camera-fixed.png',fullPage:true});
await page.locator('input[type=file]').last().setInputFiles({name:'older-sheet.png',mimeType:'image/png',buffer:Buffer.from(legacyUrl.split(',')[1],'base64')});
await page.getByRole('heading',{name:/Score: 3 \/ 5/}).waitFor();
await page.screenshot({path:'tests/legacy-overlay-fixed.png',fullPage:true});
await page.getByRole('button',{name:'Align bubbles',exact:true}).click();
const alignImage=page.getByAltText('Sheet to align; tap the requested bubble center');
await alignImage.waitFor();
for(const [u,v] of [[.333,.27],[.864,.27],[.333,.87]]){
 const box=await alignImage.boundingBox();
 await alignImage.click({position:{x:(.06+.88*u)*box.width,y:(.05+.90*v)*box.height}});
}
await page.getByRole('heading',{name:/Score: 3 \/ 5/}).waitFor();
console.log('Camera aspect, older-sheet upload overlay, and manual bubble alignment passed.');
assert.deepEqual(errors,[]);
assert.equal(requests.filter(u=>/^https?:/.test(u)&&u!=='https://quickgrade.test/').length,0,'Standalone file requested network assets');
console.log('Standalone workflow passed: create, key, scan, correction, save, reload, mobile, no network assets.');
await browser.close();
