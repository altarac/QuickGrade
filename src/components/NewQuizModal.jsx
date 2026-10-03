import React, { useState } from 'react';
import { X, PlusCircle, Minus, Plus } from 'lucide-react';

export default function NewQuizModal({ isOpen, onClose, onCreateQuiz }) {
  const [title, setTitle] = useState('');
  const [course, setCourse] = useState('');
  const [numQuestions, setNumQuestions] = useState(10);
  const [optionCount, setOptionCount] = useState(4); // 4 (A-D) or 5 (A-E)

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    const parsedCount = Math.max(1, Math.min(100, parseInt(numQuestions, 10) || 10));
    const options = optionCount === 5 ? ['A', 'B', 'C', 'D', 'E'] : ['A', 'B', 'C', 'D'];

    onCreateQuiz({
      title: title.trim(),
      course: course.trim() || 'General Course',
      numQuestions: parsedCount,
      options,
      pointsPerQuestion: 1,
      answerKey: {}
    });

    onClose();
  };

  const handleAdjustCount = (delta) => {
    setNumQuestions(prev => Math.max(1, Math.min(100, (parseInt(prev, 10) || 10) + delta)));
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 text-slate-800">

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Create New Quiz</h3>
              <p className="text-xs text-slate-500">Configure quiz details and exact questions</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Quiz Title *
            </label>
            <input
              type="text"
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Chapter 4: Photosynthesis Quiz"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Class / Course Name
            </label>
            <input
              type="text"
              value={course}
              onChange={(e) => setCourse(e.target.value)}
              placeholder="e.g. Biology Period 3"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
            />
          </div>

          {/* Exact Number of Questions Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                Exact Number of Questions *
              </label>
              <span className="text-xs text-slate-400 font-medium">1 to 100 questions</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleAdjustCount(-1)}
                className="w-10 h-10 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center justify-center font-bold transition active:scale-95"
              >
                <Minus className="w-4 h-4" />
              </button>

              <input
                type="number"
                min="1"
                max="100"
                required
                value={numQuestions}
                onChange={(e) => setNumQuestions(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-center text-base font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />

              <button
                type="button"
                onClick={() => handleAdjustCount(1)}
                className="w-10 h-10 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center justify-center font-bold transition active:scale-95"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 mt-2">
              <span className="text-[11px] text-slate-400">Quick set:</span>
              {[5, 10, 15, 20, 25, 30, 50].map(cnt => (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => setNumQuestions(cnt)}
                  className={`text-[11px] px-2 py-0.5 rounded-md font-semibold transition ${
                    parseInt(numQuestions, 10) === cnt
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  {cnt}
                </button>
              ))}
            </div>
          </div>

          {/* Bubble Choices */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Bubble Choices per Question
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setOptionCount(4)}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition ${
                  optionCount === 4
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-700 ring-1 ring-indigo-500'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                4 Choices (A, B, C, D)
              </button>

              <button
                type="button"
                onClick={() => setOptionCount(5)}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition ${
                  optionCount === 5
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-700 ring-1 ring-indigo-500'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                5 Choices (A, B, C, D, E)
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-md shadow-indigo-600/20 transition active:scale-98"
            >
              Create Quiz
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
