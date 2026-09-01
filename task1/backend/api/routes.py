from pydantic import BaseModel
from fastapi.responses import StreamingResponse
from backend.services.llm import generate_chat_response
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
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
    MAX_FILE_SIZE = 5 * 1024 * 1024 # 5MB in bytes
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File is too large. Maximum allowed size is 5MB.")
    try:
        file_path = f"{file.filename}"
        download_url = None
        
        # --- FIX: Gracefully catch HTTP/2 stream resets or storage connection errors ---
        try:
            supabase.storage.from_("documents").upload(
                file=file_bytes, 
                path=file_path, 
                file_options={"content-type": file.content_type, "upsert": "true"}
            )
            download_url = supabase.storage.from_("documents").get_public_url(file_path)
        except Exception as storage_err:
            print(f"Supabase storage warning: {storage_err}. Continuing with local vector ingestion...")

        file_ext = file.filename.split(".")[-1].lower()

        # 3. Process Vector Embeddings
        if file_ext == "pdf":
            docs = parse_pdf(file_bytes)
            result = process_and_store("pdf", file.filename, docs, download_url)
        elif file_ext in ["ppt", "pptx"]:
            if file_ext == "ppt":
                # Cleanly reject binary .ppt files to protect server RAM
                raise HTTPException(
                    status_code=400, 
                    detail="Legacy .ppt files are not supported. Please open the file in PowerPoint and 'Save As' a modern .pptx file."
                )
            docs = parse_pptx(file_bytes)
            
            if not docs:
                raise HTTPException(
                    status_code=400, 
                    detail="No text could be extracted. Make sure the slides contain actual text, not just images."
                )
                
            result = process_and_store("pptx", file.filename, docs, download_url)
            
            if not result.get("summary") or str(result.get("summary")).strip() == "":
                result["summary"] = "Presentation processed successfully."
        
        return {"status": "success", "data": result}

    # --- FIX: Prevent 400 errors from turning into 500 errors ---
    except HTTPException:
        raise  
    except Exception as e:
        print(f"\n--- UPLOAD ERROR ---")
        traceback.print_exc()
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
    except HTTPException:
        raise  
        
    # --- Catch unexpected crashes and turn them into 500 errors ---
    except Exception as e:
        print(f"\n--- UPLOAD ERROR ---")
        traceback.print_exc() 
        print(f"--------------------\n")
        raise HTTPException(status_code=500, detail=str(e))

class ChatRequest(BaseModel):
    query: str
    session_history: list = []
    active_sources: list = []

