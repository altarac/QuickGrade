import {chromium} from 'playwright';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1095,height:930}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('https://quickgrade.test/**',async r=>r.fulfill({contentType:'text/html',body:await readFile('index.html','utf8')}));
await page.goto('https://quickgrade.test');
const source=(await Promise.all(['src/types/quizModel.js','src/utils/sheetLayout.js','src/utils/omrEngine.js','src/utils/sheetQrData.js','src/utils/sheetQr.js','src/utils/sheetGenerator.js'].map(f=>readFile(f,'utf8')))).map(s=>s.replace(/^import .*;\n/gm,'').replace(/export /g,'')).join('\n');
const quiz={id:'fixed',title:'Five-question quiz',numQuestions:5,options:['A','B','C','D'],pointsPerQuestion:2,answerKey:{1:'A',2:'B',3:'C',4:'D',5:'A'},submissions:[]};
await page.evaluate(({source,quiz})=>{
 const api=new Function(source+';return {drawBubbleSheetToCanvas,scanBubbleSheet,getSheetLayout,mapPoint};')();
 for(const count of [4,5]){
  const q={...quiz,options:'ABCDE'.slice(0,count).split('')};
  const short=document.createElement('canvas'),long=document.createElement('canvas');short.width=long.width=1200;short.height=long.height=1600;
  let arcs=0;const ctx=short.getContext('2d');const arc=ctx.arc.bind(ctx);ctx.arc=(...a)=>{arcs++;return arc(...a);};
  api.drawBubbleSheetToCanvas(short,q,{date:''});
  if(arcs!==20*count+4)throw new Error(`Expected 20 rows of ${count} bubbles, got ${arcs-4} circles`);
  api.drawBubbleSheetToCanvas(long,{...q,numQuestions:20},{date:''});
  const a=ctx.getImageData(110,390,1000,1100).data,b=long.getContext('2d').getImageData(110,390,1000,1100).data;
  if(a.some((v,i)=>v!==b[i]))throw new Error('Printed grid changed with quiz length');
  const layout=api.getSheetLayout(5,q.options);
  const corners={tl:{x:72,y:80},tr:{x:1128,y:80},bl:{x:72,y:1520},br:{x:1128,y:1520}};
  for(let n=1;n<=20;n++)for(const opt of q.options){
   const c=layout.questions[n].options[opt],p=api.mapPoint(c.u,c.v,corners);
   // Every unused row is multiply marked. It must have no effect on the grade.
   if(n>5||q.answerKey[n]===opt){ctx.fillStyle='#111';ctx.beginPath();ctx.arc(p.x,p.y,c.radius*1056*.88,0,Math.PI*2);ctx.fill();}
  }
  const scan=api.scanBubbleSheet(short,q);
  if(scan.score!==10||scan.totalPossible!==10||Object.keys(scan.answers).length!==5)throw new Error('Unused rows affected a five-question grade');
  // Even an unreadable unused grid must not block reading the five active questions.
  ctx.fillStyle='white';ctx.fillRect(110,940,1000,560);
  if(api.scanBubbleSheet(short,q).score!==10)throw new Error('Unused rows were required by the scanner');
 }
 const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=1600;
 let rejected=false;try{api.scanBubbleSheet(canvas,{...quiz,numQuestions:21});}catch(e){rejected=e.message.includes('1–20');}
 if(!rejected)throw new Error('Scanner accepted more than 20 questions');
}, {source,quiz});
// New Quiz is directly visible without opening the quiz selector.
await page.evaluate(q=>localStorage.setItem('quickgrade_quizzes_v2',JSON.stringify([q])),quiz);await page.reload();
await page.getByRole('button',{name:'New Quiz',exact:true}).waitFor();
assert.equal(await page.getByRole('button',{name:'Choose quiz'}).getAttribute('aria-expanded'),'false');
await page.screenshot({path:'tests/new-quiz-desktop.png',fullPage:true});
await page.getByRole('button',{name:'New Quiz',exact:true}).click();
await page.getByRole('heading',{name:'Create New Quiz'}).waitFor();
const count=page.getByRole('spinbutton',{name:'Number of questions'}).last();
assert.equal(await count.getAttribute('max'),'20');
await count.fill('20');assert.equal(await page.getByRole('dialog').getByRole('button',{name:'Increase question count',exact:true}).isDisabled(),true);
await page.locator('input[placeholder="e.g. Chapter 4: Photosynthesis Quiz"]').fill('Twenty questions');
await count.fill('21');await page.getByRole('button',{name:'Create Quiz',exact:true}).click();
assert.equal(await page.getByRole('heading',{name:'Create New Quiz'}).isVisible(),true,'Creation accepted 21 questions');
await count.fill('20');await page.getByRole('button',{name:'Create Quiz',exact:true}).click();
assert.equal(await page.getByRole('spinbutton',{name:'Number of questions'}).inputValue(),'20');
await page.getByRole('button',{name:'ABCD Pattern',exact:true}).click();
await page.getByRole('button',{name:'Bubble Sheets',exact:true}).click();
await page.getByLabel('20-row bubble sheet; only rows 1–20 are graded').waitFor();
await page.screenshot({path:'tests/fixed-sheet-desktop.png',fullPage:true});
await page.setViewportSize({width:390,height:844});
await page.screenshot({path:'tests/new-quiz-mobile.png',fullPage:true});
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'New Quiz mobile overflow');
await page.getByRole('button',{name:'New Quiz',exact:true}).click();
assert.equal(await page.getByRole('heading',{name:'Create New Quiz'}).isVisible(),true);
await page.screenshot({path:'tests/new-quiz-modal-mobile.png',fullPage:true});
await page.getByRole('button',{name:'Close new quiz',exact:true}).click();
await page.setViewportSize({width:320,height:700});
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Small mobile header overflow');
// Preserve historical records above 20, while preventing new scanning of them.
await page.evaluate(q=>localStorage.setItem('quickgrade_quizzes_v2',JSON.stringify([{...q,numQuestions:30,title:'Older quiz',submissions:[{id:'old',quizId:q.id,studentName:'Saved older student',score:24,totalPossible:30,scannedAt:new Date().toISOString(),answers:Object.fromEntries(Array.from({length:30},(_,i)=>[i+1,{selected:'A'}]))}]}])),quiz);await page.reload();
await page.getByRole('heading',{name:'Keep your older quiz records'}).waitFor();
assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('quickgrade_quizzes_v2'))[0].numQuestions),30);
await page.getByRole('button',{name:'Scan',exact:true}).click();
assert.equal(await page.getByRole('button',{name:'Start Camera',exact:true}).count(),0);
await page.getByRole('button',{name:'Open Gradebook',exact:true}).click();
assert.equal(await page.getByRole('heading',{name:'Keep your older quiz records'}).count(),0);
await page.getByText('Saved older student',{exact:true}).waitFor();
assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('quickgrade_quizzes_v2'))[0].submissions[0].totalPossible),30);
assert.deepEqual(errors,[]);
console.log('Fixed 20-row printing for 4/5 choices, unchanged grid positions, only five rows scored despite unused marks, 20-question limit, visible desktop/mobile New Quiz, and older history preservation passed.');
await browser.close();
