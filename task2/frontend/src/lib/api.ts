import { CoursePlan } from "@/types/course";
import { Message } from "@/types/chat";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function chatWithAI(sessionId: string | null, messages: Message[], currentPlan: CoursePlan | null, file?: File | null) {
  const formattedMessages = messages.map((msg) => ({
    role: msg.sender,
    content: msg.text,
  }));

  const formData = new FormData();
  if (sessionId) formData.append("session_id", sessionId);
  formData.append("messages", JSON.stringify(formattedMessages));
  if (currentPlan) {
    formData.append("current_plan", JSON.stringify(currentPlan));
  }
  if (file) {
    formData.append("file", file);
  }

  const response = await fetch(`${API_URL}/api/chat`, {
    method: "POST",
    body: formData, // FormData automatically sets multipart/form-data headers
  });

  if (!response.ok) {
    throw new Error("Failed to communicate with the AI");
  }

  return response.json();
}