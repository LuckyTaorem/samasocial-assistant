from pydantic import BaseModel
from fastapi.responses import StreamingResponse
from backend.services.llm import generate_chat_response
from fastapi import APIRouter, UploadFile, Form, HTTPException
from backend.services.parsers import parse_pdf, parse_pptx, parse_youtube, parse_webpage
from backend.services.ingestion import process_and_store
import traceback
from backend.core.config import supabase, GROQ_API_KEY
from groq import Groq
import json
import re

router = APIRouter()

class TitleRequest(BaseModel):
    message: str

@router.post("/chat/title")
async def generate_chat_title(req: TitleRequest):
    try:
        groq_client = Groq(api_key=GROQ_API_KEY)
        prompt = f"Generate a short, 3 to 4 word title for a chat conversation that begins with this message: '{req.message}'. Return ONLY the title text. Do not use quotes, prefixes, or punctuation."
        
        completion = groq_client.chat.completions.create(
            model="qwen/qwen3.6-27b",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3
        )
        
        title = completion.choices[0].message.content.strip(' "').strip()
        # Erase thinking tags just in case
        title = re.sub(r'<think>.*?</think>', '', title, flags=re.DOTALL).strip()
        
        return {"status": "success", "title": title}
    except Exception:
        return {"status": "success", "title": req.message[:20] + "..."}

@router.post("/upload/file")
async def upload_file(file: UploadFile):
    file_bytes = await file.read()
    try:
        # 1. Upload Original File to Supabase Storage
        file_path = f"{file.filename}"
        supabase.storage.from_("documents").upload(
            file=file_bytes, 
            path=file_path, 
            file_options={"content-type": file.content_type, "upsert": "true"}
        )
        
        # 2. Retrieve the Public Download URL
        download_url = supabase.storage.from_("documents").get_public_url(file_path)

        # 3. Process Vector Embeddings
        if file.filename.lower().endswith(".pdf"):
            docs = parse_pdf(file_bytes)
            # You can now modify process_and_store to save this download_url to your database!
            result = process_and_store("pdf", file.filename, docs, download_url)
        elif file.filename.lower().endswith(".pptx"):
            docs = parse_pptx(file_bytes)
            result = process_and_store("pptx", file.filename, docs, download_url)
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type")
        
        return {"status": "success", "data": result}
    except Exception as e:
        print(f"\n--- UPLOAD ERROR ---")
        traceback.print_exc() # This prints the exact error to your terminal
        print(f"--------------------\n")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/upload/link")
async def upload_link(url: str = Form(...)):
    try:
        if "youtube.com" in url or "youtu.be" in url:
            docs = parse_youtube(url)
            result = process_and_store("youtube", url, docs, url)
        else:
            docs = parse_webpage(url)
            result = process_and_store("webpage", url, docs, url)
            
        return {"status": "success", "data": result}
    except Exception as e:
        print(f"\n--- LINK UPLOAD ERROR ---")
        traceback.print_exc()
        print(f"-------------------------\n")
        raise HTTPException(status_code=500, detail=str(e))

class ChatRequest(BaseModel):
    query: str
    session_history: list = []
    active_sources: list = []

@router.post("/chat")
async def chat_endpoint(req: ChatRequest):
    try:
        stream_gen = generate_chat_response(req.query, req.session_history, req.active_sources)
        return StreamingResponse(stream_gen, media_type="text/event-stream")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str):
    try:
        # 'on delete cascade' in your DB ensures all chunks are deleted too
        supabase.table("documents").delete().eq("id", doc_id).execute()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/quiz")
async def generate_quiz():
    try:
        response = supabase.table("documents").select("summary").order("created_at", desc=True).limit(1).execute()
        if not response.data:
            raise HTTPException(status_code=400, detail="No documents uploaded yet.")
                
        summary = response.data[0]["summary"]
        groq_client = Groq(api_key=GROQ_API_KEY)
            
        # --- NEW: 1-Shot Template Prompt ---
        prompt = (
            f"Based on this summary: '{summary}', generate exactly 3 multiple choice questions.\n"
            "You MUST base the questions and answers STRICTLY on the summary provided. DO NOT invent facts or use outside knowledge.\n"
            "You MUST return ONLY a valid JSON object. Do not output any other text, markdown, or explanations.\n"
            "You MUST escape any internal quote marks. Follow this EXACT structure:\n"
            "{\n"
            '  "quiz": [\n'
            "    {\n"
            '      "question": "What is the capital of France?",\n'
            '      "options": ["London", "Berlin", "Paris", "Madrid"],\n'
            '      "answer": "Paris",\n'
            '      "explanation": "Paris is the capital of France.",\n'
            '      "citation": "**[Source: Document Summary]**"\n' # <-- NEW
            "    }\n"
            "  ]\n"
            "}"
        )
            
        completion = groq_client.chat.completions.create(
            model="qwen/qwen3.6-27b",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0,
            max_tokens=2000
        )
            
        raw_text = completion.choices[0].message.content
            
        # --- NEW: Erase the model's internal monologue completely ---
        raw_text = re.sub(r'<think>.*?</think>', '', raw_text, flags=re.DOTALL)
            
        # Clean markdown if the AI adds it
        raw_text = raw_text.replace("```json", "").replace("```", "").strip()
            
        # Robust slicing
        start_idx = raw_text.find('{')
        end_idx = raw_text.rfind('}') + 1
            
        if start_idx != -1 and end_idx != 0:
            clean_text = raw_text[start_idx:end_idx]
        else:
            clean_text = raw_text
                
        quiz_data = json.loads(clean_text)
            
        return {"status": "success", "data": quiz_data["quiz"]}
            
    except Exception as e:
        print("\n--- QUIZ ERROR ---")
        # --- NEW: Print exactly what the AI outputted so we can see the typo ---
        print(f"Failed to parse this AI output:\n{raw_text if 'raw_text' in locals() else 'None'}")
        traceback.print_exc()
        print("------------------\n")
        raise HTTPException(status_code=500, detail=str(e))