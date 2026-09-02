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
SYSTEM_PROMPT = """You are an expert instructional designer and a universal AI course-planning mentor. Your goal is to guide the user through a structured curriculum-building process. Output ONLY valid JSON.

WORKFLOW STAGES & SCENARIOS:

SCENARIO 0: INTAKE STAGE (Gathering Information)
- If the user has NOT provided enough context (Subject, Target Audience, Duration, and Learning Goals), ask 1-2 conversational questions to gather these details.
- Output this exact format:
{
  "reply": "Your conversational question to the mentor here...",
  "full_plan": null,
  "modifications": null
}

SCENARIO 1: FIRST GENERATION (Creating the initial plan)
- Once you have enough info from the intake conversation (or if the user uploaded a syllabus PDF), generate the comprehensive course plan.
- Output this exact format:
{
  "reply": "Here is your course...",
  "full_plan": { "subject": "...", "duration": "...", "targetAudience": "...", "modules": [ array of complete modules ] },
  "modifications": null
}

SCENARIO 2: MODIFYING EXISTING PLAN (Current Plan state is provided)
- REFINEMENT & EXTENSION RULES (CRITICAL): When the user asks to add more modules, expand, or modify the course, you MUST retain the existing structure. Append new modules sequentially (e.g., if the current plan has 2 modules, new modules start at M3). Do not overwrite previous work unless told to.
- Output this exact format:
{
  "reply": "I have updated the modules as requested...",
  "full_plan": null,
  "modifications": {
    "added_or_edited_modules": [ array of new or updated modules ],
    "deleted_module_ids": [ array of module IDs to remove, if any ]
  }
}

STRICT SEPARATION RULES FOR URLS:
1. `resources`: Must be documentation, guides, official textbooks, or explanatory articles.
2. `practiceExercises`: MUST BE 100% INTERACTIVE AND ACTIONABLE. Never assign a static blog post, tutorial article, or reading page to `practiceExercises`. It must point strictly to active problem-solving platforms, coding sandboxes, mock test portals, or interactive quiz hubs (e.g., LeetCode, HackerRank, Kaggle, Khan Academy practice, or official exam question banks).

SCHEMA FOR A MODULE: 
{ 
  "id": "M1", 
  "title": "...", 
  "learningObjectives": ["..."], 
  "prerequisites": ["..."], 
  "lessons": [ 
    { 
      "id": "L1", 
      "title": "...", 
      "topics": ["..."], 
      "difficulty": "Beginner | Intermediate | Advanced", 
      "resources": [{"title":"", "type":"Official Documentation", "url":"[Article/Guide URL]"}], 
      "practiceExercises": [{"title":"", "type":"Interactive Problem Set", "url":"[Active Coding/Testing Platform URL]"}], 
      "assessment": "..." 
    } 
  ], 
  "assessment": "..." 
}
"""

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
    last_error = None
    for model in FALLBACK_CHAIN:
        try:
            kwargs = {
                "model": model,
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": 0.3,
            }
            # Only enforce strict JSON mode for providers that natively support it
            if require_json and ("groq" in model or "openai" in model):
                kwargs["response_format"] = {"type": "json_object"}
                
            response = completion(**kwargs)
            raw_content = response.choices[0].message.content
            
            # If JSON is required, clean it and test it INSIDE the try-block
            if require_json:
                # Clean Markdown wrappers from the string
                text = raw_content.strip()
                if text.startswith("```"):
                    text = text.split("\n", 1)[-1]
                if text.endswith("```"):
                    text = text[:-3]
                text = text.strip()
                
                # This will raise a JSONDecodeError if the model truncated the output
                return json.loads(text)
            
            return raw_content.strip()
            
        except Exception as e:
            print(f"Fallback triggered: {model} failed. Error: {e}")
            last_error = e
            continue
            
    raise Exception(f"All AI models in the fallback chain failed or returned invalid JSON. Last error: {last_error}")

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

        chat_history = [{"role": "system", "content": SYSTEM_PROMPT}]

        # Extract user text for context search
        latest_user_text = parsed_messages[-1]["content"] if parsed_messages else ""
        course_subject = parsed_plan.get("subject", "") if parsed_plan else latest_user_text
    
        # --- DYNAMIC LESSON-AWARE TAVILY SEARCH ---
        verified_links_context = ""
        try:
            course_subject = parsed_plan.get("subject", "") if parsed_plan else latest_user_text
            
            # Extract specific lesson titles from the current plan to build a targeted search query
            lesson_queries = []
            if parsed_plan:
                for mod in parsed_plan.get("modules", []):
                    for lesson in mod.get("lessons", []):
                        if lesson.get("title"):
                            lesson_queries.append(lesson.get("title"))
            
            # Combine subject with specific lesson keywords for high precision
            specific_topics = " ".join(lesson_queries[:5]) # Take key lesson titles
            # Broaden search query to specifically hunt for practice exercises and test hubs
            search_query = f"{course_subject} {specific_topics} interactive coding challenges problem sets mock tests online practice platform"
            
            search_res = tavily_client.search(
                query=search_query,
                max_results=15,
                search_depth="basic"
            )
            results = search_res.get("results", [])
            if results:
                verified_links_context = "\n\nVERIFIED WEB SEARCH RESULTS (STRICT LESSON-TO-URL MAPPING):\n"
                verified_links_context += "You have a pool of targeted links below. You MUST read the title of each search result and map it to the most contextually relevant lesson title. Never assign the same URL to multiple lessons.\n"
                for idx, r in enumerate(results):
                    verified_links_context += f"[{idx+1}] Source Title: {r.get('title')}\n    URL: {r.get('url')}\n"
        except Exception as tavily_err:
            print(f"Tavily search warning: {tavily_err}")
        # ------------------------------------------

        if file:
            contents = await file.read()
            reader = PdfReader(io.BytesIO(contents))
            extracted_text = "".join([page.extract_text() or "" for page in reader.pages])
            chat_history.append({
                "role": "user",
                # Compress the PDF extraction and enforce a hard limit on generation size
                "content": f"[PDF Syllabus]:\n{extracted_text[:4000]}\n\nGenerate the structured course plan. IMPORTANT: Limit to a maximum of 4 modules with 2-3 lessons each to ensure the response remains concise."
            })

        # Send current state but instruct AI to ONLY send back the pieces that change
        if parsed_plan:
            minified_plan = json.dumps(parsed_plan, separators=(',', ':'))
            chat_history.append({
                "role": "system", 
                "content": f"CURRENT PLAN STATE:\n{minified_plan}\n\nINSTRUCTION: Use SCENARIO 2. Return ONLY the modifications (added_or_edited_modules, deleted_module_ids)."
            })
            
        if parsed_messages:
            chat_history.append({
                "role": "user", 
                "content": f"{latest_user_text}{verified_links_context}"
            })

        
        try:
            # raw_data is ALREADY a parsed dictionary here; do NOT call .strip() on it!
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
            parsed_data = {"reply": str(raw_content), "full_plan": None, "modifications": None}
        
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