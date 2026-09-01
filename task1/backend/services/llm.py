import json
from groq import AsyncGroq
from backend.core.config import GROQ_API_KEY, supabase
from backend.services.vectorstore import search_similar_chunks

client = AsyncGroq(api_key=GROQ_API_KEY)
MODEL_NAME = "openai/gpt-oss-20b"

async def generate_chat_response(query: str, session_history: list, active_sources: list):
    # 1. Always fetch the high-level document summaries for active sources first
    doc_id_to_name = {}
    summaries_text = ""
    if active_sources:
        doc_res = supabase.table("documents").select("id, source_path, summary").in_("source_path", active_sources).execute()
        if doc_res.data:
            sum_list = []
            for d in doc_res.data:
                doc_id_to_name[str(d['id'])] = d['source_path']
                sum_list.append(f"=== OVERVIEW SUMMARY FOR [{d['source_path']}] ===\n{d['summary']}")
            summaries_text = "\n\n".join(sum_list)

    chunks = search_similar_chunks(query, match_threshold=0.0, match_count=10, active_sources=active_sources)

    # Fallback if vector search is empty
    if not chunks and active_sources:
        doc_res = supabase.table("documents").select("id, source_path").in_("source_path", active_sources).execute()
        doc_ids = [d["id"] for d in doc_res.data] if doc_res.data else []
        if doc_ids:
            chunk_res = supabase.table("document_chunks").select("content, metadata, document_id").in_("document_id", doc_ids).limit(15).execute()
            chunks = chunk_res.data or []
    
    chunk_context = ""
    if chunks:
        formatted_chunks = []
        for c in chunks:
            meta = c.get('metadata', {})
            doc_id = str(c.get('document_id', ''))

            source_name = (
                meta.get('source_name') or 
                meta.get('source') or 
                doc_id_to_name.get(doc_id) or 
                'Unknown'
            )
            
            # Format precise location metadata (Slide, Page, or Timestamp)
            location = ""
            if 'slide' in meta and meta['slide'] is not None:
                location = f", Slide {meta['slide']}"
            elif 'page' in meta and meta['page'] is not None:
                location = f", Page {meta['page']}"
            elif 'timestamp' in meta and meta['timestamp'] is not None:
                try:
                    # Safely parse decimal timestamps (e.g., 156.45 seconds)
                    ts = int(float(meta['timestamp']))
                    mins, secs = divmod(ts, 60)
                    hours, mins = divmod(mins, 60)
                    location = f", Timestamp {hours}:{mins:02d}:{secs:02d}" if hours > 0 else f", Timestamp {mins}:{secs:02d}"
                    
                    # --- FIX: Clean YouTube URLs and append exact time parameters ---
                    if "youtu" in source_name:
                        if "youtu.be" in source_name:
                            # Strip tracking params like ?si= and append timestamp
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

    context_text = f"{summaries_text}\n\n{chunk_context}".strip()
    if not context_text:
        context_text = "No relevant documents found."

    sources_str = ", ".join(active_sources) if active_sources else "None"

    # Updated system prompt instructing the AI to use precise filename + location citations
    system_prompt = (
        "You are a helpful AI learning assistant. "
        f"The user has currently uploaded the following active files/sources in their workspace: {sources_str}.\n\n"
        "INSTRUCTIONS:\n"
        "1. If the user asks what sources, files, or documents are available or uploaded, directly list the active files.\n"
        "2. If the user asks what a file contains, asks for an overview, summary, or what is inside it, use the provided OVERVIEW SUMMARY sections.\n"
        "3. For all other specific questions, answer using the detailed context chunks provided below.\n"
        "4. If the answer cannot be found in the context or summaries, you MUST politely reply with: 'I'm sorry, but that is out of scope of the provided material.'\n"
        "5. MANDATORY CITATION: You MUST include the exact source and location in brackets at the end of every factual sentence based on context. "
        "If the source is a web URL, you MUST format it as a clickable Markdown link so it looks clean (e.g., **[Source: [YouTube Video](https://youtu.be/abc?t=156), Timestamp 2:36]**). "
        "If it is a file, cite it normally (e.g., **[Source: SamplePPT-All.pptx, Slide 2]**).\n\n"
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