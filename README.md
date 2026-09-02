# Samasocial Technical Assignment - Task 1: Multi-Source AI Learning Assistant

**Author:** Taorem Lucky Singh  
**Role:** AI/Full-Stack Developer Applicant  

## Overview
This repository contains the implementation for **Task 1** of the Samasocial Technical Assignment. It is a web-based AI learning assistant designed to process diverse knowledge sources (PDFs, PPTXs, YouTube videos, and Webpages) and provide accurate, strictly grounded answers with precise citations. 

The system leverages a hybrid approach of semantic vector search and pre-computed document summaries to ensure high-quality retrieval without exceeding LLM context limits.

---

## 📸 Screenshots
<img width="1904" height="942" alt="Screenshot 2026-09-01 235814" src="https://github.com/user-attachments/assets/1d09fa07-0578-4d4e-927f-b8de485ec19c" />


| Chat Interface | Quiz Mode | Source Management |
|:---:|:---:|:---:|
| <img width="600" height="500" alt="Screenshot 2026-09-02 000502" src="https://github.com/user-attachments/assets/66d314f3-9960-4be1-900d-7b0929ecd32d" /> | <img width="600" height="500" alt="Screenshot 2026-09-02 000359" src="https://github.com/user-attachments/assets/fe4d2696-06e3-4533-815f-ea00bedcc9de" /> | <img width="600" height="500" alt="Screenshot 2026-09-02 000131" src="https://github.com/user-attachments/assets/152d05a6-24ba-49f9-8af8-dff77247467f" /> |

---

## ✨ Features & Assignment Checklist

### Core Functionality
- [x] **Multi-Source Ingestion:** Supports PDF, PPTX, YouTube URLs, and public Webpages.
- [x] **Strict Grounding & Hallucination Prevention:** The AI answers strictly based on uploaded context and gracefully declines out-of-scope questions.
- [x] **Granular Citations:** Answers include exact source locators (e.g., `[Source: document.pdf, Page 4]`, `[Source: presentation.pptx, Slide 2]`).
- [x] **Deep-Linked Timestamps:** YouTube citations include clickable timestamps that jump directly to the referenced moment in the video.
- [x] **Streaming Responses:** The LLM streams responses token-by-token for a fast, real-time feel.
- [x] **Session Memory:** Multi-turn conversational memory allows for follow-up questions and cross-referencing.

### Bonus Features Implemented
- [x] **Simultaneous Sources:** Users can chat with multiple mixed sources at the same time.
- [x] **"Quiz Me" Mode:** Auto-generates 3 unique, non-repeating multiple-choice questions based strictly on the uploaded content summaries.
- [x] **Document Summaries:** Generates and displays a short summary of each source upon successful ingestion.
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
To ensure precise citations, files are parsed structurally rather than as bulk text:
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
### Start the FastAPI server:

```bash
uvicorn main:app --reload --port 8000
```
---

### 3. Frontend Setup
Navigate to the frontend folder and install dependencies:

```bash
cd frontend
npm install
```
### Start the development server:

```bash
npm run dev
The application will be available at http://localhost:3000.
```
## Usage Guide
- Upload Sources: Use the upload panel to add PDFs, modern PPTX files, YouTube URLs, or Webpage links.

- Review Summaries: Expand the "Source Summaries" dropdown to read the high-level overview of your uploads.

- Chat: Ask specific or broad questions. Use Shift + Enter for new lines. The AI will cite exact pages, slides, or video timestamps.

- Quiz: Click the "Quiz Me!" button to test your knowledge based on the active sources.

- Manage Sessions: Use the left sidebar to create new chats or switch between previous sessions.

---

# Samasocial Technical Assignment - Task 2: AI Course Planning Assistant for Mentors

## Overview
This section covers the implementation for **Task 2** of the Samasocial Technical Assignment. It is a conversational AI assistant tailored specifically for mentors and educators to help them plan a complete, well-structured course through a guided back-and-forth conversation[cite: 5]. 

The system leverages structured data generation to ensure the final output is both highly customizable in the UI and ready for backend system integration[cite: 5].

---

## 📸 Screenshots
<img width="1900" height="939" alt="image" src="https://github.com/user-attachments/assets/3debd406-8855-491c-b3e7-0622135b783e" />


| Split-Panel Interface | Inline Editing | PDF Syllabus Import |
|:---:|:---:|:---:|
| <img width="600" height="500" alt="image" src="https://github.com/user-attachments/assets/4bcb5438-9199-4940-b519-cda73c02306c" />| <img width="600" height="500" alt="image" src="https://github.com/user-attachments/assets/e7a2770a-1812-4d07-8689-03783aa1e7ff" /> | <img width="600" height="500" alt="image" src="https://github.com/user-attachments/assets/cb27a9ce-7993-4c77-b988-986ac1c957d5" /> |

---

## ✨ Features & Assignment Checklist

