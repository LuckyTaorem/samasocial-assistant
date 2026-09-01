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
        
        # Strictly isolate chunks to ONLY the documents active in this chat session
        if active_sources:
            doc_res = supabase.table("documents").select("id, source_path").in_("source_path", active_sources).execute()
            allowed_doc_ids = {str(d["id"]) for d in (doc_res.data or [])}
            
            chunks = [
                c for c in chunks 
                if str(c.get("document_id")) in allowed_doc_ids or c.get("metadata", {}).get("source_name") in active_sources
            ]
            
        return chunks[:match_count]
        
    except Exception as e:
        print(f"Warning: Vector search failed: {e}")
        return []