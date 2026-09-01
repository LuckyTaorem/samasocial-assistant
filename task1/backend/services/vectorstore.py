from backend.core.config import supabase, embedding_model

def search_similar_chunks(query: str, match_threshold: float = 0.0, match_count: int = 10, active_sources: list = None):
    try:
        # 1. Create an embedding for the user's question
        query_embedding = embedding_model.encode([query]).tolist()[0]
        
        # 2. Call the Supabase vector search function
        response = supabase.rpc(
            'match_document_chunks',
            {
                'query_embedding': query_embedding,
                'match_threshold': match_threshold,
                'match_count': match_count * 4
            }
        ).execute()
        
        chunks = response.data or []

        # 3. If vector search returned nothing or filtering is too strict, grab chunks directly from active sources
        if not chunks and active_sources:
            doc_res = supabase.table("documents").select("id, source_path").in_("source_path", active_sources).execute()
            doc_ids = [d["id"] for d in doc_res.data] if doc_res.data else []
            if doc_ids:
                chunk_res = supabase.table("document_chunks").select("content, metadata, document_id").in_("document_id", doc_ids).limit(15).execute()
                chunks = chunk_res.data or []
        
        # 4. Flexible source isolation filter
        if active_sources and chunks:
            doc_res = supabase.table("documents").select("id, source_path").in_("source_path", active_sources).execute()
            allowed_doc_ids = {str(d["id"]) for d in (doc_res.data or [] )}
            
            filtered_chunks = []
            for c in chunks:
                doc_id = str(c.get("document_id", ""))
                source_name = c.get("metadata", {}).get("source_name", "")
                
                # Match either by document ID, source_name metadata, or if no filter metadata exists (fallback)
                if doc_id in allowed_doc_ids or source_name in active_sources or not source_name:
                    filtered_chunks.append(c)
            
            # If filtering accidentally wiped out everything, keep the raw chunks to prevent out-of-scope errors
            if filtered_chunks:
                chunks = filtered_chunks

        return chunks[:match_count]
        
    except Exception as e:
        print(f"Warning: Vector search failed: {e}")
        return []