import {chromium} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage();
const source=(await Promise.all(['src/types/quizModel.js','src/utils/sheetLayout.js','src/utils/omrEngine.js','src/utils/sheetGenerator.js'].map(f=>readFile(f,'utf8')))).map(s=>s.replace(/^import .*;\n/gm,'').replace(/export /g,'')).join('\n');
const results=await page.evaluate(source=>{
 const api=new Function(source+';return {generateSimulatedTestSheet,detectCornerMarkers,detectBubbleLayout,scanBubbleSheet};')();
 const results=[];
 for(const n of [10,50,100]){
  const quiz={id:'perf',title:'Benchmark',numQuestions:n,options:['A','B','C','D'],answerKey:Object.fromEntries(Array.from({length:n},(_,i)=>[i+1,'ABCD'[i%4]])),pointsPerQuestion:1};
  const {canvas}=api.generateSimulatedTestSheet(quiz,'Benchmark',n);const ctx=canvas.getContext('2d',{willReadFrequently:true});const data=ctx.getImageData(0,0,canvas.width,canvas.height);
  const samples={corners:[],layout:[],total:[]};
  for(let i=0;i<12;i++){
   let t=performance.now();const corners=api.detectCornerMarkers(data,canvas.width,canvas.height);let t2=performance.now();api.detectBubbleLayout(data,canvas.width,canvas.height,corners,quiz);let t3=performance.now();const result=api.scanBubbleSheet(canvas,quiz);let t4=performance.now();
   if(result.score!==n)throw new Error('Benchmark scoring changed');
   if(i>=2){samples.corners.push(t2-t);samples.layout.push(t3-t2);samples.total.push(t4-t3);}
  }
  const median=values=>values.sort((a,b)=>a-b)[Math.floor(values.length/2)];results.push({questions:n,cornerMs:median(samples.corners),layoutMs:median(samples.layout),fullScanMs:median(samples.total)});
 }
 return results;
},source);
console.log(JSON.stringify(results,null,2));
if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(results,null,2)+'\n');
await browser.close();
