import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client, ClientOptions
# from sentence_transformers import SentenceTransformer
from google import genai
from google.genai import types

BASE_DIR = Path(__file__).resolve().parent.parent.parent 
ENV_PATH = os.path.join(BASE_DIR, ".env")

# 2. Load the specific file
load_dotenv(dotenv_path=ENV_PATH)

# Environment Variables
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

options = ClientOptions(postgrest_client_timeout=None)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY, options=options)

gemini_client = genai.Client(api_key=GEMINI_API_KEY)

# class StackedEmbeddings:
#     def __init__(self):
#         print("Loading local SentenceTransformer model as primary...")
#         self.local_model = SentenceTransformer("all-MiniLM-L6-v2")

#     def encode(self, texts):
#         try:
#             # --- TIER 1: Local Embeddings (Instant, Zero Rate Limits) ---
#             return self.local_model.encode(texts)
            
#         except Exception as e:
#             print(f"Local embedding failed, trying Gemini fallback... ({e})")
            
#             # --- TIER 2: Google Gemini Fallback ---
#             response = gemini_client.models.embed_content(
#                 model="gemini-embedding-001", 
#                 contents=texts,
#                 config=types.EmbedContentConfig(output_dimensionality=384) 
#             )
            
#             class EmbeddingResult:
#                 def tolist(self):
#                     return [embedding.values for embedding in response.embeddings]
                    
#             return EmbeddingResult()

# print("Loading Stacked embedding model...")
# embedding_model = StackedEmbeddings()
# print("Model loaded.")

class CloudEmbeddings:
    def __init__(self):
        print("Loading Gemini Cloud API Embedder...")

    def encode(self, texts):
        # Ensure texts is a list for the API
        if isinstance(texts, str):
            texts = [texts]

        try:
            # Use Google Gemini exclusively
            response = gemini_client.models.embed_content(
                model="text-embedding-004", 
                contents=texts,
                config=types.EmbedContentConfig(output_dimensionality=384) 
            )
            
            class EmbeddingResult:
                def tolist(self):
                    return [embedding.values for embedding in response.embeddings]
                    
            return EmbeddingResult()
            
        except Exception as e:
            print(f"Gemini embedding failed: {e}")
            raise Exception("Cloud embedding API failed to process the text.")

print("Loading Cloud embedding model...")
embedding_model = CloudEmbeddings()
print("Model loaded.")