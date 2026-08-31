import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client, ClientOptions
from sentence_transformers import SentenceTransformer
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

class GeminiEmbedder:
    def encode(self, texts):
        response = gemini_client.models.embed_content(
            model="gemini-embedding-001", 
            contents=texts,
            config=types.EmbedContentConfig(output_dimensionality=384) 
        )
        
        class EmbeddingResult:
            def tolist(self):
                # Extract the float arrays from the new response object
                return [embedding.values for embedding in response.embeddings]
                
        return EmbeddingResult()

print("Loading Gemini embedding model...")
embedding_model = GeminiEmbedder()
print("Model loaded.")