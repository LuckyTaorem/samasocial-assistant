import uuid
import sys
import json
import os
from fastapi import Body, FastAPI, HTTPException, UploadFile, File, Form, Header
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from litellm import completion
import litellm
from supabase import create_client, Client
from pypdf import PdfReader
import io
from schemas import ChatRequest, AIResponse
from tavily import TavilyClient
litellm.suppress_debug_info = True
litellm.drop_params = True

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

supabase: Client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
tavily_client = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))

# --- OPTIMIZED SYSTEM PROMPT WITH INTAKE & UNIVERSAL PRACTICE EXERCISES ---
# --- MODULAR SYSTEM PROMPTS ---

INTAKE_PROMPT = """You are an AI course-planning mentor. The user wants to build a course.
Your goal is strictly to ask 1-2 conversational questions to gather: Subject, Target Audience, and Duration.
DO NOT generate the course plan yet.

CRITICAL JSON RULES:
Output ONLY this exact JSON format. No markdown, no trailing commas, escape internal quotes.
{
  "reply": "Your conversational question here...",
  "full_plan": null,
  "modifications": null
}"""

GENERATION_PROMPT = """You are an AI course-planning mentor. 
Your goal is to generate a comprehensive course plan based on the user's input.
Assume sensible defaults (e.g., Duration: "8-12 weeks", Target Audience: "Beginners") if not fully specified.

STRICT SEPARATION RULES FOR URLS:
1. `resources`: Official documentation, guides, or explanatory articles.
2. `practiceExercises`: MUST BE 100% INTERACTIVE (e.g., LeetCode, HackerRank, Kaggle). No static blogs.

SCHEMA FOR A MODULE: 
{ "id": "M1", "title": "...", "learningObjectives": ["..."], "prerequisites": ["..."], "lessons": [ { "id": "L1", "title": "...", "topics": ["..."], "difficulty": "Beginner | Intermediate | Advanced", "resources": [{"title":"", "type":"Documentation", "url":"..."}], "practiceExercises": [{"title":"", "type":"Interactive Problem", "url":"..."}], "assessment": "..." } ], "assessment": "..." }

CRITICAL JSON RULES:
Output ONLY this exact JSON format. No markdown, no trailing commas, escape internal quotes.
{
  "reply": "Here is your course...",
  "full_plan": { "subject": "...", "duration": "...", "targetAudience": "...", "modules": [ array of complete modules ] },
  "modifications": null
}"""

MODIFICATION_PROMPT = """You are an AI course-planning mentor modifying an existing course plan.
REFINEMENT RULES: Retain existing modules. Append new modules sequentially (e.g., if plan has M1 and M2, new is M3).

CRITICAL JSON RULES:
Output ONLY this exact JSON format containing the delta changes. No markdown, no trailing commas, escape internal quotes.
{
  "reply": "I have updated the plan...",
  "full_plan": null,
  "modifications": {
    "added_or_edited_modules": [ array of new/updated modules ],
    "deleted_module_ids": [ array of IDs to remove ]
  }
}"""

def clean_and_enforce_practice_links(plan):
    if not plan or "modules" not in plan:
        return plan
    
    subject = plan.get("subject", "").lower()
    is_tech = any(kw in subject for kw in ["code", "python", "javascript", "react", "programming", "software", "dev", "computer", "html", "css"])
    
    # Define fallback practice platforms based on domain
    default_practice_url = "https://leetcode.com/problemset/" if is_tech else "https://www.khanacademy.org/"

    for mod in plan.get("modules", []):
        for lesson in mod.get("lessons", []):
            # 1. Deduplicate resources
            seen_res_urls = set()
            unique_res = []
            for res in lesson.get("resources", []):
                url = res.get("url", "").strip().lower()
                if url and url not in seen_res_urls:
                    seen_res_urls.add(url)
                    unique_res.append(res)
                elif not url:
                    unique_res.append(res)
            lesson["resources"] = unique_res

            # 2. Deduplicate and filter practice exercises (Block blogs/articles)
            seen_ex_urls = set()
            unique_ex = []
            for ex in lesson.get("practiceExercises", []):
                url = ex.get("url", "").strip().lower()
                
                # Check if URL looks like a blog, article, or static read page
                is_blog_or_article = any(bad in url for bad in ["/blog/", "/article/", "/post/", "medium.com", "dev.to", "substack.com", "wordpress", "news"])
                
                if is_blog_or_article or not url:
                    # Force overwrite with a true practice platform
                    ex["url"] = default_practice_url
                    if is_tech:
                        ex["type"] = "LeetCode Practice"
                    else:
                        ex["type"] = "Interactive Practice Set"

                if url and url not in seen_ex_urls:
                    seen_ex_urls.add(ex.get("url", "").strip().lower())
                    unique_ex.append(ex)
                elif not url:
                    unique_ex.append(ex)
                    
            lesson["practiceExercises"] = unique_ex
            
    return plan

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
COHERE_API_KEY = os.getenv("COHERE_API_KEY")

