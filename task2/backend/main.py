import json
import os
from fastapi import Body, FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from groq import Groq
from requests import request
from supabase import create_client, Client
from pypdf import PdfReader
import io
from schemas import ChatRequest, AIResponse
import uuid

load_dotenv()

app = FastAPI(title="Course Planner AI API")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = Groq(api_key=os.getenv("GROQ_API_KEY"))
supabase: Client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

SYSTEM_PROMPT = """You are an expert instructional designer and AI course-planning mentor. Your goal is to guide the mentor through a structured curriculum-building process.

You must ALWAYS respond with a valid JSON object containing these two fields:
{
  "reply": "Your conversational message or question to the mentor.",
  "plan": null // or the full structured course plan object when ready
}

WORKFLOW STAGES:
1. INTAKE STAGE: 
   - If the mentor has not yet provided the Subject/Topic, Target Audience (age, skill level, prior knowledge), Duration & Session Frequency, and Learning Goals, keep `"plan": null`.
   - Ask clarifying questions conversationally (1-2 at a time) to gather these details.

2. GENERATION STAGE: 
   - Once you have enough information from the intake conversation (or if the mentor uploaded a syllabus PDF), generate a comprehensive course plan.
   - Populate `"plan"` with: subject, targetAudience, duration, and an array of modules.
   - Each module must contain: id, title, learningObjectives, prerequisites (bonus), and lessons.
   - Each lesson must contain: id, title, topics, difficulty ("Beginner" | "Intermediate" | "Advanced"), assessments, and recommended resources (strictly public platforms like YouTube, documentation, HackerRank, LeetCode, Kaggle, blog posts, or articles with titles, types, and URLs).
   - Include module-level assessments/quizzes.

3. REFINEMENT & EXTENSION RULES (CRITICAL):
   - When the mentor asks to **add more modules**, **expand**, or **modify** the course, you MUST **retain all existing modules** from the current course plan state. 
   - Append the new modules sequentially right after the existing ones (e.g., if the current plan already has 2 modules, your new modules must start at Module 3 onwards). Do not reset the module sequence or overwrite previous work unless explicitly told to restart from scratch.

4. SCHEMA REQUIREMENTS: 
   - Each module must have: id, title, learningObjectives (array of strings), prerequisites (array of strings), lessons (array), and assessment (string).
   - Each lesson must have: id, title, topics (array of strings), difficulty ("Beginner" | "Intermediate" | "Advanced"), resources (array with title, type, url), and assessment.
"""

@app.post("/api/chat", response_model=AIResponse)
async def chat_with_ai(
    session_id: str = Form(None), # <--- Added session_id parameter
    messages: str = Form(...),  
    current_plan: str = Form(None),
    file: UploadFile = File(None)
):
    try:
        parsed_messages = json.loads(messages)
        parsed_plan = json.loads(current_plan) if current_plan else None

        chat_history = [{"role": "system", "content": SYSTEM_PROMPT}]

        # Handle PDF upload if attached
        if file:
            contents = await file.read()
            reader = PdfReader(io.BytesIO(contents))
            extracted_text = ""
            for page in reader.pages:
                extracted_text += page.extract_text() or ""
            
            chat_history.append({
                "role": "user",
                "content": f"[Uploaded Syllabus PDF Content]:\n{extracted_text[:4000]}\n\nPlease analyze this syllabus, improve it, and generate the structured course plan."
            })

        if parsed_plan:
            chat_history.append({
                "role": "system", 
                "content": f"The current course plan state is: {json.dumps(parsed_plan)}"
            })
            
        for msg in parsed_messages:
            chat_history.append({"role": msg["role"], "content": msg["content"]})

        completion = client.chat.completions.create(
            model="qwen/qwen3.6-27b",
            messages=chat_history,
            response_format={"type": "json_object"},
        )
        
        raw_content = completion.choices[0].message.content
        parsed_data = json.loads(raw_content)
        response_obj = AIResponse(**parsed_data)

        # Save session history and course plans to Supabase if session_id exists
        if session_id and parsed_messages:
            latest_user_msg = parsed_messages[-1]["content"]
            try:
                supabase.table("messages").insert([
                    {"session_id": session_id, "role": "user", "content": latest_user_msg},
                    {"session_id": session_id, "role": "assistant", "content": response_obj.reply}
                ]).execute()

                if response_obj.plan:
                    plan_result = supabase.table("course_plans").upsert({
                        "session_id": session_id,
                        "plan_data": response_obj.plan.model_dump()
                    }, on_conflict="session_id").execute()
                    print(f"Course plan saved successfully: {plan_result}")
            except Exception as db_err:
                print(f"CRITICAL DATABASE SAVE ERROR: {str(db_err)}")

        return response_obj

    except Exception as e:
        print(f"Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"AI processing failed: {str(e)}")

import uuid

@app.get("/api/sessions")
def list_sessions():
    """Retrieves all planning sessions ordered by creation date"""
    try:
        res = supabase.table("sessions").select("*").order("created_at", desc=True).limit(20).execute()
        return {"sessions": res.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/sessions")
def create_session():
    """Creates a new planning session in Supabase with a generated UUID"""
    try:
        session_id = str(uuid.uuid4())
        res = supabase.table("sessions").insert({"id": session_id}).execute()
        return {"session_id": session_id}
    except Exception as e:
        print(f"--- SUPABASE SESSION ERROR: {str(e)} ---") # <--- Print the real error
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/sessions/{session_id}")
def get_session_data(session_id: str):
    """Retrieves chat history and course plan for an existing session"""
    try:
        messages_res = supabase.table("messages").select("*").eq("session_id", session_id).order("created_at").execute()
        plan_res = supabase.table("course_plans").select("*").eq("session_id", session_id).execute()
        
        return {
            "messages": messages_res.data,
            "plan": plan_res.data[0]["plan_data"] if plan_res.data else None
        }
    except Exception as e:
        raise HTTPException(status_code=404, detail="Session not found")