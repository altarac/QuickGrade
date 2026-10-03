import React, { useState } from 'react';
import {
  Zap,
  KeyRound,
  Camera,
  Printer,
  BarChart3,
  ChevronDown,
  CheckCircle2,
  Plus
} from 'lucide-react';

export default function Navbar({
  quizzes,
  activeQuizId,
  onSelectQuiz,
  onOpenNewQuizModal,
  activeTab,
  onSelectTab
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const activeQuiz = quizzes.find(q => q.id === activeQuizId) || quizzes[0];

  const totalAnswered = activeQuiz ? Object.keys(activeQuiz.answerKey || {}).length : 0;

  const tabs = [
    { id: 'key', label: 'Answer Key', icon: KeyRound, badge: activeQuiz ? `${totalAnswered}/${activeQuiz.numQuestions}` : undefined },
    { id: 'scan', label: 'Scan', icon: Camera, highlight: true },
    { id: 'print', label: 'Bubble Sheets', icon: Printer },
    { id: 'gradebook', label: 'Gradebook', icon: BarChart3, badge: activeQuiz?.submissions?.length || 0 }
  ];

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 no-print shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between min-h-16 gap-3 py-2">

          {/* Logo & Quiz Selector */}
          <div className="flex min-w-0 max-w-full items-center gap-2 sm:gap-4">
            <div className="flex shrink-0 items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-700 flex items-center justify-center shadow-sm text-white font-black text-xl">
                <Zap className="w-5 h-5 fill-current" />
              </div>
              <div className="hidden sm:block">
                <span className="text-lg font-black tracking-tight text-slate-900 flex items-center gap-1.5">
                  QuickGrade
                </span>
                <p className="text-xs text-slate-500 font-medium -mt-0.5">Instant Bubble Sheet Auto-Grader</p>
              </div>
            </div>

            {/* Quiz Switcher Dropdown */}
            {quizzes.length > 0 && (
              <div className="relative min-w-0">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  aria-label="Choose quiz" aria-expanded={dropdownOpen}
                  className="flex min-w-0 max-w-full items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 text-sm font-semibold transition"
                >
                  <span className="min-w-0 max-w-[130px] sm:max-w-[160px] truncate">{activeQuiz?.title || 'Select Quiz'}</span>
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                </button>

                {dropdownOpen && (
                  <div className="absolute left-0 mt-2 w-72 max-w-[calc(100vw-6rem)] bg-white border border-slate-200 rounded-2xl shadow-xl py-2 z-50">
                    <div className="px-3 py-2 text-xs font-semibold text-slate-600 border-b border-slate-100">Your Quizzes ({quizzes.length})</div>
                    <div className="max-h-60 overflow-y-auto py-1">
                      {quizzes.map(quiz => {
                        const isSelected = quiz.id === activeQuizId;
                        const subCount = quiz.submissions?.length || 0;
                        return (
                          <button
                            key={quiz.id}
                            onClick={() => {
                              onSelectQuiz(quiz.id);
                              setDropdownOpen(false);
                            }}
                            className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between hover:bg-slate-50 transition ${
                              isSelected ? 'bg-indigo-50/70 text-indigo-700 font-bold border-l-2 border-indigo-600' : 'text-slate-700'
                            }`}
                          >
                            <div className="truncate pr-2">
                              <div className="truncate">{quiz.title}</div>
                              <div className="text-xs text-slate-500 font-normal">
                                {quiz.numQuestions} Qs • {subCount} graded
                              </div>
                            </div>
                            {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
            <button onClick={()=>{setDropdownOpen(false);onOpenNewQuizModal();}}
              className="flex shrink-0 items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition min-h-11">
              <Plus className="w-4 h-4" /><span>New Quiz</span>
            </button>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex w-full xl:w-auto items-center justify-between gap-1 sm:gap-2">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  aria-label={tab.label}
                  title={tab.label}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => onSelectTab(tab.id)}
                  className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : tab.highlight
                      ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden md:inline">{tab.label}</span>
                  {tab.badge !== undefined && (
                    <span className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${
                      isActive ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
