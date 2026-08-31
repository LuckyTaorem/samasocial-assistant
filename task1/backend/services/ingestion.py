from backend.core.config import supabase, embedding_model, GROQ_API_KEY
from backend.services.chunking import chunk_documents
from groq import Groq

groq_client = Groq(api_key=GROQ_API_KEY)

def generate_summary(text_content: str) -> str:
    # Use first 3000 chars to save tokens on summary generation
    prompt = f"Summarize the following content in 2 concise sentences:\n\n{text_content[:3000]}"
    response = groq_client.chat.completions.create(
        model="qwen/qwen3.6-27b", # Using your active model
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        max_tokens=150
    )
    return response.choices[0].message.content

def process_and_store(source_type: str, source_path: str, parsed_docs: list):
    if not parsed_docs:
        raise ValueError("No text could be extracted from the source.")

    # 1. Generate Summary
    full_text = "\n".join([doc["text"] for doc in parsed_docs])
    summary = generate_summary(full_text)

    # 2. Store Document Metadata
    doc_response = supabase.table("documents").insert({
        "source_type": source_type,
        "source_path": source_path,
        "summary": summary
    }).execute()
    
    document_id = doc_response.data[0]['id']

    # 3. Chunk and Embed
    chunks = chunk_documents(parsed_docs)
    contents = [c["content"] for c in chunks]
    embeddings = embedding_model.encode(contents).tolist()

    # 4. Store Chunks in Supabase
    chunk_records = []
    for i, chunk in enumerate(chunks):
        chunk_records.append({
            "document_id": document_id,
            "content": chunk["content"],
            "metadata": chunk["metadata"],
            "embedding": embeddings[i]
        })
        
    # Batch insert chunks
    supabase.table("document_chunks").insert(chunk_records).execute()
    
    return {"document_id": document_id, "summary": summary, "chunks_processed": len(chunks)}