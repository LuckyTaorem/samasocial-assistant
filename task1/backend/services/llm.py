import json
from groq import Groq
from backend.core.config import GROQ_API_KEY
from backend.services.vectorstore import search_similar_chunks

client = Groq(api_key=GROQ_API_KEY)
MODEL_NAME = "openai/gpt-oss-20b" # Recommended replacement for standard queries

def generate_chat_response(query: str, session_history: list):
    # 1. Retrieve relevant context
    chunks = search_similar_chunks(query)
    
    if not chunks:
        context_text = "No relevant documents found."
    else:
        # Format chunks with their metadata so the LLM can cite them
        context_text = "\n\n".join([
            f"[Source: {json.dumps(c['metadata'])}]:\n{c['content']}" 
            for c in chunks
        ])

    # 2. Build the grounded prompt
    system_prompt = (
        "You are a helpful AI learning assistant. Answer the user's question using ONLY the context provided below. "
        "If the answer is not contained in the context, politely decline and state that it is out of scope. "
        "When answering, explicitly cite the source using the provided metadata (e.g., 'According to slide 4' or 'At timestamp 120s').\n\n"
        f"CONTEXT:\n{context_text}"
    )
    
    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(session_history)
    messages.append({"role": "user", "content": query})

    # 3. Create a generator to stream the response
    def stream_generator():
        stream = client.chat.completions.create(
            model=MODEL_NAME,
            messages=messages,
            stream=True,
            temperature=0.3,
            max_tokens=1024
        )
        
        for chunk in stream:
            content = chunk.choices[0].delta.content
            if content is not None:
                yield content

    return stream_generator()