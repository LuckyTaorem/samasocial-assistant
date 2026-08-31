from backend.core.config import supabase, embedding_model

def search_similar_chunks(query: str, match_threshold: float = 0.4, match_count: int = 5):
    # 1. Create an embedding for the user's question
    query_embedding = embedding_model.encode(query).tolist()
    
    # 2. Call the Supabase vector search function
    response = supabase.rpc(
        'match_document_chunks',
        {
            'query_embedding': query_embedding,
            'match_threshold': match_threshold,
            'match_count': match_count
        }
    ).execute()
    
    return response.data