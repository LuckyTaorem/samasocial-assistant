import io
import requests
import pdfplumber
from pptx import Presentation
from youtube_transcript_api import YouTubeTranscriptApi
from bs4 import BeautifulSoup
from urllib.parse import urlparse, parse_qs

def parse_pdf(file_bytes: bytes):
    docs = []
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for i, page in enumerate(pdf.pages):
            text = page.extract_text()
            if text:
                docs.append({"text": text, "metadata": {"page": i + 1}})
    return docs

def parse_pptx(file_bytes: bytes):
    docs = []
    prs = Presentation(io.BytesIO(file_bytes))
    for i, slide in enumerate(prs.slides):
        text_blocks = [shape.text for shape in slide.shapes if hasattr(shape, "text")]
        text = "\n".join(text_blocks).strip()
        if text:
            docs.append({"text": text, "metadata": {"slide": i + 1}})
    return docs

def parse_youtube(url: str):
    query = urlparse(url)
    video_id = query.path[1:] if query.hostname == 'youtu.be' else parse_qs(query.query).get('v', [None])[0]
    
    if not video_id:
        raise ValueError("Invalid YouTube URL")
        
    ytt_api = YouTubeTranscriptApi()
    transcript = ytt_api.fetch(video_id)
    
    docs = []
    current_text = ""
    current_timestamp = 0
    
    # Group raw caption lines into larger 800-character blocks
    for entry in transcript:
        if not current_text:
            current_timestamp = round(entry.start)
        current_text += " " + entry.text
        
        if len(current_text) > 800:
            docs.append({
                "text": current_text.strip(),
                "metadata": {"timestamp": current_timestamp}
            })
            current_text = ""
            
    if current_text.strip():
        docs.append({
            "text": current_text.strip(),
            "metadata": {"timestamp": current_timestamp}
        })
        
    return docs

def parse_webpage(url: str):
    response = requests.get(url, headers={"User-Agent": "Mozilla/5.0"})
    soup = BeautifulSoup(response.text, 'html.parser')
    
    for script in soup(["script", "style", "nav", "footer"]):
        script.extract()
        
    text = soup.get_text(separator='\n', strip=True)
    
    return [{"text": text, "metadata": {"source_name": url}}]