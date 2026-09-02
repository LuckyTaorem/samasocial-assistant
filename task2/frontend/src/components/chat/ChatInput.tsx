"use client";

import { useState, useRef } from "react";
import { Send, Paperclip, X } from "lucide-react";

interface ChatInputProps {
  onSendMessage: (message: string, file: File | null) => void;
}

export default function ChatInput({ onSendMessage }: ChatInputProps) {
  const [input, setInput] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    if (input.trim() || selectedFile) {
      onSendMessage(input.trim() || "Please analyze this syllabus PDF.", selectedFile);
      setInput("");
      setSelectedFile(null);
    }
  };

  return (
    <div className="p-4 bg-white dark:bg-slate-950 border-t border-slate-200/80 dark:border-slate-800 shadow-xs transition-colors">
      {selectedFile && (
        <div className="flex items-center justify-between bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-lg mb-2 text-xs text-blue-700 animate-fade-in">
          <span className="truncate font-medium">📎 {selectedFile.name}</span>
          <button onClick={() => setSelectedFile(null)} className="text-blue-400 hover:text-blue-600 transition-colors">
            <X size={14} />
          </button>
        </div>
      )}
      <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 rounded-xl p-1.5 focus-within:border-blue-500 focus-within:bg-white dark:focus-within:bg-slate-800 focus-within:ring-2 focus-within:ring-blue-500/10 transition-all">
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={(e) => e.target.files?.[0] && setSelectedFile(e.target.files[0])} 
          accept=".pdf" 
          className="hidden" 
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100 transition-colors"
          title="Upload Syllabus PDF"
        >
          <Paperclip size={18} />
        </button>
        <textarea
          className="w-full bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-3 py-2 focus:outline-none resize-none transition-colors"
          rows={1}
          placeholder="Type your message or upload syllabus..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <button
          onClick={handleSend}
          className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white p-2.5 rounded-lg flex items-center justify-center transition-all shadow-xs"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}