if GROQ_API_KEY:
    os.environ["GROQ_API_KEY"] = GROQ_API_KEY
if GEMINI_API_KEY:
    os.environ["GEMINI_API_KEY"] = GEMINI_API_KEY
if OPENROUTER_API_KEY:
    os.environ["OPENROUTER_API_KEY"] = OPENROUTER_API_KEY
if COHERE_API_KEY:
    os.environ["COHERE_API_KEY"] = COHERE_API_KEY

FALLBACK_CHAIN = [
    "groq/openai/gpt-oss-120b",
    "gemini/gemini-2.5-flash",
    "openrouter/google/gemma-2-27b-it",
    "cohere/command-r-plus",
    "groq/openai/gpt-oss-20b"
]

def generate_with_fallback(messages, max_tokens, require_json=False):
    """Iterates through the FALLBACK_CHAIN until a model successfully returns valid output."""
    last_error = None
    for model in FALLBACK_CHAIN:
        try:
            kwargs = {
                "model": model,
                "messages": messages,
                "max_tokens": max_tokens,
                # Lowered temperature to 0.2 to force strict syntax adherence and reduce hallucinations
                "temperature": 0.2, 
            }
            
            # Let LiteLLM handle JSON mode conversion for ALL providers (Gemini, OpenRouter, Groq)
            if require_json:
                kwargs["response_format"] = {"type": "json_object"}
                
            response = completion(**kwargs)
            raw_content = response.choices[0].message.content
            
            if require_json:
                text = raw_content.strip()
                # Aggressively strip Markdown formatting if the AI hallucinated it
                if text.startswith("```"):
                    text = text.split("\n", 1)[-1]
                if text.endswith("```"):
                    text = text[:-3]
                text = text.strip()
                
                # Catch the edge case where the AI leaves the word "json" at the top
                if text.lower().startswith("json"):
                    text = text[4:].strip()
                
                # This will raise a JSONDecodeError if the model still breaks the syntax
                return json.loads(text)
            
            return raw_content.strip()
            
        except Exception as e:
            print(f"Fallback triggered: {model} failed. Error: {e}")
            last_error = e
            continue
            
    raise Exception(f"All models failed or returned unparsable JSON. Last error: {last_error}")

