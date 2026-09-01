"use client";

import { useState, useEffect } from "react";
import SourceUploader from "../components/SourceUploader";
import ChatWindow from "../components/ChatWindow";
import { BookOpen, Menu, Plus, MessageSquare, Moon, Sun, Download, ExternalLink } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { puter } from '@heyputer/puter.js';

export default function Home() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [sources, setSources] = useState<any[]>([]);
  const [quiz, setQuiz] = useState<any[] | null>(null);
  const [loadingQuiz, setLoadingQuiz] = useState(false);

  // --- NEW STATES FOR QUIZ LOGIC ---
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [showResults, setShowResults] = useState(false);
  const [quizErrorToast, setQuizErrorToast] = useState<string | null>(null);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // --- NEW: Session Management States ---
  const [sessions, setSessions] = useState<{id: string, title: string, messages: any[], sources: any[]}[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);

  const [isOffline, setIsOffline] = useState(false);
  const [showRestored, setShowRestored] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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

  // --- UPDATED: Load sessions AND active session on startup ---
  useEffect(() => {
    const saved = localStorage.getItem("chat_sessions");
    const savedActiveId = localStorage.getItem("active_session_id"); // <-- NEW
    
    if (saved) {
      const parsed = JSON.parse(saved);
      const upgradedSessions = parsed.map((s: any) => ({
        ...s,
        sources: s.sources || [] 
      }));
      
      setSessions(upgradedSessions);
      if (upgradedSessions.length > 0) {
        // --- NEW: Restore the specific active session if it exists, otherwise fallback to the first one ---
        const sessionToRestore = upgradedSessions.find((s: any) => s.id === savedActiveId) 
          ? savedActiveId 
          : upgradedSessions[0].id;
          
        setActiveSessionId(sessionToRestore);
        
        const activeSession = upgradedSessions.find((s: any) => s.id === sessionToRestore);
        setSources(activeSession?.sources || []); 
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

  useEffect(() => {
    if (activeSessionId) {
      localStorage.setItem("active_session_id", activeSessionId);
    }
  }, [activeSessionId]);

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
    
    try {
      const existingQuestions = quiz ? quiz.map(q => q.question) : [];
      
      if (sources.length === 0) {
        throw new Error("Please upload at least one source before generating a quiz.");
      }

      // --- 1. Fetch fresh summaries from the backend for all active source IDs ---
      const sourceIds = sources.map(s => s.id).filter(Boolean);
      let currentSources = [...sources];

      try {
        const syncRes = await fetch(`${API_URL}/api/documents/summaries`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source_ids: sourceIds })
        });

        if (syncRes.ok) {
          const syncData = await syncRes.json();
          const dbDocs = syncData.data || [];
          
          // Merge database summaries into the frontend sources
          currentSources = currentSources.map(src => {
            // --- FIX: Wrap both IDs in String() to prevent strict equality failures ---
            const match = dbDocs.find((d: any) => String(d.id) === String(src.id));
            return match ? { ...src, summary: match.summary || src.summary } : src;
          });

          // Update local state and sessions so the UI stays in sync
          setSources(currentSources);
          setSessions(prev => prev.map(s => 
            s.id === activeSessionId ? { ...s, sources: currentSources } : s
          ));
        }
      } catch (err) {
        console.warn("Could not sync latest summaries from backend, using local state.", err);
      }

      // --- 2. Filter sources that have valid summaries ---
      const validSources = currentSources.filter(
        src => src.summary && src.summary.trim() !== "" && src.summary !== "undefined"
      );

      if (validSources.length === 0) {
        throw new Error("No valid document summaries found in the database. Please re-upload your files.");
      }
      
      // --- 3. Build the combined summary string ---
      const combinedSummaries = validSources
        .map(src => `[Document: ${src.name || src.source_path}]\n${src.summary}`)
        .join("\n\n");
      
      let exclusionText = "";
      if (existingQuestions.length > 0) {
        exclusionText = `\nDO NOT repeat or generate questions similar to these existing ones:\n${existingQuestions.map(q => `- ${q}`).join("\n")}\n`;
      }

      // --- 4. Prompt for Puter.js ---
      const prompt = `You are an educational assessment generator.
Read the following study material carefully:

${combinedSummaries}

TASK:
Generate exactly 3 educational multiple-choice questions testing the actual facts, concepts, and key information described in the material.
${exclusionText}
STRICT RULES:
1. Questions must test educational and conceptual knowledge from the content.
2. NEVER ask meta-questions about filenames, document titles, or formatting.
3. If there is insufficient conceptual information, return: { "quiz": [] }
4. Return ONLY a valid JSON object matching this structure:
{
  "quiz": [
    {
      "question": "Clear question testing a real concept or fact?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answer": "Option A",
      "explanation": "Why this answer is correct according to the material.",
      "citation": "**[Source: filename.pdf]**"
    }
  ]
}`;

      // Call Puter.js
      const response = await puter.ai.chat(prompt, { model: "google/gemini-3.7-flash" });
      
      const content = response?.message?.content;
      let rawText = "";
      if (typeof content === "string") {
        rawText = content;
      } else if (Array.isArray(content)) {
        rawText = content.map((c: any) => c.text || "").join("");
      } else if (content) {
        rawText = (content as any).text || String(content);
      }
      
      rawText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
      const startIdx = rawText.indexOf('{');
      const endIdx = rawText.lastIndexOf('}') + 1;
      
      if (startIdx !== -1 && endIdx !== 0) {
        rawText = rawText.substring(startIdx, endIdx);
      }
      
      const quizData = JSON.parse(rawText);
      
      if (!quizData.quiz || quizData.quiz.length === 0) {
        throw new Error("Not enough educational material in the sources to generate more questions.");
      }

      setQuiz(prev => prev ? [...prev, ...quizData.quiz] : quizData.quiz);
      
    } catch (error: any) {
      console.error("Failed to load quiz", error);
      setQuizErrorToast(error.message);
      setTimeout(() => setQuizErrorToast(null), 4000);
    } finally {
      setLoadingQuiz(false);
    }
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
      await fetch(`${API_URL}/api/documents/${id}`, { method: "DELETE" });
      
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

      {/* --- NEW: Quiz Error Toast --- */}
      {quizErrorToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] px-6 py-2.5 rounded-full shadow-lg text-sm font-semibold text-white bg-red-500 animate-pulse flex items-center gap-2">
          <span className="w-2 h-2 bg-white rounded-full animate-ping"></span>
          {quizErrorToast}
        </div>
      )}
      <div className="flex w-full h-full bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-300">

      {/* --- NEW: Mobile Sidebar Overlay --- */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden" 
          onClick={() => setIsMobileMenuOpen(false)} 
        />
      )}

      {/* --- UPDATED: Responsive Sidebar --- */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col transition-transform duration-300 md:relative md:translate-x-0 ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}>
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
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        
        {/* Unified Responsive Header */}
        <header className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 p-4 flex items-center justify-between shrink-0 z-10">
          <div className="flex items-center">
            <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden text-gray-600 dark:text-gray-300 mr-3">
              <Menu size={24} />
            </button>
            <h1 className="font-bold text-gray-800 dark:text-gray-200">Multi-Source Learning Assistant</h1>
          </div>
          
          <button 
            onClick={() => setDarkMode(!darkMode)} 
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-300"
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </header>

        {/* Scrollable Main Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-4xl mx-auto w-full flex flex-col gap-6">
            
            <SourceUploader onSourceAdded={handleSourceAdded} />

            {/* Badges */}
            {sources.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {sources.map((src, i) => (
                  <div 
                    key={i} 
                    className="group relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 pl-3 pr-14 py-1.5 rounded-full text-xs font-medium text-gray-700 dark:text-gray-300 shadow-sm flex items-center gap-2 transition-colors"
                  >
                    <span className={`w-2 h-2 shrink-0 rounded-full ${src.type === 'file' ? 'bg-orange-500' : 'bg-red-500'}`}></span>
                    <span className="truncate max-w-[150px]">{src.name}</span>
                    
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-white dark:bg-gray-800 pl-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity rounded-r-full">
                      
                      {src.type === 'link' ? (
                        <a href={src.name} target="_blank" rel="noopener noreferrer" className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-400 hover:text-blue-500 transition-colors" title="Open Link">
                          <ExternalLink size={12} />
                        </a>
                      ) : src.download_url ? (
                        <a href={src.download_url} target="_blank" rel="noopener noreferrer" className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-400 hover:text-blue-500 transition-colors" title="Download Original File">
                          <Download size={12} />
                        </a>
                      ) : (
                        <button onClick={() => alert("This file was uploaded before cloud storage was enabled. Please re-upload the file to enable downloads.")} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-400 hover:text-blue-500 transition-colors" title="File not available">
                          <Download size={12} />
                        </button>
                      )}

                      <button onClick={() => handleDeleteSource(src.id, i)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-400 hover:text-red-500 transition-colors" title="Delete Source">
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
                
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

            {/* --- Source Summaries Display --- */}
            {sources.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">Source Summaries</h3>
                {sources.map((src, i) => (
                  <details 
                    key={i} 
                    open={i === sources.length - 1}
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
                    
                    {/* --- FIX: Add a fallback string if src.summary is null or empty --- */}
                    <div className="mt-4 prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
                      <ReactMarkdown>{src.summary || "*No summary available. This file may have been uploaded before summaries were enabled, or the AI failed to process it.*"}</ReactMarkdown>
                    </div>
                  </details>
                ))}
              </div>
            )}

            {/* QUIZ UI */}
            {quiz && (
              <div className="bg-purple-50 dark:bg-purple-900/20 p-6 rounded-lg border border-purple-100 dark:border-purple-800/50 shadow-sm transition-colors">
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
                key={activeSessionId}
                sessionId={activeSessionId}
                sources={sources}
                onMessagesChange={(newMessages) => {
                  setSessions(prev => prev.map(s => 
                    s.id === activeSessionId ? { ...s, messages: newMessages } : s
                  ));
                }}
                onRename={(newTitle) => {
                  setSessions(prev => prev.map(s => 
                    s.id === activeSessionId ? { ...s, title: newTitle } : s
                  ));
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}