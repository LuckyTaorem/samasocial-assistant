import os
import re
from litellm import acompletion
from backend.core.config import supabase, GROQ_API_KEY
from backend.services.vectorstore import search_similar_chunks

try:
    from backend.core.config import GEMINI_API_KEY, OPENROUTER_API_KEY, COHERE_API_KEY
except ImportError:
    GEMINI_API_KEY = OPENROUTER_API_KEY = COHERE_API_KEY = None

# SAFELY inject keys into the environment ONLY if they exist (are not None)
if GROQ_API_KEY:
    os.environ["GROQ_API_KEY"] = GROQ_API_KEY
if GEMINI_API_KEY:
    os.environ["GEMINI_API_KEY"] = GEMINI_API_KEY
if OPENROUTER_API_KEY:
    os.environ["OPENROUTER_API_KEY"] = OPENROUTER_API_KEY
if COHERE_API_KEY:
    os.environ["COHERE_API_KEY"] = COHERE_API_KEY

# Your Custom API Stack Waterfall
FALLBACK_CHAIN = [
    "groq/openai/gpt-oss-120b",
    "gemini/gemini-2.5-flash",
    "openrouter/google/gemma-4-31b-it",
    "cohere/command-a-03-2025",
    "groq/openai/gpt-oss-20b"
]

async def generate_chat_response(query: str, session_history: list, active_sources: list):
    doc_id_to_name = {}
    summaries_text = ""
    
    # 1. FETCH & TRUNCATE SUMMARIES
    if active_sources:
        doc_res = supabase.table("documents").select("id, source_path, summary").in_("source_path", active_sources).execute()
        if doc_res.data:
            sum_list = []
            for d in doc_res.data:
                doc_id_to_name[str(d['id'])] = d['source_path']
                summary_text = d.get('summary', '') or ''
                short_summary = summary_text[:300] + "..." if len(summary_text) > 300 else summary_text
                sum_list.append(f"=== OVERVIEW FOR [{d['source_path']}] ===\n{short_summary}")
            summaries_text = "\n\n".join(sum_list)

    # 2. FETCH VECTOR CHUNKS
    chunks = search_similar_chunks(query, match_threshold=0.0, match_count=5, active_sources=active_sources)

    if not chunks and active_sources:
        doc_res = supabase.table("documents").select("id, source_path").in_("source_path", active_sources).execute()
        doc_ids = [d["id"] for d in doc_res.data] if doc_res.data else []
        if doc_ids:
            chunk_res = supabase.table("document_chunks").select("content, metadata, document_id").in_("document_id", doc_ids).limit(5).execute()
            chunks = chunk_res.data or []
    
    chunk_context = ""
    if chunks:
        formatted_chunks = []
        for c in chunks:
            meta = c.get('metadata', {})
            doc_id = str(c.get('document_id', ''))
            source_name = meta.get('source_name') or meta.get('source') or doc_id_to_name.get(doc_id) or 'Unknown'
            
            location = ""
            if 'slide' in meta and meta['slide'] is not None:
                location = f", Slide {meta['slide']}"
            elif 'page' in meta and meta['page'] is not None:
                location = f", Page {meta['page']}"
            elif 'timestamp' in meta and meta['timestamp'] is not None:
                try:
                    ts = int(float(meta['timestamp']))
                    mins, secs = divmod(ts, 60)
                    hours, mins = divmod(mins, 60)
                    location = f", Timestamp {hours}:{mins:02d}:{secs:02d}" if hours > 0 else f", Timestamp {mins}:{secs:02d}"
                    
                    if "youtu" in source_name:
                        if "youtu.be" in source_name:
                            base_url = source_name.split('?')[0]
                            source_name = f"{base_url}?t={ts}"
                        elif "youtube.com/watch" in source_name:
                            match = re.search(r'v=([a-zA-Z0-9_-]+)', source_name)
                            if match:
                                source_name = f"https://www.youtube.com/watch?v={match.group(1)}&t={ts}s"
                except ValueError:
                    location = f", Timestamp {meta['timestamp']}"
            
            formatted_chunks.append(f"[Source: {source_name}{location}]\n{c['content']}")
            
        chunk_context = "\n\n".join(formatted_chunks)

    # 3. APPLY HARD TOKEN LIMITS
    context_text = f"{summaries_text}\n\n{chunk_context}".strip()
    if not context_text:
        context_text = "No relevant documents found."
        
    MAX_CHARS = 12000
    if len(context_text) > MAX_CHARS:
        context_text = context_text[:MAX_CHARS] + "\n\n...[Context truncated due to size limits]"

    sources_str = ", ".join(active_sources) if active_sources else "None"

    system_prompt = (
        "You are a helpful AI learning assistant. "
        f"The user has currently uploaded the following active files/sources in their workspace: {sources_str}.\n\n"
        "INSTRUCTIONS:\n"
        "1. If the user asks what sources, files, or documents are available, directly list the active files.\n"
        "2. If the user asks for a general overview, use the provided OVERVIEW sections.\n"
        "3. For specific questions, answer using ONLY the detailed context chunks provided below.\n"
        "4. If the answer cannot be found in the context or summaries, you MUST politely decline by saying it is out of scope.\n"
        "5. MANDATORY CITATION: You MUST include the exact source and location in brackets at the end of every factual sentence based on context. "
        "If the source is a web URL, format it as a clickable Markdown link (e.g., **[Source: [YouTube Video](https://youtu.be/abc?t=156), Timestamp 2:36]**). "
        "If it is a file, cite it normally (e.g., **[Source: filename.pdf, Page 2]**).\n\n"
        f"CONTEXT:\n{context_text}"
    )
    
    recent_history = session_history[-4:] if len(session_history) > 4 else session_history
    
    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(recent_history)
    messages.append({"role": "user", "content": query})

    # --- 4. THE API WATERFALL FALLBACK LOOP ---
    for model_name in FALLBACK_CHAIN:
        try:
            print(f"Attempting to generate response with {model_name}...")
            
            stream = await acompletion(
                model=model_name,
                messages=messages,
                stream=True,
                temperature=0.3,
                max_tokens=1024
            )
            
            # If the connection succeeds, stream the chunks and yield them back to the frontend
            async for chunk in stream:
                # LiteLLM standardizes all outputs to match OpenAI's syntax
                content = chunk.choices[0].delta.content
                if content is not None:
                    yield content
                    
            # If the full stream finishes successfully without crashing, exit the function
            return 
            
        except Exception as e:
            # If this API crashes (Rate Limit, Out of Tokens, Offline), catch the error and loop to the next model
            print(f"Model {model_name} failed: {str(e)}. Falling back to next model...")
            continue
            
    # If the loop exhausts EVERY model in your list and they all fail
    yield "⚠️ I'm sorry, all AI providers are currently experiencing heavy traffic or rate limits. Please try again in a moment."