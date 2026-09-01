def chunk_documents(parsed_docs, chunk_size=800, overlap=150):
    chunks = []
    for doc in parsed_docs:
        text = doc["text"]
        metadata = doc["metadata"]
        
        start = 0
        while start < len(text):
            end = start + chunk_size
            chunk_text = text[start:end]
            
            # --- FIX: Lowered threshold from 20 to 3 ---
            # This ensures short slide titles like "Image Section" are saved to the database
            if len(chunk_text.strip()) > 3: 
                chunks.append({
                    "content": chunk_text.strip(),
                    "metadata": metadata
                })
            start += (chunk_size - overlap)
    return chunks