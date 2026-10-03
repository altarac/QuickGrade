import React, { useState, useEffect, useRef } from 'react';
import Navbar from './components/Navbar';
import AnswerKeyEditor from './components/AnswerKeyEditor';
import CameraScanner from './components/CameraScanner';
import PrintableSheets from './components/PrintableSheets';
import GradebookAnalytics from './components/GradebookAnalytics';
import NewQuizModal from './components/NewQuizModal';
import { Sparkles, PlusCircle, Minus, Plus, Zap, CheckCircle2 } from 'lucide-react';

import { loadStoredQuizzes, saveStoredQuizzes, validateQuizzes } from './types/quizModel';

export default function App() {
  const [quizzes, setQuizzes] = useState(() => loadStoredQuizzes());
  const [activeQuizId, setActiveQuizId] = useState(() => {
    const list = loadStoredQuizzes();
    return list[0]?.id || null;
  });

  const backupInput=useRef(null);
  const [storageWarning,setStorageWarning]=useState('');
  const [backupMessage,setBackupMessage]=useState('');
  const [activeTab, setActiveTab] = useState('key'); // 'key' | 'scan' | 'print' | 'gradebook'
  const [isNewQuizOpen, setIsNewQuizOpen] = useState(false);

  // Initial onboarding form state for when there are no quizzes
  const [onboardTitle, setOnboardTitle] = useState('');
  const [onboardCourse, setOnboardCourse] = useState('');
  const [onboardNumQuestions, setOnboardNumQuestions] = useState(10);
  const [onboardOptionCount, setOnboardOptionCount] = useState(4);

  // Sync to localStorage
  useEffect(() => {
    const ok=saveStoredQuizzes(quizzes);
    setStorageWarning(ok?'':'Browser storage is unavailable or full. Download a backup before closing this page.');
  }, [quizzes]);

  // Ensure activeQuizId is valid
  useEffect(() => {
    if (quizzes.length > 0 && (!activeQuizId || !quizzes.some(q => q.id === activeQuizId))) {
      setActiveQuizId(quizzes[0].id);
    }
  }, [quizzes, activeQuizId]);

  const activeQuiz = quizzes.find(q => q.id === activeQuizId) || quizzes[0] || null;

  const handleUpdateQuiz = (updatedQuiz) => {
    setQuizzes(prev => prev.map(q => q.id === updatedQuiz.id ? updatedQuiz : q));
  };

  const handleCreateQuiz = (newQuizData) => {
    const newQuiz = {
      ...newQuizData,
      id: `quiz-${Date.now()}`,
      createdAt: new Date().toISOString(),
      submissions: []
    };
    setQuizzes(prev => [newQuiz, ...prev]);
    setActiveQuizId(newQuiz.id);
    setActiveTab('key');
  };

  const handleOnboardSubmit = (e) => {
    e.preventDefault();
    if (!onboardTitle.trim()) return;

    const parsedCount = Math.max(1, Math.min(100, parseInt(onboardNumQuestions, 10) || 10));
    const options = onboardOptionCount === 5 ? ['A', 'B', 'C', 'D', 'E'] : ['A', 'B', 'C', 'D'];

    handleCreateQuiz({
      title: onboardTitle.trim(),
      course: onboardCourse.trim() || 'General Class',
      numQuestions: parsedCount,
      options,
      pointsPerQuestion: 1,
      answerKey: {}
    });
  };

  const handleSaveSubmission = (submission) => {
    setQuizzes(prev => prev.map(q => {
      if (q.id === submission.quizId) {
        return {
          ...q,
          submissions: [submission, ...(q.submissions || [])]
        };
      }
      return q;
    }));
  };

  const downloadBackup=()=> {
    const url=URL.createObjectURL(new Blob([JSON.stringify(quizzes.map(q=>({...q,submissions:q.submissions.map(({imageUrl,...s})=>s)})),null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='QuickGrade-backup.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const restoreBackup=async e=> {
    const file=e.target.files?.[0];e.target.value='';if(!file)return;
    try {
      if(file.size>20*1024*1024)throw new Error('Backup is too large. Select a file smaller than 20 MB.');
      const imported=validateQuizzes(JSON.parse(await file.text()));
      // Restore as new quizzes so existing work is never overwritten.
      const copies=imported.map(q=> {const id=`quiz-${Date.now()}-${Math.random().toString(36).slice(2)}`;return {...q,id,submissions:q.submissions.map(s=>({...s,quizId:id}))};});
      setQuizzes(prev=>[...copies,...prev]);if(copies.length)setActiveQuizId(copies[0].id);
      setBackupMessage(`Restored ${copies.length} quizzes. Existing quizzes were kept.`);
    }catch(err){setBackupMessage('Could not restore backup: '+err.message);}
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Navigation */}
      <Navbar
        quizzes={quizzes}
        activeQuizId={activeQuizId}
        onSelectQuiz={setActiveQuizId}
        onOpenNewQuizModal={() => setIsNewQuizOpen(true)}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
      />

      <div className="no-print max-w-7xl w-full mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
        <span>Single-file app · Works offline · Grades saved in this browser</span>
        <div className="flex gap-3"><button className="text-indigo-700 font-semibold" onClick={downloadBackup}>Download backup</button><button className="text-indigo-700 font-semibold" onClick={()=>backupInput.current.click()}>Restore backup</button><input ref={backupInput} type="file" accept=".json,application/json" onChange={restoreBackup} className="hidden" aria-label="Restore quiz backup" /></div>
        {(storageWarning||backupMessage)&&<p className="w-full text-rose-700" role="status">{storageWarning||backupMessage}</p>}
      </div>
      {/* Main Content Area */}
      <main className="flex-1">
        {quizzes.length === 0 ? (
          /* Empty State: Create First Quiz Onboarding */
          <div className="max-w-xl mx-auto px-4 py-12 sm:py-16">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-xl">
              <div className="text-center mb-8">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-xs">
                  <Zap className="w-7 h-7 fill-current" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  Welcome to QuickGrade
                </h1>
                <p className="text-sm text-slate-500 mt-2">
                  Create your multiple-choice quiz with the exact number of questions you need.
                </p>
              </div>

              <form onSubmit={handleOnboardSubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Quiz Title *
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={onboardTitle}
                    onChange={(e) => setOnboardTitle(e.target.value)}
                    placeholder="e.g. Chapter 5: Forces & Motion Quiz"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Course / Class Name
                  </label>
                  <input
                    type="text"
                    value={onboardCourse}
                    onChange={(e) => setOnboardCourse(e.target.value)}
                    placeholder="e.g. Grade 11 Physics"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                  />
                </div>

                {/* Exact Question Count */}
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
                      onClick={() => setOnboardNumQuestions(prev => Math.max(1, (parseInt(prev, 10) || 10) - 1))}
                      className="w-12 h-12 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center justify-center font-bold transition active:scale-95 text-lg"
                    >
                      <Minus className="w-5 h-5" />
                    </button>

                    <input
                      type="number"
                      min="1"
                      max="100"
                      required
                      value={onboardNumQuestions}
                      onChange={(e) => setOnboardNumQuestions(e.target.value)}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-center text-lg font-black text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />

                    <button
                      type="button"
                      onClick={() => setOnboardNumQuestions(prev => Math.min(100, (parseInt(prev, 10) || 10) + 1))}
                      className="w-12 h-12 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center justify-center font-bold transition active:scale-95 text-lg"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Quick-pick chips */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                    <span className="text-xs text-slate-400">Quick select:</span>
                    {[5, 10, 15, 20, 25, 30, 40, 50].map(cnt => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => setOnboardNumQuestions(cnt)}
                        className={`text-xs px-2.5 py-1 rounded-lg font-bold transition ${
                          parseInt(onboardNumQuestions, 10) === cnt
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                        }`}
                      >
                        {cnt} Qs
                      </button>
                    ))}
                  </div>
                </div>

                {/* Choice Count */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Bubble Choices per Question
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setOnboardOptionCount(4)}
                      className={`py-3 px-4 rounded-2xl border text-xs font-bold transition ${
                        onboardOptionCount === 4
                          ? 'bg-indigo-50 border-indigo-500 text-indigo-700 ring-2 ring-indigo-500/20'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      4 Choices (A, B, C, D)
                    </button>

                    <button
                      type="button"
                      onClick={() => setOnboardOptionCount(5)}
                      className={`py-3 px-4 rounded-2xl border text-xs font-bold transition ${
                        onboardOptionCount === 5
                          ? 'bg-indigo-50 border-indigo-500 text-indigo-700 ring-2 ring-indigo-500/20'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      5 Choices (A, B, C, D, E)
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-base font-bold shadow-lg shadow-indigo-600/25 transition transform active:scale-98 flex items-center justify-center gap-2"
                  >
                    <span>Create Quiz & Set Answer Key</span>
                    <Sparkles className="w-5 h-5" />
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : activeQuiz ? (
          <>
            {activeTab === 'key' && (
              <AnswerKeyEditor
                key={activeQuiz.id}
                quiz={activeQuiz}
                onUpdateQuiz={handleUpdateQuiz}
                onNavigateToScan={() => setActiveTab('scan')}
                onNavigateToPrint={() => setActiveTab('print')}
              />
            )}

            {activeTab === 'scan' && (
              <CameraScanner
                key={activeQuiz.id}
                quiz={activeQuiz}
                onSaveSubmission={handleSaveSubmission}
                onNavigateToKey={() => setActiveTab('key')}
                onNavigateToPrint={() => setActiveTab('print')}
              />
            )}

            {activeTab === 'print' && (
              <PrintableSheets
                key={activeQuiz.id}
                quiz={activeQuiz}
                onNavigateToScan={() => setActiveTab('scan')}
              />
            )}

            {activeTab === 'gradebook' && (
              <GradebookAnalytics
                key={activeQuiz.id}
                quiz={activeQuiz}
                onUpdateQuiz={handleUpdateQuiz}
                onNavigateToScan={() => setActiveTab('scan')}
              />
            )}
          </>
        ) : (
          <div className="flex items-center justify-center p-12 text-center text-slate-400">
            No quiz selected. Click "New Quiz" to get started.
          </div>
        )}
      </main>

      {/* New Quiz Modal */}
      <NewQuizModal
        isOpen={isNewQuizOpen}
        onClose={() => setIsNewQuizOpen(false)}
        onCreateQuiz={handleCreateQuiz}
      />
    </div>
  );
}
