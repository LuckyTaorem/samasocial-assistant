import { Message } from "@/types/chat";

interface ChatMessageProps {
  message: Message;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.sender === "user";

  return (
    <div className={`flex w-full mb-4 animate-fade-in ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm transition-all duration-200 ${
          isUser
            ? "bg-blue-600 text-white rounded-br-xs shadow-blue-500/10"
            : "bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-xs"
        }`}
      >
        <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>
        <span
          className={`text-[10px] block mt-1.5 font-medium ${
            isUser ? "text-blue-100" : "text-slate-400"
          }`}
        >
          {message.timestamp}
        </span>
      </div>
    </div>
  );
}