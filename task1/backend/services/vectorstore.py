from backend.core.config import supabase, embedding_model

# Change this line in backend/services/vectorstore.py
def search_similar_chunks(query: str, match_threshold: float = 0.0, match_count: int = 5):
    # 1. Create an embedding for the user's question
    query_embedding = embedding_model.encode([query]).tolist()[0]
    
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