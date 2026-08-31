"use client";

import { useState, useEffect } from "react";
import SourceUploader from "../components/SourceUploader";
import ChatWindow from "../components/ChatWindow";
import { BookOpen, Menu, Plus, MessageSquare, Moon, Sun, Download, ExternalLink } from "lucide-react";
import ReactMarkdown from "react-markdown";

export default function Home() {
  const [sources, setSources] = useState<any[]>([]);
  const [quiz, setQuiz] = useState<any[] | null>(null);
  const [loadingQuiz, setLoadingQuiz] = useState(false);

  // --- NEW STATES FOR QUIZ LOGIC ---
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [showResults, setShowResults] = useState(false);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // --- NEW: Session Management States ---
  const [sessions, setSessions] = useState<{id: string, title: string, messages: any[], sources: any[]}[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);

  const [isOffline, setIsOffline] = useState(false);
  const [showRestored, setShowRestored] = useState(false);

  // --- NEW: Network Listener ---
  useEffect(() => {
    const handleOffline = () => {
      setIsOffline(true);
      setShowRestored(false);
    };

    const handleOnline = () => {
      setIsOffline(false);
      setShowRestored(true);
      // Hide the "Restored" toast after 3 seconds
      setTimeout(() => setShowRestored(false), 3000);
    };

    // Check initial state
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      handleOffline();
    }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  // Load sessions from memory on startup
  useEffect(() => {
    const saved = localStorage.getItem("chat_sessions");
    if (saved) {
      const parsed = JSON.parse(saved);
      const upgradedSessions = parsed.map((s: any) => ({
        ...s,
        sources: s.sources || [] 
      }));
      
      setSessions(upgradedSessions);
      if (upgradedSessions.length > 0) {
        setActiveSessionId(upgradedSessions[0].id);
        // --- FIX 1: Restore the sources to the screen on startup ---
        setSources(upgradedSessions[0].sources); 
      }
    } else {
      createNewSession();
    }
  }, []);

  // Save sessions whenever they change
  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem("chat_sessions", JSON.stringify(sessions));
    }
  }, [sessions]);

  const createNewSession = () => {
    const newSession = {
      id: Date.now().toString(),
      title: `New Chat ${sessions.length + 1}`,
      messages: [],
      sources: []
    };
    setSessions([newSession, ...sessions]);
    setActiveSessionId(newSession.id);
    
    // --- NEW: Completely wipe the screen for a fresh start ---
    setSources([]);
    setQuiz(null);
    setAnswers({});
    setShowResults(false);
  };

  const handleSwitchSession = (id: string) => {
    setActiveSessionId(id);
    const session = sessions.find(s => s.id === id);
    setSources(session?.sources || []); // Restore the sources!
    setQuiz(null);
    setShowResults(false);
  };

  const handleSourceAdded = (newSource: any) => {
    const updatedSources = [...sources, newSource];
    setSources(updatedSources);
    
    // --- FIX 3: Instantly and permanently save to the active session ---
    setSessions(prevSessions => prevSessions.map(s => 
      s.id === activeSessionId ? { ...s, sources: updatedSources } : s
    ));
  };

  const handleGenerateQuiz = async () => {
    setLoadingQuiz(true);
    setShowResults(false);
    setAnswers({}); // Reset answers for new quiz
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/quiz`);
      const data = await res.json();
      setQuiz(data.data);
    } catch (error) {
      console.error("Failed to load quiz", error);
    }
    setLoadingQuiz(false);
  };

  const handleOptionSelect = (qIndex: number, option: string) => {
    if (!showResults) {
      setAnswers((prev) => ({ ...prev, [qIndex]: option }));
    }
  };

  // Calculate score for display
  const score = quiz ? quiz.filter((q, i) => answers[i] === q.answer).length : 0;

  const handleDeleteSource = async (id: string, index: number) => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/documents/${id}`, { method: "DELETE" });
      
      const updatedSources = sources.filter((_, i) => i !== index);
      setSources(updatedSources);
      
      // --- FIX 4: Instantly update the active session memory ---
      setSessions(prevSessions => prevSessions.map(s => 
        s.id === activeSessionId ? { ...s, sources: updatedSources } : s
      ));
    } catch (error) {
      console.error("Failed to delete source", error);
    }
  };

  return (
    <div className={`flex h-screen overflow-hidden ${darkMode ? 'dark' : ''}`}>
      {/* --- NEW: Network Status Toast --- */}
      {(isOffline || showRestored) && (
        <div 
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-6 py-2.5 rounded-full shadow-lg text-sm font-semibold text-white transition-all duration-300 flex items-center gap-2 ${
            isOffline ? 'bg-red-500 animate-pulse' : 'bg-green-500'
          }`}
        >
          {isOffline ? (
            <>
              <span className="w-2 h-2 bg-white rounded-full animate-ping"></span>
              Network connection is down
            </>
          ) : (
            <>✓ Network restored</>
          )}
        </div>
      )}
      <div className="flex w-full h-full bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-300">

      {/* --- SIDEBAR --- */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-0'} bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 flex flex-col overflow-hidden shrink-0`}>
        {/* NEW CHAT BUTTON */}
        <div className="p-4">
          <button onClick={createNewSession} className="w-full flex items-center gap-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            <Plus size={16} /> New Chat
          </button>
        </div>
        
        {/* SESSION LIST */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions.map(s => (
            <button 
              key={s.id} 
              onClick={() => handleSwitchSession(s.id)} // <-- UPDATED
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors text-left truncate ${
                activeSessionId === s.id 
                  ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' 
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <MessageSquare size={14} className="shrink-0" />
              <span className="truncate">{s.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* --- MAIN CONTENT --- */}
        <main className="flex-1 flex flex-col h-full overflow-y-auto">
          <header className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 p-4 flex items-center justify-between sticky top-0 z-10">
            <div className="flex items-center gap-4">
              <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md text-gray-500 dark:text-gray-400">
                <Menu size={20} />
              </button>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <BookOpen className="text-blue-600 dark:text-blue-400" size={24} />
                Multi-Source Learning Assistant
              </h1>
            </div>
            
            {/* --- NEW: Theme Toggle Button --- */}
            <button 
              onClick={() => setDarkMode(!darkMode)} 
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-300"
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </header>

          <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto w-full flex-1">
            <SourceUploader onSourceAdded={handleSourceAdded} />

        {/* Badges */}
        {sources.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-2">
            {sources.map((src, i) => (
              <div key={i} className="group relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 pl-3 pr-2 py-1.5 rounded-full text-xs font-medium text-gray-700 dark:text-gray-300 shadow-sm flex items-center gap-2 transition-colors">
                <span className={`w-2 h-2 rounded-full ${src.type === 'file' ? 'bg-orange-500' : 'bg-red-500'}`}></span>
                <span className="truncate max-w-[150px]">{src.name}</span>
                
                {/* --- Hover Actions Container --- */}
                <div className="hidden group-hover:flex items-center gap-1 ml-1 bg-white dark:bg-gray-800 pl-1 rounded-r-full">
                  
                  {src.type === 'link' ? (
                    // 1. It is a Web/YouTube Link
                    <a 
                      href={src.name} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-400 hover:text-blue-500 transition-colors" 
                      title="Open Link"
                    >
                      <ExternalLink size={12} />
                    </a>
                  ) : src.download_url ? (
                    // 2. It is a NEW File (Has a Supabase Storage URL)
                    <a 
                      href={src.download_url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-400 hover:text-blue-500 transition-colors" 
                      title="Download Original File"
                    >
                      <Download size={12} />
                    </a>
                  ) : (
                    // 3. It is an OLD File (No download URL exists)
                    <button 
                      onClick={() => alert("This file was uploaded before cloud storage was enabled. Please re-upload the file to enable downloads.")} 
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-400 hover:text-blue-500 transition-colors" 
                      title="File not available"
                    >
                      <Download size={12} />
                    </button>
                  )}

                  <button onClick={() => handleDeleteSource(src.id, i)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-400 hover:text-red-500 transition-colors" title="Delete Source">
                    ✕
                  </button>
                </div>
              </div>
            ))}
            
            {/* --- UPDATED: More Quiz & Reset Buttons --- */}
            <div className="ml-auto flex items-center gap-2">
              {quiz && (
                <button 
                  onClick={() => {
                    setQuiz(null);
                    setAnswers({});
                    setShowResults(false);
                  }} 
                  className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-4 py-1.5 rounded-full text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Reset
                </button>
              )}
              <button 
                onClick={handleGenerateQuiz} 
                disabled={loadingQuiz} 
                className="bg-purple-600 text-white px-4 py-1.5 rounded-full text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                {loadingQuiz ? "Generating..." : (quiz ? "More Quiz" : "Quiz Me!")}
              </button>
            </div>
          </div>
        )}

        {/* --- Source Summaries Display (Collapsible Accordion) --- */}
        {sources.length > 0 && (
          <div className="mb-6 space-y-3">
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">Source Summaries</h3>
            {sources.map((src, i) => (
              <details 
                key={i} 
                open={i === sources.length - 1} // Keep the most recently added summary open by default
                className="group p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700 text-sm shadow-sm transition-colors [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="font-bold text-blue-600 dark:text-blue-400 cursor-pointer flex items-center justify-between outline-none">
                  {src.name}
                  <span className="transition duration-300 group-open:-rotate-180 text-gray-400">
                    <svg fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="20">
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </span>
                </summary>
                
                <div className="mt-4 prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
                  <ReactMarkdown>{src.summary}</ReactMarkdown>
                </div>
              </details>
            ))}
          </div>
        )}

        {/* QUIZ UI WITH SCORING */}
        {quiz && (
          <div className="mb-6 bg-purple-50 dark:bg-purple-900/20 p-6 rounded-lg border border-purple-100 dark:border-purple-800/50 shadow-sm transition-colors">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-purple-900 dark:text-purple-300">Knowledge Check</h3>
              {showResults && (
                <span className="bg-purple-200 dark:bg-purple-800/50 text-purple-900 dark:text-purple-300 px-3 py-1 rounded-full text-sm font-bold">
                  Score: {score} / {quiz.length}
                </span>
              )}
            </div>
            
            <div className="space-y-6">
              {quiz.map((q, i) => {
                const isCorrect = answers[i] === q.answer;
                
                return (
                  <div key={i} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 transition-colors">
                    <p className="font-medium text-gray-800 dark:text-gray-200 mb-3">{i + 1}. {q.question}</p>
                    <div className="space-y-2">
                      {q.options.map((opt: string, j: number) => {
                        let optionClass = "flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors border ";
                        
                        if (!showResults) {
                          optionClass += answers[i] === opt ? "border-purple-500 bg-purple-50 dark:bg-purple-900/40" : "border-transparent hover:bg-gray-50 dark:hover:bg-gray-700";
                        } else {
                          if (opt === q.answer) optionClass += "border-green-500 bg-green-50 dark:bg-green-900/30"; 
                          else if (answers[i] === opt && !isCorrect) optionClass += "border-red-500 bg-red-50 dark:bg-red-900/30"; 
                          else optionClass += "border-transparent opacity-50";
                        }

                        return (
                          <label key={j} className={optionClass}>
                            <input 
                              type="radio" 
                              name={`question-${i}`} 
                              value={opt} 
                              checked={answers[i] === opt}
                              onChange={() => handleOptionSelect(i, opt)}
                              disabled={showResults}
                              className="w-4 h-4 text-purple-600 focus:ring-purple-500"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">{opt}</span>
                          </label>
                        );
                      })}
                    </div>
                    
                    {/* Explanation */}
                    {showResults && (
                      <div className={`mt-4 p-3 rounded-md text-sm ${isCorrect ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300'}`}>
                        <span className="font-bold">{isCorrect ? '✓ Correct: ' : '✗ Incorrect: '}</span> 
                        {q.explanation}
                        <span className="block mt-2 font-medium text-xs opacity-75">{q.citation}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {!showResults && Object.keys(answers).length === quiz.length && (
              <button onClick={() => setShowResults(true)} className="mt-6 w-full bg-purple-600 text-white px-4 py-2 rounded-md font-medium hover:bg-purple-700">
                Submit & Show Results
              </button>
            )}
          </div>
        )}

        {activeSessionId && (
          <ChatWindow 
            sessionId={activeSessionId}
            sources={sources}
                onMessagesChange={(newMessages) => {
                  setSessions(prev => prev.map(s => 
                    s.id === activeSessionId ? { ...s, messages: newMessages } : s
                  ));
                }}
                // --- NEW: Handle the AI Title Rename ---
                onRename={(newTitle) => {
                  setSessions(prev => prev.map(s => 
                    s.id === activeSessionId ? { ...s, title: newTitle } : s
                  ));
                }}
              />
            )}
      </div>
    </main>
    </div>
    </div>
  );
}