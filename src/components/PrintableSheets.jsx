import React, { useRef, useEffect } from 'react';
import { Printer, Download } from 'lucide-react';
import { drawBubbleSheetToCanvas } from '../utils/sheetGenerator';
import { getAnswerRowInstructions } from '../utils/sheetLayout';

export default function PrintableSheets({ quiz, onUpdateQuiz }) {
  const canvasRef = useRef(null);
  const instructions=getAnswerRowInstructions(quiz.numQuestions);
  const choicesLocked=Boolean(quiz.submissions?.length);

  useEffect(() => {
    const canvas=canvasRef.current;
    if (!canvas) return;
    canvas.width=1200;
    canvas.height=1600;
    drawBubbleSheetToCanvas(canvas,quiz);
  }, [quiz]);

  const handleChoiceChange = (event) => {
    if(choicesLocked)return;
    const options=event.target.value.split('');
    const removed=Object.entries(quiz.answerKey||{}).filter(([,answer])=>!options.includes(answer));
    if(removed.length&&!window.confirm(`Switching to ABCD clears the E answers for question${removed.length===1?'':'s'} ${removed.map(([number])=>number).join(', ')}. You will need to set those answers again. Continue?`))return;
    const answerKey=Object.fromEntries(Object.entries(quiz.answerKey||{}).filter(([,answer])=>options.includes(answer)));
    onUpdateQuiz({...quiz,options,answerKey});
  };

  const handlePrint = () => {
    const blank=document.createElement('canvas');blank.width=1200;blank.height=1600;
    drawBubbleSheetToCanvas(blank,quiz,{date:''});
    const image=document.getElementById('print-sheet');
    image.onload=()=>{window.print();image.onload=null;};
    image.src=blank.toDataURL('image/png');
  };

  const handleDownloadImage = () => {
    const canvas=canvasRef.current;
    if(!canvas)return;
    const link=document.createElement('a');
    link.download=`QuickGrade_${quiz.title.replace(/\s+/g,'_')}_${quiz.options.join('')}_BubbleSheet.png`;
    link.href=canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div id="print-area"><img id="print-sheet" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" alt="Blank printable bubble sheet" /></div>
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 mb-8 no-print shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Print Bubble Sheets for Students</h1>
            <p className="text-sm text-slate-600 mt-2">
              Every sheet has 20 answer rows. {instructions.answer} {instructions.blank} Keep all four corner markers visible when scanning.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <label htmlFor="sheet-choices" className="text-sm font-semibold text-slate-700">Answer choices</label>
              <select id="sheet-choices" value={quiz.options.join('')} onChange={handleChoiceChange} disabled={choicesLocked} aria-describedby="sheet-choice-help" className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed">
                <option value="ABCD">ABCD — 4 choices</option>
                <option value="ABCDE">ABCDE — 5 choices</option>
              </select>
            </div>
            <p id="sheet-choice-help" className="text-xs text-slate-600 mt-2">
              {choicesLocked?'Create a new quiz to change choices after saving grades.':'Applies to this quiz’s answer key, scanner, and printed sheets.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button onClick={handleDownloadImage} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-sm font-semibold border border-slate-200 transition shadow-xs">
              <Download className="w-4 h-4 text-slate-500" />
              <span>Download PNG</span>
            </button>
            <button onClick={handlePrint} className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-md shadow-indigo-600/20 transition transform active:scale-95">
              <Printer className="w-4 h-4" />
              <span>Print Sheet Now</span>
            </button>
          </div>
        </div>
      </div>
      <div className="flex justify-center">
        <div className="sheet-container bg-white p-4 sm:p-8 rounded-3xl shadow-xl border border-slate-200 max-w-2xl w-full">
          <canvas ref={canvasRef} role="img" aria-label={`20-row ${quiz.options.join('')} bubble sheet; only rows 1–${quiz.numQuestions} are graded`} className="w-full h-auto rounded-lg shadow-xs" />
        </div>
      </div>
      <div className="max-w-2xl mx-auto mt-6 text-center text-xs text-slate-500 no-print">
        Print on standard Letter or A4 paper with default printer margins. Students can use regular #2 pencil or blue/black pen.
      </div>
    </div>
  );
}
