import React, { useRef, useEffect, useState } from 'react';
import {
  Printer,
  Download,
  Sparkles,
  RotateCcw,
  Camera,
  HelpCircle,
  FileCheck,
  Check
} from 'lucide-react';
import { drawBubbleSheetToCanvas } from '../utils/sheetGenerator';
import { getSheetLayout } from '../utils/sheetLayout';
import { mapPoint } from '../utils/omrEngine';

export default function PrintableSheets({
  quiz,
  onNavigateToScan
}) {
  const canvasRef = useRef(null);
  const [studentName, setStudentName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [virtualAnswers, setVirtualAnswers] = useState({});
  const [copiesCount, setCopiesCount] = useState(1);

  // Redraw canvas whenever quiz or virtual answers change
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = 1200;
    canvas.height = 1600;

    drawBubbleSheetToCanvas(canvas, quiz, {
      studentName: virtualAnswers.isSimulated ? studentName : '',
      studentId: virtualAnswers.isSimulated ? studentId : '',
      filledAnswers: virtualAnswers
    });
  }, [quiz, virtualAnswers, studentName, studentId]);

  // Click on canvas to toggle bubbles in virtual test sheet
  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) / rect.width;
    const clickY = (e.clientY - rect.top) / rect.height;

    const layout = getSheetLayout(quiz.numQuestions, quiz.options);
    const corners = {
      tl: { x: 0.06, y: 0.05 },
      tr: { x: 0.94, y: 0.05 },
      bl: { x: 0.06, y: 0.95 },
      br: { x: 0.94, y: 0.95 }
    };

    // Find clicked bubble
    for (let q = 1; q <= quiz.numQuestions; q++) {
      const qInfo = layout.questions[q];
      if (!qInfo) continue;

      for (const opt of quiz.options) {
        const coord = qInfo.options[opt];
        const bubblePos = mapPoint(coord.u, coord.v, corners);
        const dist = Math.hypot(clickX - bubblePos.x, clickY - bubblePos.y);

        if (dist <= coord.radius * (0.94 - 0.06) * 1.8) {
          // Toggle answer for this question
          setVirtualAnswers(prev => ({
            ...prev,
            isSimulated: true,
            [q]: prev[q] === opt ? undefined : opt
          }));
          return;
        }
      }
    }
  };

  const handlePrint = () => {
    const blank=document.createElement('canvas');blank.width=1200;blank.height=1600;
    drawBubbleSheetToCanvas(blank,quiz,{date:''});
    const image=document.getElementById('print-sheet');
    image.onload=()=>{window.print();image.onload=null;};
    image.src=blank.toDataURL('image/png');
  };

  const handleDownloadImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `QuickGrade_${quiz.title.replace(/\s+/g, '_')}_BubbleSheet.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const handleFillSample = (scorePercent = 80) => {
    const answers = { isSimulated: true };
    const numCorrect = Math.round((quiz.numQuestions * scorePercent) / 100);

    for (let q = 1; q <= quiz.numQuestions; q++) {
      const correctOpt = quiz.answerKey[q] || 'A';
      if (q <= numCorrect) {
        answers[q] = correctOpt;
      } else {
        const wrongOpts = quiz.options.filter(o => o !== correctOpt);
        answers[q] = wrongOpts[Math.floor(Math.random() * wrongOpts.length)];
      }
    }
    setVirtualAnswers(answers);
  };

  const handleClearVirtualMarks = () => {
    setVirtualAnswers({});
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div id="print-area"><img id="print-sheet" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" alt="Blank printable bubble sheet" /></div>
      {/* Control Header (Hidden when printing) */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 mb-8 no-print shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              Printable Standard OMR Sheet
            </span>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1.5">
              Print Bubble Sheets for Students
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Optimized for high-speed camera scanning. The 4 solid black corner squares help the scanner align a clear, upright photo.
            </p>
          </div>

          {/* Print & Download Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleDownloadImage}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-sm font-semibold border border-slate-200 transition shadow-xs"
            >
              <Download className="w-4 h-4 text-slate-400" />
              <span>Download PNG</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-md shadow-indigo-600/20 transition transform active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Print Sheet Now</span>
            </button>
          </div>
        </div>

        {/* Virtual Test Sheet Controls */}
        <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-bold text-slate-700">Virtual Interactive Sheet Tester:</span>
            <span className="text-xs text-slate-400">
              Click bubbles below to simulate student marks!
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleFillSample(100)}
              className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold border border-emerald-200 transition"
            >
              Fill 100% Score
            </button>
            <button
              onClick={() => handleFillSample(80)}
              className="px-2.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold border border-indigo-200 transition"
            >
              Fill 80% Score
            </button>
            <button
              onClick={handleClearVirtualMarks}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Clear Marks</span>
            </button>

            <button
              onClick={onNavigateToScan}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-sm shadow-emerald-600/20 transition ml-2"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Test Phone Scanner</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sheet Preview Container (Rendered to Screen & Printed) */}
      <div className="flex justify-center">
        <div className="sheet-container bg-white p-4 sm:p-8 rounded-3xl shadow-xl border border-slate-200 max-w-2xl w-full">
          <div className="relative cursor-pointer group">
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              className="w-full h-auto rounded-lg shadow-xs"
            />

            <div className="absolute top-3 right-3 no-print opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/80 text-white text-xs px-3 py-1.5 rounded-lg pointer-events-none">
              Click any bubble to toggle mark
            </div>
          </div>
        </div>
      </div>

      {/* Printing Instructions Banner */}
      <div className="max-w-2xl mx-auto mt-6 text-center text-xs text-slate-500 no-print">
        Tip: Print on standard Letter or A4 paper with default printer margins. Students can use regular #2 pencil or blue/black pen.
      </div>
    </div>
  );
}