@app.post("/api/chat", response_model=AIResponse)
async def chat_with_ai(
    session_id: str = Form(None),
    messages: str = Form(...),  
    current_plan: str = Form(None),
    file: UploadFile = File(None)
):
    try:
        parsed_messages = json.loads(messages)
        raw_plan = json.loads(current_plan) if current_plan else None
        if isinstance(raw_plan, list):
            parsed_plan = {"modules": raw_plan}  # Coerce list into dictionary structure
        elif isinstance(raw_plan, dict):
            parsed_plan = raw_plan
        else:
            parsed_plan = None

        # --- 1. DYNAMIC PROMPT ROUTING ---
        if parsed_plan:
            active_system_prompt = MODIFICATION_PROMPT
        elif file or (parsed_messages and len(parsed_messages) > 2):
            active_system_prompt = GENERATION_PROMPT
        else:
            active_system_prompt = INTAKE_PROMPT

        raw_chat_history = [{"role": "system", "content": active_system_prompt}]

        latest_user_text = parsed_messages[-1]["content"] if parsed_messages else ""
        
        # --- DYNAMIC LESSON-AWARE TAVILY SEARCH ---
        verified_links_context = ""
        try:
            course_subject = parsed_plan.get("subject", "") if parsed_plan else latest_user_text
            lesson_queries = []
            if parsed_plan:
                for mod in parsed_plan.get("modules", []):
                    for lesson in mod.get("lessons", []):
                        if lesson.get("title"):
                            lesson_queries.append(lesson.get("title"))
            
            specific_topics = " ".join(lesson_queries[:5])
            search_query = f"{course_subject} {specific_topics} interactive coding challenges problem sets mock tests online practice platform"
            
            search_res = tavily_client.search(
                query=search_query,
                max_results=15,
                search_depth="basic"
            )
            results = search_res.get("results", [])
            if results:
                verified_links_context = "\n\nVERIFIED WEB SEARCH RESULTS:\n"
                verified_links_context += "Map these verified links to the most relevant lesson. Never assign the same URL to multiple lessons.\n"
                for idx, r in enumerate(results):
                    verified_links_context += f"[{idx+1}] Title: {r.get('title')}\n    URL: {r.get('url')}\n"
        except Exception as tavily_err:
            print(f"Tavily search warning: {tavily_err}")
        # ------------------------------------------

        # --- 2. BUILD RAW HISTORY ---
        if file:
            contents = await file.read()
            reader = PdfReader(io.BytesIO(contents))
            extracted_text = "".join([page.extract_text() or "" for page in reader.pages])
            raw_chat_history.append({
                "role": "user",
                "content": f"[PDF Syllabus]:\n{extracted_text[:4000]}\n\nGenerate the structured course plan. Limit to 4 modules with 2-3 lessons each."
            })

        if parsed_plan:
            minified_plan = json.dumps(parsed_plan, separators=(',', ':'))
            raw_chat_history.append({
                "role": "system", 
                "content": f"CURRENT PLAN STATE:\n{minified_plan}\n\nINSTRUCTION: Return ONLY the modifications."
            })
            
        if parsed_messages and len(parsed_messages) > 1:
            recent_history = parsed_messages[-7:-1] 
            for msg in recent_history:
                role = msg.get("role") or ("assistant" if msg.get("sender") == "assistant" else "user")
                text = msg.get("content") or msg.get("text") or ""
                if text:
                    if role == "assistant" and len(text) > 500:
                        text = text[:500] + "... [truncated]"
                    raw_chat_history.append({"role": role, "content": text})

        # Process PDF and attach it directly to the latest user message
        pdf_context = ""
        if file:
            try:
                contents = await file.read()
                reader = PdfReader(io.BytesIO(contents))
                extracted_text = "".join([page.extract_text() or "" for page in reader.pages])
                
                if extracted_text.strip():
                    pdf_context = f"\n\n--- EXTRACTED PDF SYLLABUS TEXT ---\n{extracted_text[:5000]}\n-----------------------------------\n\nSYSTEM INSTRUCTION: The user uploaded a PDF. The text has been automatically extracted and provided above. You MUST use this text to fulfill the request. DO NOT claim you cannot see or read the PDF."
                else:
                    pdf_context = "\n\n[System Error: The uploaded PDF contained no readable text (it may be a scanned image). Please inform the user that you need a text-based PDF.]"
            except Exception as pdf_err:
                print(f"PDF Parsing Error: {pdf_err}")
                pdf_context = "\n\n[System Error: Failed to read the uploaded PDF file. Please inform the user.]"

        if parsed_messages:
            last_msg = parsed_messages[-1]
            last_role = last_msg.get("role") or ("assistant" if last_msg.get("sender") == "assistant" else "user")
            last_text = last_msg.get("content") or last_msg.get("text") or ""
            raw_chat_history.append({
                "role": last_role, 
                "content": f"{last_text}{verified_links_context}"
            })
        elif pdf_context:
            # Edge case: The user uploaded a file but didn't type a message
            raw_chat_history.append({
                "role": "user", 
                "content": f"Please generate a course based on this uploaded document.{pdf_context}{verified_links_context}"
            })

        # --- 3. FIX OPENROUTER ALTERNATING ROLES ---
        chat_history = []
        for msg in raw_chat_history:
            if chat_history and chat_history[-1]["role"] == msg["role"]:
                chat_history[-1]["content"] += f"\n\n{msg['content']}"
            else:
                chat_history.append(msg)
        # -------------------------------------------

        try:
            raw_data = generate_with_fallback(
                messages=chat_history, 
                max_tokens=4000, 
                require_json=True
            )
        except Exception as fallback_err:
            print(f"AI chain failed: {fallback_err}")
            raise HTTPException(status_code=500, detail="The AI failed to generate a complete plan. Please try again.")

        if isinstance(raw_data, list):
            parsed_data = {"reply": "Here is your updated plan.", "full_plan": {"modules": raw_data}, "modifications": None}
        elif isinstance(raw_data, dict):
            parsed_data = raw_data
        else:
            # FIX: Removed `str(raw_content)` because that variable no longer exists in this scope.
            parsed_data = {"reply": "Here is your plan.", "full_plan": None, "modifications": None}
        
        # =========================================================
        # SMART MERGE LOGIC (Merges AI modifications into old plan)
        # =========================================================
        reply_text = parsed_data.get("reply", "")
        final_plan = None
        
        if parsed_plan:
            final_plan = parsed_plan
            mods = parsed_data.get("modifications", {})
            if mods:
                # 1. Process Deletions
                del_ids = mods.get("deleted_module_ids", [])
                if del_ids:
                    final_plan["modules"] = [m for m in final_plan.get("modules", []) if m.get("id") not in del_ids]
                
                # 2. Process Additions & Edits
                for mod in mods.get("added_or_edited_modules", []):
                    existing_idx = next((i for i, m in enumerate(final_plan.get("modules", [])) if m.get("id") == mod.get("id")), None)
                    if existing_idx is not None:
                        final_plan["modules"][existing_idx] = mod # Update existing
                    else:
                        final_plan["modules"].append(mod) # Append new
        else:
            # If no plan existed, grab the newly generated full plan
            final_plan = parsed_data.get("full_plan")

        final_plan = clean_and_enforce_practice_links(final_plan)

        response_obj = AIResponse(reply=reply_text, plan=final_plan)

        # Save to Supabase
        if session_id and parsed_messages:

            if len(parsed_messages) == 1:
                new_title = latest_user_text[:30] + ("..." if len(latest_user_text) > 30 else "")
                try:
                    ai_title = generate_with_fallback(
                        messages=[
                            {"role": "system", "content": "Generate a short 3-5 word title for this request. ONLY text, no quotes."},
                            {"role": "user", "content": latest_user_text}
                        ],
                        max_tokens=15,
                        require_json=False
                    )
                    ai_title = ai_title.strip().strip('"')
                    if ai_title:
                        new_title = ai_title
                except Exception as ai_err:
                    print(f"AI title model warning (using fallback): {ai_err}")

                try:
                    supabase.table("sessions").update({"title": new_title}).eq("id", session_id).execute()
                except Exception as db_title_err:
                    print(f"Title update failed: {db_title_err}")

            try:
                supabase.table("messages").insert([
                    {"session_id": session_id, "role": "user", "content": latest_user_text},
                    {"session_id": session_id, "role": "assistant", "content": response_obj.reply}
                ]).execute()

                if response_obj.plan:
                    supabase.table("course_plans").upsert({
                        "session_id": session_id,
                        "plan_data": final_plan
                    }, on_conflict="session_id").execute()
            except Exception as db_err:
                print(f"DATABASE ERROR: {str(db_err)}")

        return response_obj

    except Exception as e:
        print(f"Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"AI processing failed: {str(e)}")

# --- SESSION ENDPOINTS ---

@app.get("/api/sessions")
def list_sessions(x_user_id: str = Header(None)):
    try:
        # Only fetch sessions that match the browser's unique user_id
        query = supabase.table("sessions").select("*")
        if x_user_id:
            query = query.eq("user_id", x_user_id)
            
        res = query.order("created_at", desc=True).limit(20).execute()
        return {"sessions": res.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/sessions")
def create_session(x_user_id: str = Header(None)):
    try:
        session_id = str(uuid.uuid4())
        insert_data = {"id": session_id}
        
        # Attach the browser's user_id to the new session
        if x_user_id:
            insert_data["user_id"] = x_user_id
            
        supabase.table("sessions").insert(insert_data).execute()
        return {"session_id": session_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/sessions/{session_id}")
def get_session_data(session_id: str):
    try:
        messages_res = supabase.table("messages").select("*").eq("session_id", session_id).order("created_at").execute()
        plan_res = supabase.table("course_plans").select("*").eq("session_id", session_id).execute()
        return {
            "messages": messages_res.data,
            "plan": plan_res.data[0]["plan_data"] if plan_res.data else None
        }
    except Exception as e:
        raise HTTPException(status_code=404, detail="Session not found")

@app.put("/api/sessions/{session_id}/plan")
async def update_plan_manual(session_id: str, plan_data: dict = Body(...)):
    try:
        supabase.table("course_plans").upsert({
            "session_id": session_id,
            "plan_data": plan_data
        }, on_conflict="session_id").execute()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/sessions/{session_id}")
def delete_session(session_id: str):
    try:
        supabase.table("sessions").delete().eq("id", session_id).execute()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))