@router.post("/chat/context")
async def get_chat_context(req: ChatRequest):
    try:
        from backend.services.vectorstore import search_similar_chunks
        
        # 1. Try semantic vector search first
        chunks = search_similar_chunks(req.query, match_threshold=0.0, match_count=10, active_sources=req.active_sources)
        
        # 2. Fallback: If specific active sources are selected, grab their chunks directly to guarantee coverage
        if not chunks and req.active_sources:
            doc_res = supabase.table("documents").select("id").in_("source_path", req.active_sources).execute()
            doc_ids = [d["id"] for d in doc_res.data] if doc_res.data else []
            
            if doc_ids:
                chunk_res = supabase.table("document_chunks").select("content, metadata").in_("document_id", doc_ids).limit(15).execute()
                chunks = chunk_res.data or []

        if not chunks:
            context_text = "No relevant documents found."
        else:
            # Sync the metadata formatting logic here too
            formatted_chunks = []
            for c in chunks:
                meta = c.get('metadata', {})
                source_name = meta.get('source_name', 'Unknown')
                
                location = ""
                if 'page' in meta:
                    location = f", Page {meta['page']}"
                elif 'slide' in meta:
                    location = f", Slide {meta['slide']}"
                elif 'timestamp' in meta:
                    ts = int(meta['timestamp'])
                    mins, secs = divmod(ts, 60)
                    hours, mins = divmod(mins, 60)
                    if hours > 0:
                        location = f", Timestamp {hours}:{mins:02d}:{secs:02d}"
                    else:
                        location = f", Timestamp {mins}:{secs:02d}"
                
                formatted_chunks.append(f"[Source: {source_name}{location}]\n{c['content']}")
                
            context_text = "\n\n".join(formatted_chunks)
            
        return {"status": "success", "context": context_text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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

class SourcesSyncRequest(BaseModel):
    source_ids: list = []

@router.post("/documents/summaries")
async def get_document_summaries(req: SourcesSyncRequest):
    try:
        if not req.source_ids:
            return {"status": "success", "data": []}
            
        response = supabase.table("documents")\
            .select("id, source_path, summary, download_url")\
            .in_("id", req.source_ids)\
            .execute()
            
        return {"status": "success", "data": response.data or []}
    except Exception as e:
        print(f"Error fetching summaries: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- NEW: Add this class above the generate_quiz endpoint ---
class QuizRequest(BaseModel):
    existing_questions: list = []
    active_sources: list = []

# --- UPDATED: Changed to POST and added the request model ---
@router.post("/quiz")
async def generate_quiz(req: QuizRequest):
    try:
        if not req.active_sources:
            raise HTTPException(status_code=400, detail="No active sources available to generate a quiz.")
        response = supabase.table("documents").select("summary, source_path").in_("id", req.active_sources).execute()
        if not response.data:
            raise HTTPException(status_code=400, detail="Could not retrieve the document summaries.")
                
        combined_summaries = "\n\n".join([f"--- Source: {doc['source_path']} ---\n{doc['summary']}" for doc in response.data])
        
        groq_client = Groq(api_key=GROQ_API_KEY)
            
        # --- NEW: Prevent duplicate questions ---
        exclusion_text = ""
        if req.existing_questions:
            exclusion_text = (
                f"\nDO NOT generate any questions similar to these existing ones:\n"
                + "\n".join(f"- {q}" for q in req.existing_questions) +
                "\nIf there is not enough NEW information in the summaries to create 3 completely unique questions, you MUST return an empty array like this: {{ \"quiz\": [] }}.\n"
            )

        # --- UPDATED: Prompt includes exclusion text ---
        prompt = (
            f"Based on the following document summaries:\n{combined_summaries}\n\n"
            "Generate exactly 3 multiple choice questions.\n"
            "You MUST base the questions and answers STRICTLY on the summaries provided. DO NOT invent facts.\n"
            f"{exclusion_text}"
            "You MUST return ONLY a valid JSON object. Do not output any other text.\n"
            "You MUST escape any internal quote marks. Follow this EXACT structure:\n"
            "{\n"
            '  "quiz": [\n'
            "    {\n"
            '      "question": "What is the capital of France?",\n'
            '      "options": ["London", "Berlin", "Paris", "Madrid"],\n'
            '      "answer": "Paris",\n'
            '      "explanation": "Paris is the capital of France.",\n'
            '      "citation": "**[Source: filename.pdf]**" <-- You MUST put the correct Source Name here based on the dividers above.\n'
            "    }\n"
            "  ]\n"
            "}"
        )
            
        completion = groq_client.chat.completions.create(
            model="qwen/qwen3.6-27b",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0,
            max_tokens=4000
        )
            
        raw_text = completion.choices[0].message.content
        raw_text = re.sub(r'<think>.*?</think>', '', raw_text, flags=re.DOTALL)
        raw_text = raw_text.replace("```json", "").replace("```", "").strip()
            
        start_idx = raw_text.find('{')
        end_idx = raw_text.rfind('}') + 1
            
        if start_idx != -1 and end_idx != 0:
            clean_text = raw_text[start_idx:end_idx]
        else:
            clean_text = raw_text
                
        quiz_data = json.loads(clean_text)
        
        # --- NEW: Catch empty arrays if the AI runs out of facts ---
        if len(quiz_data.get("quiz", [])) == 0:
            raise HTTPException(status_code=400, detail="Not enough information left in the sources to generate more unique questions.")
            
        return {"status": "success", "data": quiz_data["quiz"]}
            
    except HTTPException:
        raise
    except Exception as e:
        print("\n--- QUIZ ERROR ---")
        print(f"Failed to parse this AI output:\n{raw_text if 'raw_text' in locals() else 'None'}")
        traceback.print_exc()
        print("------------------\n")
        raise HTTPException(status_code=500, detail=str(e))