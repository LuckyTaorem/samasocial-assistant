import json
from groq import AsyncGroq
from backend.core.config import GROQ_API_KEY
from backend.services.vectorstore import search_similar_chunks

client = AsyncGroq(api_key=GROQ_API_KEY)
MODEL_NAME = "openai/gpt-oss-20b"

async def generate_chat_response(query: str, session_history: list, active_sources: list):
    chunks = search_similar_chunks(query, match_threshold=0.0)
    
    if not chunks:
        context_text = "No relevant documents found."
    else:
        context_text = "\n\n".join([
            f"[Source Name: {c['metadata'].get('source_name', 'Unknown')}]\n{c['content']}" 
            for c in chunks
        ])

    sources_str = ", ".join(active_sources) if active_sources else "None"

    # 2. Build the grounded prompt
    system_prompt = (
        "You are a helpful AI learning assistant. "
        f"The user has currently uploaded the following active files/sources in their workspace: {sources_str}.\n\n"
        "INSTRUCTIONS:\n"
        "1. If the user asks what sources, files, or documents are available or uploaded, directly list the active files mentioned above.\n"
        "2. For all other questions, answer using ONLY the provided CONTEXT below.\n"
        "3. If the answer cannot be found in the context or the active files list, you MUST politely decline by replying exactly with: 'I'm sorry, but that is out of scope of the provided material.'\n"
        "4. When you provide an answer based on the CONTEXT, you MUST make your citations highly visible. Append the source name at the end of the sentence like this: **[Source: filename.pdf]**.\n\n"
        f"CONTEXT:\n{context_text}"
    )
    
    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(session_history)
    messages.append({"role": "user", "content": query})

    # 3. Create a generator to stream the response
    stream = await client.chat.completions.create(
        model=MODEL_NAME,
        messages=messages,
        stream=True,
        temperature=0.3,
        max_tokens=1024
    )
        
    # Yield tokens instantly as they arrive
    async for chunk in stream:
        content = chunk.choices[0].delta.content
        if content is not None:
            yield content