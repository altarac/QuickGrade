import { MAX_QUESTIONS } from '../utils/sheetLayout';
import React, { useState, useEffect, useRef } from 'react';
import {
  CheckCircle2,
  Sparkles,
  Shuffle,
  Trash2,
  Camera,
  Keyboard,
  Printer,
  Hash,
  Minus,
  Plus
} from 'lucide-react';
import { playTickSound } from '../utils/audioFeedback';

export default function AnswerKeyEditor({
  quiz,
  onUpdateQuiz,
  onNavigateToScan,
  onNavigateToPrint
}) {
  const [activeQuestion, setActiveQuestion] = useState(1);
  const containerRef = useRef(null);

  const answerKey = quiz.answerKey || {};
  const totalConfigured = Object.keys(answerKey).length;
  const isComplete = totalConfigured === quiz.numQuestions;
  const progressPercent = Math.round((totalConfigured / quiz.numQuestions) * 100);

  // Set answer for a question
  const handleSelectAnswer = (qNum, option) => {
    if (quiz.submissions?.length) { alert('Create a new quiz to change the key after saving grades.'); return; }
    playTickSound();
    const updatedKey = { ...answerKey, [qNum]: option };
    onUpdateQuiz({
      ...quiz,
      answerKey: updatedKey
    });

    // Automatically advance to next question
    if (qNum < quiz.numQuestions) {
      setActiveQuestion(qNum + 1);
    }
  };

  // Keyboard shortcut listener for rapid entry: pressing A, B, C, D sets answer and advances
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't intercept if user is typing in an input or textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;

      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toUpperCase();
      if (quiz.options.includes(key)) {
        e.preventDefault();
        handleSelectAnswer(activeQuestion, key);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveQuestion(prev => Math.min(quiz.numQuestions, prev + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveQuestion(prev => Math.max(1, prev - 1));
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        if (quiz.submissions?.length) return;
        e.preventDefault();
        const updatedKey = { ...answerKey };
        delete updatedKey[activeQuestion];
        onUpdateQuiz({ ...quiz, answerKey: updatedKey });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeQuestion, answerKey, quiz]);

  // Bulk actions
  const handleRandomize = () => {
    if (quiz.submissions?.length) { alert('Create a new quiz to change the key after saving grades.'); return; }
    const newKey = {};
    for (let q = 1; q <= quiz.numQuestions; q++) {
      const randomOpt = quiz.options[Math.floor(Math.random() * quiz.options.length)];
      newKey[q] = randomOpt;
    }
    onUpdateQuiz({ ...quiz, answerKey: newKey });
  };

  const handlePatternFill = () => {
    if (quiz.submissions?.length) { alert('Create a new quiz to change the key after saving grades.'); return; }
    const newKey = {};
    for (let q = 1; q <= quiz.numQuestions; q++) {
      newKey[q] = quiz.options[(q - 1) % quiz.options.length];
    }
    onUpdateQuiz({ ...quiz, answerKey: newKey });
  };

  const handleClearAll = () => {
    if (quiz.submissions?.length) { alert('Create a new quiz to change the key after saving grades.'); return; }
    if (window.confirm('Clear all answers from this key?')) {
      onUpdateQuiz({ ...quiz, answerKey: {} });
    }
  };

  // Allow user to enter exact number of questions
  const handleQuestionCountChange = (count) => {
    if (quiz.submissions?.length) { alert('Create a new quiz to change the sheet layout after saving grades.'); return; }
    const num = Math.max(1, Math.min(MAX_QUESTIONS, parseInt(count, 10) || 1));
    const trimmedKey = {};
    for (let q = 1; q <= num; q++) {
      if (answerKey[q]) trimmedKey[q] = answerKey[q];
    }
    onUpdateQuiz({
      ...quiz,
      numQuestions: num,
      answerKey: trimmedKey
    });
    if (activeQuestion > num) setActiveQuestion(num);
  };

  const handleAdjustCount = (delta) => {
    handleQuestionCountChange((quiz.numQuestions || 10) + delta);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Top Banner / Title Header */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 mb-8 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                {quiz.course || 'Assessment'}
              </span>
              <span className="text-xs text-slate-400 font-medium">
                {quiz.numQuestions} Questions • {quiz.options.length} Choices ({quiz.options.join('-')})
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{quiz.title}</h1>
            <p className="text-sm text-slate-500 mt-1">
              Tap or use your keyboard keys (<kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-xs font-mono text-indigo-700 border border-slate-200">A</kbd>, <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-xs font-mono text-indigo-700 border border-slate-200">B</kbd>, <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-xs font-mono text-indigo-700 border border-slate-200">C</kbd>, <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-xs font-mono text-indigo-700 border border-slate-200">D</kbd>) to rapidly set the answer key.
            </p>
          </div>

          {/* Quick Actions & Launch Scanner */}
          <div className="flex items-center gap-3">
            <button
              onClick={onNavigateToPrint}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-sm font-semibold border border-slate-200 transition shadow-xs"
            >
              <Printer className="w-4 h-4 text-slate-500" />
              <span>Print Sheets</span>
            </button>

            <button
              onClick={onNavigateToScan}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition shadow-sm ${
                isComplete
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-500/20'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20'
              }`}
            >
              <Camera className="w-4 h-4" />
              <span>{isComplete ? 'Key Ready! Start Scanning' : 'Scan Papers'}</span>
            </button>
          </div>
        </div>

        {/* Progress Bar & Configuration Bar */}
        <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex-1 max-w-md">
            <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
              <span className="text-slate-600">Answer Key Completion</span>
              <span className={isComplete ? 'text-emerald-600 font-bold' : 'text-indigo-600 font-bold'}>
                {totalConfigured} of {quiz.numQuestions} answered ({progressPercent}%)
              </span>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  isComplete ? 'bg-emerald-500' : 'bg-indigo-600'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Exact Question Count Selector & Preset Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200 text-xs font-medium text-slate-700">
              <Hash className="w-3.5 h-3.5 text-slate-400" />
              <span>Questions:</span>
              <button
                type="button"
                onClick={() => handleAdjustCount(-1)}
                aria-label="Decrease question count" disabled={quiz.numQuestions<=1}
                className="w-5 h-5 rounded hover:bg-slate-200 flex items-center justify-center font-bold text-slate-600"
              >
                <Minus className="w-3 h-3" />
              </button>
              <input
                type="number"
                min="1"
                max={MAX_QUESTIONS}
                aria-label="Number of questions"
                value={quiz.numQuestions}
                onChange={(e) => handleQuestionCountChange(e.target.value)}
                className="w-12 bg-white text-slate-900 font-bold text-center rounded px-1 py-0.5 border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => handleAdjustCount(1)}
                aria-label="Increase question count" disabled={quiz.numQuestions>=MAX_QUESTIONS}
                className="w-5 h-5 rounded hover:bg-slate-200 flex items-center justify-center font-bold text-slate-600"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>

            <button
              onClick={handlePatternFill}
              title="Fill with ABCD repeating pattern"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 transition"
            >
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>ABCD Pattern</span>
            </button>

            <button
              onClick={handleRandomize}
              title="Randomize answer key for test demo"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 transition"
            >
              <Shuffle className="w-3 h-3 text-indigo-600" />
              <span>Randomize</span>
            </button>

            <button
              onClick={handleClearAll}
              title="Clear all answers"
              className="p-1.5 rounded-xl hover:bg-rose-50 text-rose-700 hover:text-rose-600 border border-slate-200 transition"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Keyboard Shortcut Helper Tooltip */}
      <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl px-4 py-3 mb-6 flex items-center justify-between text-xs text-indigo-900">
        <div className="flex items-center gap-2">
          <Keyboard className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>
            <strong>Pro Tip:</strong> Click any question row or simply press keys <strong>A</strong>, <strong>B</strong>, <strong>C</strong>, or <strong>D</strong> on your keyboard to rapidly punch in answers!
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-1 font-mono text-[11px] text-indigo-600">
          <span className="px-1.5 py-0.5 bg-white rounded border border-indigo-200 shadow-xs">↑</span>
          <span className="px-1.5 py-0.5 bg-white rounded border border-indigo-200 shadow-xs">↓</span>
          <span>to navigate</span>
        </div>
      </div>

      {/* Answer Key Grid */}
      <div
        ref={containerRef}
        className={`grid gap-3 ${
          quiz.numQuestions > 20
            ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
            : 'grid-cols-1 sm:grid-cols-2'
        }`}
      >
        {Array.from({ length: quiz.numQuestions }, (_, i) => i + 1).map(qNum => {
          const selectedAnswer = answerKey[qNum];
          const isActive = activeQuestion === qNum;

          return (
            <div
              key={qNum}
              onClick={() => setActiveQuestion(qNum)}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                isActive
                  ? 'bg-indigo-50/60 border-indigo-500 shadow-sm ring-2 ring-indigo-500/20'
                  : selectedAnswer
                  ? 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                  : 'bg-white/80 border-slate-200/80 hover:border-slate-300'
              }`}
            >
              {/* Question Number */}
              <div className="flex items-center gap-3">
                <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : selectedAnswer
                    ? 'bg-slate-100 text-slate-800 border border-slate-200'
                    : 'bg-slate-100 text-slate-400'
                }`}>
                  {qNum}
                </span>

                <div className="text-xs">
                  <span className="font-bold text-slate-800">Question {qNum}</span>
                  <div className="text-[11px] text-slate-500 font-medium">
                    {selectedAnswer ? `Correct: ${selectedAnswer}` : 'Not set'}
                  </div>
                </div>
              </div>

              {/* Option Buttons: A, B, C, D */}
              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                {quiz.options.map(opt => {
                  const isSelected = selectedAnswer === opt;
                  return (
                    <button
                      key={opt}
                      aria-label={`Question ${qNum}: ${opt}`}
                      aria-pressed={isSelected}
                      onClick={() => handleSelectAnswer(qNum, opt)}
                      className={`w-9 h-9 rounded-xl font-bold text-sm transition-all transform active:scale-95 ${
                        isSelected
                          ? 'bg-emerald-500 text-white shadow-sm ring-2 ring-emerald-400/40 scale-105'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Sticky Action Floating Bar */}
      <div className="mt-10 flex justify-center">
        <button
          onClick={onNavigateToScan}
          className="flex items-center gap-3 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-700 hover:to-emerald-700 text-white font-bold text-sm shadow-lg shadow-indigo-600/20 transition transform hover:-translate-y-0.5 active:translate-y-0"
        >
          <Camera className="w-5 h-5" />
          <span>Open Phone Camera to Scan Papers</span>
        </button>
      </div>
    </div>
  );
}
