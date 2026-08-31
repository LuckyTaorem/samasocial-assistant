from pydantic import BaseModel
from fastapi.responses import StreamingResponse
from backend.services.llm import generate_chat_response
from fastapi import APIRouter, UploadFile, Form, HTTPException
from backend.services.parsers import parse_pdf, parse_pptx, parse_youtube, parse_webpage
from backend.services.ingestion import process_and_store

router = APIRouter()

@router.post("/upload/file")
async def upload_file(file: UploadFile):
    file_bytes = await file.read()
    try:
        if file.filename.endswith(".pdf"):
            docs = parse_pdf(file_bytes)
            result = process_and_store("pdf", file.filename, docs)
        elif file.filename.endswith(".pptx"):
            docs = parse_pptx(file_bytes)
            result = process_and_store("pptx", file.filename, docs)
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type")
        
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/upload/link")
async def upload_link(url: str = Form(...)):
    try:
        if "youtube.com" in url or "youtu.be" in url:
            docs = parse_youtube(url)
            result = process_and_store("youtube", url, docs)
        else:
            docs = parse_webpage(url)
            result = process_and_store("webpage", url, docs)
            
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ChatRequest(BaseModel):
    query: str
    session_history: list = [] # List of {"role": "user"|"assistant", "content": "..."}

@router.post("/chat")
async def chat_endpoint(request: ChatRequest):
    try:
        stream_gen = generate_chat_response(request.query, request.session_history)
        # Return as Server-Sent Events (SSE) / stream
        return StreamingResponse(stream_gen, media_type="text/event-stream")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))