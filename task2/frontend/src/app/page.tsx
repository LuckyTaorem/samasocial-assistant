"use client";

import { useState, useEffect } from "react";
import { Panel, Group, Separator } from "react-resizable-panels";
import ChatContainer from "@/components/chat/ChatContainer";
import CoursePreview from "@/components/course/CoursePreview";
import { CoursePlan } from "@/types/course";
import { Message } from "@/types/chat";
import { Menu, X, Plus, MessageSquare, Sparkles, Sun, Moon, Trash2 } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface SessionItem {
  id: string;
  created_at: string;
  title?: string; // Add title here
}

const getUserId = () => {
  if (typeof window !== "undefined") {
    let uid = localStorage.getItem("course_planner_user_id");
    if (!uid) {
      uid = crypto.randomUUID(); // Generates a unique browser ID
      localStorage.setItem("course_planner_user_id", uid);
    }
    return uid;
  }
  return "anonymous";
};

export default function Home() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [coursePlan, setCoursePlan] = useState<CoursePlan | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      sender: "assistant",
      text: "Hello! I am your AI Course Planning Assistant. What subject would you like to build a course for?",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const fetchSessions = async () => {
    try {
      const res = await fetch(`${API_URL}/api/sessions`, {
        headers: {
          "X-User-ID": getUserId(),
        },
      });
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch (err) {
      console.error("Failed to load session list", err);
    }
  };

  // Initialize or load session from URL query params
useEffect(() => {
    async function initSession() {
      setIsLoadingSession(true);
      try {
        // 1. Fetch available sessions for this specific user
        const res = await fetch(`${API_URL}/api/sessions`, {
          headers: { "X-User-ID": getUserId() },
        });
        const data = await res.json();
        const userSessions = data.sessions || [];
        setSessions(userSessions);

        // 2. Check URL for an existing session ID
        const params = new URLSearchParams(window.location.search);
        let sid = params.get("session");

        // 3. Try to load the session from the URL if it exists
        if (sid && sid !== "undefined" && sid !== "null") {
          const sessionRes = await fetch(`${API_URL}/api/sessions/${sid}`);
          if (sessionRes.ok) {
            const sessionData = await sessionRes.json();
            setSessionId(sid);
            if (sessionData.plan) setCoursePlan(sessionData.plan);
            if (sessionData.messages && sessionData.messages.length > 0) {
              setMessages(
                sessionData.messages.map((m: any) => ({
                  id: m.id,
                  sender: m.role,
                  text: m.content,
                  timestamp: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                }))
              );
            }
            return; // Successfully loaded URL session, exit early
          }
        }

        // 4. If URL session is missing/invalid, fallback to their most recent session
        if (userSessions.length > 0) {
          handleSelectSession(userSessions[0].id);
        } else {
          // 5. If they have zero sessions, create a brand new one
          await handleNewSession();
        }

      } catch (err) {
        console.error("Initialization error:", err);
      } finally {
        setIsLoadingSession(false);
      }
    }
    initSession();
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // --- NEW: Auto-refresh sidebar titles when chat updates ---
  useEffect(() => {
    // If we have an active session and the user/AI has sent messages, 
    // silently fetch the sessions list in the background to grab the newly generated title.
    if (sessionId && messages.length > 1) {
      fetchSessions();
    }
  }, [messages.length, sessionId]);
  // ----------------------------------------------------------

  // Create a brand new session and reset UI
  const handleNewSession = async () => {
    setIsLoadingSession(true);
    try {
      const res = await fetch(`${API_URL}/api/sessions`, { 
        method: "POST",
        headers: { "X-User-ID": getUserId() },
      });
      
      if (!res.ok) {
        throw new Error("Backend failed to create a session.");
      }
      
      const data = await res.json();
      const sid = data.session_id;
      
      // Safety check: Only update URL if the backend returned a valid ID
      if (sid) {
        window.history.replaceState({}, "", `?session=${sid}`);
        setSessionId(sid);
        setCoursePlan(null);
        setMessages([
          {
            id: "1",
            sender: "assistant",
            text: "Hello! I am your AI Course Planning Assistant. What subject would you like to build a course for?",
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        await fetchSessions();
      }
    } catch (err) {
      console.error("Failed to create session", err);
    } finally {
      setIsSidebarOpen(false);
      setIsLoadingSession(false); 
    }
  };

  // Switch to an old session
  const handleSelectSession = async (sid: string) => {
    // Prevent fetching and loading if we are already viewing this session!
    if (sid === sessionId) {
      setIsSidebarOpen(false);
      return; 
    }

    setIsLoadingSession(true);
    try {
      const res = await fetch(`${API_URL}/api/sessions/${sid}`);
      if (res.ok) {
        const data = await res.json();
        setSessionId(sid);
        window.history.replaceState({}, "", `?session=${sid}`);
        setCoursePlan(data.plan || null);
        
        if (data.messages && data.messages.length > 0) {
          setMessages(
            data.messages.map((m: any) => ({
              id: m.id,
              sender: m.role,   // Maps database role to 'sender'
              text: m.content,  // Maps database content to 'text'
              timestamp: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }))
          );
        } else {
          setMessages([
            {
              id: "1",
              sender: "assistant",
              text: "Hello! Resumed session.",
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          ]);
        }
      }
    } catch (err) {
      console.error("Failed to load selected session", err);
    } finally {
      setIsSidebarOpen(false);
      setIsLoadingSession(false); // Guarantee removal
    }
  };

  const handleDeleteSession = async (sid: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering session selection

    // 1. Safeguard: Do not allow deleting if it's the only session left
    if (sessions.length <= 1) {
      alert("You cannot delete your final remaining session.");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/sessions/${sid}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        // Filter out deleted session from local state list
        const remainingSessions = sessions.filter(s => s.id !== sid);
        setSessions(remainingSessions);

        // If the user deleted the currently active session, switch to the top remaining session
        if (sid === sessionId && remainingSessions.length > 0) {
          handleSelectSession(remainingSessions[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to delete session:", err);
    }
  };

  return (
    <main className="h-screen w-full bg-slate-50 flex flex-col overflow-hidden relative print:h-auto print:overflow-visible print:block">
      {/* Top Header */}
      <header className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between px-4 sm:px-6 shadow-xs z-20 shrink-0 transition-colors print:hidden">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            title="Toggle Sidebar"
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-600 text-white rounded-md">
              <Sparkles size={16} />
            </div>
            <h1 className="text-sm font-bold text-slate-800 dark:text-white tracking-tight">AI Course Planner</h1>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
            Session: {sessionId ? sessionId.slice(0, 8) + '...' : 'Loading...'}
          </span>
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-lg transition-colors"
          >
            {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </header>

      {/* Main Layout Container with Expandable Sidebar */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Expandable Sidebar Overlay / Drawer */}
        <div
          className={`absolute inset-y-0 left-0 z-30 w-72 bg-white border-r border-slate-200 shadow-xl flex flex-col transition-transform duration-300 transform ${
            isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Planning Sessions</h2>
            <button onClick={() => setIsSidebarOpen(false)} className="text-slate-400 hover:text-slate-600">
              <X size={16} />
            </button>
          </div>

          <div className="p-3">
            <button
              onClick={handleNewSession}
              className="w-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-medium py-2.5 px-3 rounded-lg text-xs flex items-center justify-center gap-2 transition-all shadow-xs"
            >
              <Plus size={16} /> New Session
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-2">Recent Sessions</h3>
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center gap-1 group">
                <button
                  onClick={() => handleSelectSession(s.id)}
                  className={`flex-1 text-left px-3 py-2.5 rounded-lg text-xs flex items-center gap-2.5 transition-colors ${
                    sessionId === s.id
                      ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-semibold border border-blue-200/60 dark:border-blue-800/50"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50"
                  }`}
                >
                  <MessageSquare size={14} className="shrink-0 text-slate-400" />
                  <div className="truncate flex-1">
                    <p className="truncate font-medium">{s.title || "New Session"}</p>
                    <span className="text-[10px] text-slate-400 font-normal">
                      {new Date(s.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </button>
                <button
                  onClick={(e) => handleDeleteSession(s.id,e)}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                  title="Delete Session"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Backdrop for mobile drawer */}
        {isSidebarOpen && (
          <div
            onClick={() => setIsSidebarOpen(false)}
            className="absolute inset-0 bg-slate-900/20 backdrop-blur-xs z-20 md:hidden"
          />
        )}

        {/* Resizable Split Panes with Enforced Minimum Widths */}
        <div className="flex-1 h-full overflow-hidden relative print:h-auto print:overflow-visible print:block">
          
          {/* --- WORKSPACE-SCOPED LOADING OVERLAY --- */}
          {isLoadingSession && (
            <div className="absolute inset-0 z-10 bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center transition-all">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium animate-pulse">
                Fetching session data...
              </p>
            </div>
          )}
          {/* ---------------------------------------- */}

          <Group orientation="horizontal" className="print:block print:h-auto print:overflow-visible">
            <Panel defaultSize={40} minSize={30} className="print:hidden">
              <ChatContainer 
                sessionId={sessionId}
                messages={messages} 
                setMessages={setMessages} 
                coursePlan={coursePlan} 
                setCoursePlan={setCoursePlan} 
              />
            </Panel>

            <Separator className="w-2 bg-slate-200 dark:bg-slate-700 hover:bg-blue-400 dark:hover:bg-blue-500 transition-colors cursor-col-resize flex items-center justify-center print:hidden">
              <div className="w-1 h-8 bg-slate-400 dark:bg-slate-500 rounded-full flex flex-col justify-between p-[1px]">
                <div className="bg-white dark:bg-slate-900 h-1 w-full rounded-full"></div>
                <div className="bg-white dark:bg-slate-900 h-1 w-full rounded-full"></div>
                <div className="bg-white dark:bg-slate-900 h-1 w-full rounded-full"></div>
              </div>
            </Separator>

            <Panel defaultSize={60} minSize={45} className="print:w-full print:h-auto print:overflow-visible print:block">
              <CoursePreview coursePlan={coursePlan} setCoursePlan={setCoursePlan} />
            </Panel>
          </Group>
        </div>
      </div>
    </main>
  );
}