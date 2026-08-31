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