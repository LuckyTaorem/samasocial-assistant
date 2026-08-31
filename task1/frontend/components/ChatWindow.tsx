"use client";

import { useState, useRef, useEffect } from "react";
import { Send, User, Bot } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Message = { role: "user" | "assistant"; content: string };

export default function ChatWindow({ 
  sessionId, 
  sources, // <-- NEW
  onMessagesChange,
  onRename 
}: { 
  sessionId: string; 
  sources: any[]; // <-- NEW
  onMessagesChange: (msgs: any[]) => void;
  onRename: (newTitle: string) => void; 
}) {

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load messages when the session changes
  useEffect(() => {
    const saved = localStorage.getItem("chat_sessions");
    if (saved) {
      const sessions = JSON.parse(saved);
      const current = sessions.find((s: any) => s.id === sessionId);
      if (current) setMessages(current.messages || []);
    }
  }, [sessionId]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    // Sync up to parent layout to trigger the localStorage save
    if (messages.length > 0) onMessagesChange(messages);
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    // --- NEW: Generate AI Title on the very first message ---
    if (messages.length === 0) {
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/chat/title`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input }),
      })
      .then(res => res.json())
      .then(data => {
        if (data.title) onRename(data.title);
      })
      .catch(err => console.error("Title generation failed", err));
    }

    const userMsg: Message = { role: "user", content: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    onMessagesChange(newMessages);
    setInput("");
    setIsTyping(true);

    // Add a placeholder for the assistant's streaming response
    setMessages([...newMessages, { role: "assistant", content: "" }]);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          query: userMsg.content, 
          session_history: messages,
          active_sources: sources.map(s => s.name)
        }),
      });

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let assistantResponse = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        assistantResponse += chunk;
        
        // Update the last message in real-time
        setMessages((prev) => {
          const newMsgs = [...prev];
          newMsgs[newMsgs.length - 1].content = assistantResponse;
          return newMsgs;
        });
      }
    } catch (error) {
      console.error("Chat error:", error);
      onMessagesChange([
        ...newMessages,
        { role: "assistant", content: "Sorry, something went wrong. Please check your connection and try again." }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-[500px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 dark:text-gray-500 mt-20">
            <p>Upload a source above, then ask me anything about it!</p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === "user" ? "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300" : "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300"}`}>
                {msg.role === "user" ? <User size={18} /> : <Bot size={18} />}
              </div>
              <div className={`px-4 py-2 max-w-[80%] rounded-2xl text-sm overflow-x-auto ${
                msg.role === "user" 
                  ? "bg-blue-600 text-white rounded-tr-none" 
                  : "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-tl-none prose prose-sm dark:prose-invert max-w-none"
              }`}>
                {/* --- ADDED TYPING ANIMATION --- */}
                {msg.role === "assistant" && msg.content === "" ? (
                  <div className="flex space-x-1.5 items-center h-5 px-1">
                    <div className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-400 rounded-full animate-bounce"></div>
                  </div>
                ) : msg.role === "user" ? (
                  msg.content
                ) : (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.content}
                  </ReactMarkdown>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* --- ADDED DARK MODE CLASSES TO INPUT AREA --- */}
      <form onSubmit={handleSend} className="p-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-b-lg flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about your sources..."
          className="flex-1 px-4 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 placeholder-gray-400 dark:placeholder-gray-500 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          disabled={isTyping}
        />
        <button 
          type="submit" 
          disabled={!input.trim() || isTyping}
          className="bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}