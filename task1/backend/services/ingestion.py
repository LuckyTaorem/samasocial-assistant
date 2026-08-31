import time
import re
from backend.core.config import supabase, embedding_model, GROQ_API_KEY
from backend.services.chunking import chunk_documents
from groq import Groq

groq_client = Groq(api_key=GROQ_API_KEY)

def generate_summary(text_content: str) -> str:
    prompt = (
        "Summarize the following content in exactly 2 concise sentences. "
        "You MUST base your summary STRICTLY on the provided text. DO NOT include outside knowledge, assumptions, or external technology stacks.\n"
        "You MUST use markdown formatting (like **bolding** key terms) to make it easy to read:\n\n"
        f"{text_content[:3000]}"
    )
    
    try:
        response = groq_client.chat.completions.create(
            # --- SWITCHED: Use a standard non-reasoning model ---
            model="openai/gpt-oss-20b", 
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=1000 
        )
        
        clean_text = response.choices[0].message.content.strip()
        
        if not clean_text:
            return "Summary generation was successful, but the AI returned an empty response."
            
        return clean_text
        
    except Exception as e:
        print(f"Summary generation error: {e}")
        return "Failed to generate summary due to an API error."

def process_and_store(source_type: str, source_path: str, parsed_docs: list, download_url: str = None):
    if not parsed_docs:
        raise ValueError("No text could be extracted from the source.")

    # 1. Generate Summary
    full_text = "\n".join([doc["text"] for doc in parsed_docs])
    summary = generate_summary(full_text)

    # 2. Store Document Metadata
    doc_response = supabase.table("documents").insert({
        "source_type": source_type,
        "source_path": source_path,
        "summary": summary,
        "download_url": download_url
    }).execute()
    
    document_id = doc_response.data[0]['id']

    # 3. Chunk and Embed
    chunks = chunk_documents(parsed_docs)
        
    contents = [c["content"] for c in chunks]
    embeddings = embedding_model.encode(contents).tolist()

    # 4. Store Chunks safely (Replaces the batching loop)
    successful_inserts = 0
    for i, chunk in enumerate(chunks):
        # PostgreSQL will crash and drop connections if it sees a null byte
        clean_text = chunk["content"].replace("\x00", "")
        chunk["metadata"]["source_name"] = source_path
        
        record = {
            "document_id": document_id,
            "content": clean_text,
            "metadata": chunk["metadata"],
            "embedding": embeddings[i]
        }
        
        try:
            # Insert one-by-one to completely bypass payload size limits
            supabase.table("document_chunks").insert(record).execute()
            successful_inserts += 1
        except Exception as e:
            print(f"Skipped chunk {i} due to database error: {e}")
            # If the server disconnects or times out, keep what we have and move on
            if "disconnected" in str(e).lower() or "timeout" in str(e).lower():
                print("Server disconnect detected, saving current progress and stopping.")
                break
                
    return {
        "document_id": document_id, 
        "summary": summary, 
        "download_url": download_url, 
        "chunks_processed": successful_inserts
    }