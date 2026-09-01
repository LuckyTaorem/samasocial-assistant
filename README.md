# Samasocial Technical Assignment - Task 1: Multi-Source AI Learning Assistant

**Author:** Taorem Lucky Singh  
**Role:** AI/Full-Stack Developer Applicant  

## Overview
This repository contains the implementation for **Task 1** of the Samasocial Technical Assignment[cite: 6]. It is a web-based AI learning assistant designed to process diverse knowledge sources (PDFs, PPTXs, YouTube videos, and Webpages) and provide accurate, strictly grounded answers with precise citations[cite: 6]. 

The system leverages a hybrid approach of semantic vector search and pre-computed document summaries to ensure high-quality retrieval without exceeding LLM context limits[cite: 6].

---

## 📸 Screenshots
<img width="1904" height="942" alt="Screenshot 2026-09-01 235814" src="https://github.com/user-attachments/assets/1d09fa07-0578-4d4e-927f-b8de485ec19c" />


| Chat Interface | Quiz Mode | Source Management |
|:---:|:---:|:---:|
| <img width="600" height="500" alt="Screenshot 2026-09-02 000502" src="https://github.com/user-attachments/assets/66d314f3-9960-4be1-900d-7b0929ecd32d" /> | <img width="600" height="500" alt="Screenshot 2026-09-02 000359" src="https://github.com/user-attachments/assets/fe4d2696-06e3-4533-815f-ea00bedcc9de" /> | <img width="600" height="500" alt="Screenshot 2026-09-02 000131" src="https://github.com/user-attachments/assets/152d05a6-24ba-49f9-8af8-dff77247467f" /> |

---

## ✨ Features & Assignment Checklist

### Core Functionality
- [x] **Multi-Source Ingestion:** Supports PDF, PPTX, YouTube URLs, and public Webpages[cite: 6].
- [x] **Strict Grounding & Hallucination Prevention:** The AI answers strictly based on uploaded context and gracefully declines out-of-scope questions[cite: 6].
- [x] **Granular Citations:** Answers include exact source locators (e.g., `[Source: document.pdf, Page 4]`, `[Source: presentation.pptx, Slide 2]`)[cite: 6].
- [x] **Deep-Linked Timestamps:** YouTube citations include clickable timestamps that jump directly to the referenced moment in the video[cite: 6].
- [x] **Streaming Responses:** The LLM streams responses token-by-token for a fast, real-time feel[cite: 6].
- [x] **Session Memory:** Multi-turn conversational memory allows for follow-up questions and cross-referencing[cite: 6].

### Bonus Features Implemented
- [x] **Simultaneous Sources:** Users can chat with multiple mixed sources at the same time[cite: 6].
- [x] **"Quiz Me" Mode:** Auto-generates 3 unique, non-repeating multiple-choice questions based strictly on the uploaded content summaries[cite: 6].
- [x] **Document Summaries:** Generates and displays a short summary of each source upon successful ingestion[cite: 6].
- [x] **Offline Resilience:** Includes a network listener and a robust fallback streaming mechanism (via Puter.js) if the primary Groq API fails.

---

## 🛠️ Architecture & Tech Stack

### Frontend
* **Framework:** Next.js / React (TypeScript)
* **Styling:** Tailwind CSS (with Dark/Light mode support)
* **Features:** LocalStorage session management, Markdown rendering (`react-markdown`), real-time typing indicators, and responsive mobile sidebar.

### Backend
* **Framework:** FastAPI (Python)
* **Database & Vector Store:** Supabase (PostgreSQL with `pgvector`)
* **LLM Provider:** Groq API (`openai/gpt-oss-20b` for chat, `qwen3.6-27b` for high-logic tasks like titles/quizzes).
* **Embeddings:** Hugging Face (Primary) with Gemini API (Fallback).

### Parsing Strategies
To ensure precise citations, files are parsed structurally rather than as bulk text[cite: 6]:
* **PPTX (`python-pptx`):** Iterates slide-by-slide to inject `slide_number` metadata into the vector chunks.
* **PDF (`PyPDF2`):** Iterates page-by-page to inject `page_number` metadata.
* **YouTube (`youtube-transcript-api`):** Captures exact timestamps and formats them into deep-linked URL parameters.

---

## 🚀 Setup & Installation

### Prerequisites
* Node.js (v18+)
* Python (3.9+)
* Supabase Account (for PostgreSQL + pgvector)
* Groq API Key

### 1. Environment Variables
Create a `.env` file in the **backend** directory:
```env
GROQ_API_KEY=your_groq_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
# Optional: GEMINI_API_KEY=your_gemini_key (for embedding fallback)
```
---

### 2. Backend Setup
Navigate to the backend folder, create a virtual environment, and install dependencies:

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```
## Start the FastAPI server:

```bash
uvicorn main:app --reload --port 8000
```
---

## 3. Frontend Setup
Navigate to the frontend folder and install dependencies:

```bash
cd frontend
npm install
```
## Start the development server:

```bash
npm run dev
The application will be available at http://localhost:3000.
```
### Usage Guide
- Upload Sources: Use the upload panel to add PDFs, modern PPTX files, YouTube URLs, or Webpage links.

- Review Summaries: Expand the "Source Summaries" dropdown to read the high-level overview of your uploads.

- Chat: Ask specific or broad questions. Use Shift + Enter for new lines. The AI will cite exact pages, slides, or video timestamps.

- Quiz: Click the "Quiz Me!" button to test your knowledge based on the active sources.

- Manage Sessions: Use the left sidebar to create new chats or switch between previous sessions.