### Core Functionality
- [x] **Guided Intake:** The assistant asks key questions to understand the subject, target audience, duration, and learning goals[cite: 5].
- [x] **Structured Course Generation:** Generates a complete plan featuring module breakdowns, lesson topics, and module-end assessments[cite: 5]. 
- [x] **Public Resource Mapping:** Automatically recommends publicly available resources (e.g., YouTube, articles, documentation) and practice exercises from platforms like HackerRank, LeetCode, or Kaggle[cite: 5].
- [x] **Conversational Refinement:** Mentors can ask follow-up questions to adjust any part of the plan (e.g., "make module 2 simpler")[cite: 5].
- [x] **Live Preview:** The course plan is viewable as a live preview directly in the web UI, updating in real time as the mentor refines the plan[cite: 5].

### Technical Requirements Implemented
- [x] **Multi-Turn Context:** Maintains the full context of the planning session across conversational turns[cite: 5].
- [x] **Structured JSON Output:** The final course plan is produced as structured data (JSON) rather than free-form text, enabling external system integration[cite: 5].
- [x] **Editable Output UI:** Mentors can click and edit individual fields directly within the UI once the plan is generated[cite: 5].
- [x] **Split-Panel Design:** Features a clean interface with the chat on one side and the live course plan preview on the other[cite: 5].

### Bonus Features Implemented
- [x] **PDF Syllabus Import:** Allows mentors to paste an existing syllabus or curriculum PDF for the AI to improve or restructure[cite: 5].
- [x] **Difficulty Progression:** Includes a difficulty progression indicator (beginner / intermediate / advanced) for each lesson[cite: 5].
- [x] **Prerequisite Suggestions:** Suggests prerequisite topics the student should know before starting each module[cite: 5].

## 🛠️ Architecture & Tech Stack

### Frontend
* **Framework:** Next.js / React (TypeScript)
* **Styling:** Tailwind CSS (Dark/Light mode supported)
* **UI Components:** `react-resizable-panels` for the split-pane workspace, Lucide React for iconography.
* **State Management:** React Hooks with isolated browser-based session tracking via `localStorage` (`X-User-ID`).

### Backend
* **Framework:** FastAPI (Python)
* **Database:** Supabase (PostgreSQL)
* **LLM Provider:** Groq API (`openai/gpt-oss-120b` for heavy JSON generation and smart delta-merging).
* **Live Search:** Tavily API (Dynamically fetches verified, interactive practice links and documentation).
* **Document Parsing:** `PyPDF2` for extracting text from uploaded syllabus PDFs.

---

## 🚀 Setup & Installation

### Prerequisites
* Node.js (v18+)
* Python (3.9+)
* Supabase Account
* API Keys: Groq and Tavily

### 1. Database Setup (Supabase)
You need to create three tables in your Supabase project to handle session memory and course plans:
1. **`sessions`**: Columns `id` (uuid, primary key), `created_at` (timestamp), `title` (text), and `user_id` (text).
2. **`messages`**: Columns `id` (uuid), `created_at` (timestamp), `session_id` (uuid, foreign key), `role` (text), and `content` (text).
3. **`course_plans`**: Columns `id` (uuid), `created_at` (timestamp), `session_id` (uuid, foreign key, unique), and `plan_data` (jsonb).

### 2. Environment Variables
Create a `.env` file in the **backend** directory:
```env
GROQ_API_KEY=your_groq_api_key
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_anon_key
TAVILY_API_KEY=your_tavily_api_key
FRONTEND_URL=http://localhost:3000
```

### 3. Backend Setup
Navigate to the backend folder, create a virtual environment, and install dependencies:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```
Create a requirements.txt file with the following:
```
fastapi==0.110.0
uvicorn==0.27.1
python-multipart==0.0.9
python-dotenv==1.0.1
groq==0.4.2
supabase==2.4.5
pypdf==4.1.0
tavily-python==0.3.3
```

Install the requirements and start the FastAPI server:

```
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 4. Frontend Setup
Navigate to the frontend folder and install dependencies:
```bash
cd frontend
npm install
```

Start the development server:
```bash
npm run dev
```

The application will be available at http://localhost:3000.

# Usage Guide

1. Initial Setup: Open the web interface. A new, anonymous session is automatically generated and tied to your browser.

2. Define the Course (or Upload a Syllabus):

    - Type out your target audience, learning goals, and subject matter in the chat.

    - Alternatively, click the attachment icon to upload an existing PDF syllabus. The AI will read it and structure it into a modern course format.

3. Live Preview: Watch the right-hand panel instantly populate with your structured course plan, including dynamically fetched, real-world URLs for resources and active practice environments (e.g., LeetCode, HackerRank).

4. Refine via Chat: Ask the AI to make adjustments (e.g., "Make Module 2 easier" or "Swap out the reading materials for video tutorials"). The backend uses a smart delta-merge system to update only the specific JSON nodes you requested without rewriting the whole plan.

5. Inline Editing: Click directly on any text inside the course plan preview (titles, descriptions, URLs) to manually tweak the output.

6. Session Management: Open the left sidebar to start a new course plan, switch between previous sessions, or delete old ones.
