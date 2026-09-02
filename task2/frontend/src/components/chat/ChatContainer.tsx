"use client";

import { useState } from "react";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import { Message } from "@/types/chat";
import { CoursePlan } from "@/types/course";
import { chatWithAI } from "@/lib/api";

interface Props {
  sessionId: string | null;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  coursePlan: CoursePlan | null;
  setCoursePlan: React.Dispatch<React.SetStateAction<CoursePlan | null>>;
}

export default function ChatContainer({ sessionId, messages, setMessages, coursePlan, setCoursePlan }: Props) {
  const [isLoading, setIsLoading] = useState(false);

  const handleSendMessage = async (text: string, file: File | null) => {

    let displayMessage = text;
    if (file) {
      displayMessage = `📄 Attached: ${file.name}\n\n${text}`;
    }
    
    // 1. Add User Message immediately to UI
    const newUserMessage: Message = {
      id: Date.now().toString(),
      sender: "user",
      text: displayMessage,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    
    // We create a new array so we can pass it directly to the API
    const updatedMessages = [...messages, newUserMessage];
    setMessages(updatedMessages);
    setIsLoading(true);

    try {
      // 2. Call FastAPI Backend!
      const data = await chatWithAI(sessionId, updatedMessages, coursePlan, file);
      
      // 3. Add AI Reply to UI
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        sender: "assistant",
        text: data.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, aiMessage]);

      // 4. If the AI generated or updated the plan, update the right panel!
      if (data.plan) {
        setCoursePlan(data.plan);
      }
    } catch (error) {
      console.error(error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        sender: "assistant",
        text: "Sorry, I had trouble connecting to the server. Please ensure your backend is running.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800 transition-colors">
  <div className="px-4 py-3 bg-white dark:bg-slate-950 border-b border-slate-200/80 dark:border-slate-800 shadow-xs transition-colors">
    <h2 className="text-md font-semibold text-slate-800 dark:text-slate-100">Course Intake</h2>
    <p className="text-xs text-slate-400 dark:text-slate-500">Discuss your curriculum needs</p>
  </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col">
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        {isLoading && (
          <div className="text-xs text-gray-400 italic mt-2 ml-4">
            AI is thinking...
          </div>
        )}
      </div>

      <ChatInput onSendMessage={handleSendMessage} />
    </div>
  );
}