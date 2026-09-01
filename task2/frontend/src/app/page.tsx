"use client";

import { useState, useEffect } from "react";
import { Panel, Group, Separator } from "react-resizable-panels";
import ChatContainer from "@/components/chat/ChatContainer";
import CoursePreview from "@/components/course/CoursePreview";
import { CoursePlan } from "@/types/course";
import { Message } from "@/types/chat";
import { Menu, X, Plus, MessageSquare, Sparkles } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface SessionItem {
  id: string;
  created_at: string;
}

export default function Home() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [coursePlan, setCoursePlan] = useState<CoursePlan | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      sender: "assistant",
      text: "Hello! I am your AI Course Planning Assistant. What subject would you like to build a course for?",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  // Fetch list of old sessions
  const fetchSessions = async () => {
    try {
      const res = await fetch(`${API_URL}/api/sessions`);
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
      await fetchSessions();
      const params = new URLSearchParams(window.location.search);
      let sid = params.get("session");

      if (sid && sid !== "undefined" && sid !== "null") {
        try {
          const res = await fetch(`${API_URL}/api/sessions/${sid}`);
          if (res.ok) {
            const data = await res.json();
            setSessionId(sid);
            if (data.plan) setCoursePlan(data.plan);
            if (data.messages && data.messages.length > 0) {
              setMessages(
                data.messages.map((m: any) => ({
                  id: m.id,
                  sender: m.role,
                  text: m.content,
                  timestamp: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                }))
              );
            }
            return;
          }
        } catch (err) {
          console.error("Could not load session, creating new one...", err);
        }
      }

      // Create a brand new session if none exists
      await handleNewSession();
    }

    initSession();
  }, []);

  // Create a brand new session and reset UI
  const handleNewSession = async () => {
    try {
      const res = await fetch(`${API_URL}/api/sessions`, { method: "POST" });
      const data = await res.json();
      const sid = data.session_id;
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
      setIsSidebarOpen(false);
    } catch (err) {
      console.error("Failed to create session", err);
    }
  };

  // Switch to an old session
  const handleSelectSession = async (sid: string) => {
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
              sender: m.role,
              text: m.content,
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
        setIsSidebarOpen(false);
      }
    } catch (err) {
      console.error("Failed to load selected session", err);
    }
  };

  return (
    <main className="h-screen w-full bg-slate-50 flex flex-col overflow-hidden relative">
      {/* Top Header */}
      <header className="h-14 bg-white border-b border-slate-200/80 flex items-center justify-between px-4 sm:px-6 shadow-xs z-20 shrink-0">
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
            <h1 className="text-sm font-bold text-slate-800 tracking-tight">AI Course Planner</h1>
          </div>
        </div>
        <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
          Session: {sessionId ? sessionId.slice(0, 8) + '...' : 'Loading...'}
        </span>
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
              <button
                key={s.id}
                onClick={() => handleSelectSession(s.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-xs flex items-center gap-2.5 transition-colors ${
                  sessionId === s.id
                    ? "bg-blue-50 text-blue-700 font-semibold border border-blue-200/60"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <MessageSquare size={14} className="shrink-0 text-slate-400" />
                <div className="truncate flex-1">
                  <p className="truncate font-medium">Session {s.id.slice(0, 8)}</p>
                  <span className="text-[10px] text-slate-400 font-normal">
                    {new Date(s.created_at).toLocaleDateString()} {new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </button>
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
        <div className="flex-1 h-full overflow-hidden">
          <Group orientation="horizontal">
            <Panel defaultSize={40} minSize={30}>
              <ChatContainer 
                sessionId={sessionId}
                messages={messages} 
                setMessages={setMessages} 
                coursePlan={coursePlan} 
                setCoursePlan={setCoursePlan} 
              />
            </Panel>

            <Separator className="w-2 bg-slate-200 hover:bg-blue-400 transition-colors cursor-col-resize flex items-center justify-center">
              <div className="w-1 h-8 bg-slate-400 rounded-full flex flex-col justify-between p-[1px]">
                <div className="bg-white h-1 w-full rounded-full"></div>
                <div className="bg-white h-1 w-full rounded-full"></div>
                <div className="bg-white h-1 w-full rounded-full"></div>
              </div>
            </Separator>

            <Panel defaultSize={60} minSize={35}>
              <CoursePreview coursePlan={coursePlan} setCoursePlan={setCoursePlan} />
            </Panel>
          </Group>
        </div>
      </div>
    </main>
  );
}