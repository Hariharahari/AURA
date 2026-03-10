# 🧠 AURA: Architectural Audit & Retrieval Agent

![AURA Dashboard](https://img.shields.io/badge/Status-Active-success)
![Python](https://img.shields.io/badge/Backend-FastAPI-3b82f6)
![React](https://img.shields.io/badge/Frontend-React_Vite-61dafb)
![Neo4j](https://img.shields.io/badge/Database-Neo4j-4581c3)
![AI](https://img.shields.io/badge/AI-Llama_3.1_%7C_FAISS-000000)

**AURA** is a full-stack, AI-powered system designed to automate the onboarding and architectural analysis of massive codebases. It fuses Static Code Analysis, Graph Theory, and Retrieval-Augmented Generation (RAG) to ingest GitHub repositories and instantly generate academic-grade documentation, interactive visual dependency graphs, and an interactive "Principal Architect" AI Chatbot.

---

## ✨ Core Features

* **⚡ Autonomous Ingestion (MCP & Git):** Clones repositories dynamically using Anthropic's Model Context Protocol (MCP) with native OS subprocess fallbacks for absolute fault tolerance.
* **🕸️ Mathematical Dependency Mapping:** Uses Python's `ast` (Abstract Syntax Tree) to parse code logic and extracts module dependencies without relying on fragile regex. Maps this data into a **Neo4j Graph Database**.
* **🧠 Semantic RAG Engine:** Chunks code and vectorizes it using `nvidia/nv-embed-v1`, storing it in a persistent local **FAISS Vector Database**.
* **📄 Automated Documentation:** Generates a 7-chapter, highly analytical system design document using `meta/llama-3.1-70b-instruct`. Uses `Matplotlib` and `NetworkX` to draw physics-based centrality graphs of the codebase's "nervous system."
* **💬 "Ask AURA" Chatbot:** An interactive chat interface where the AI acts as a Principal System Architect. It strictly enforces zero-hallucination policies, identifies design patterns (Factory, Adapter, Facade), and cites specific file paths based on the FAISS context.
* **🎨 Premium UI/UX:** A React & Material-UI frontend featuring Dark/Light modes, Fullscreen execution, PDF downloading, and 2D physics-based floating graph visualizations using `react-force-graph-2d`.

---

## 🛠️ Tech Stack

### Backend
* **Framework:** FastAPI, Uvicorn (Python)
* **AI & LLMs:** LangChain, NVIDIA NIMs (Llama 3.1 70B, NV-Embed-v1)
* **Databases:** Neo4j (Structural Graph), FAISS (Semantic Vectors)
* **Analysis:** `ast`, NetworkX, Matplotlib, Kroki API

### Frontend
* **Framework:** React (Vite)
* **UI Library:** Material-UI (MUI), Emotion
* **Visualizations:** `react-force-graph-2d`, React Markdown, Remark-GFM

---

## 🚀 Getting Started

### 1. Prerequisites
* Python 3.10+
* Node.js 18+
* A running instance of [Neo4j](https://neo4j.com/) (Local or AuraDB)
* An NVIDIA API Key (for LLM and Embeddings)

### 2. Backend Setup
Navigate to the backend directory, install dependencies, and configure your environment:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows use `venv\Scripts\activate`
pip install -r requirements.txt
Create a .env file in the backend directory:

Code snippet
NVIDIA_API_KEY=your_api_key_here
(Ensure your Neo4j credentials in main.py match your local database).

Run the server:

Bash
uv run main.py
The backend will start on http://localhost:8000

3. Frontend Setup
Open a new terminal, navigate to the frontend directory, and install dependencies:

Bash
cd aura-frontend
npm install
Start the development server:

Bash
npm run dev
The dashboard will be available at http://localhost:5173

## 🧪 Quality Assurance & Testing

AURA is built with enterprise-grade reliability in mind, featuring comprehensive test suites across the full stack to ensure deterministic behavior, boundary safety, and graceful error handling.

### Backend Testing (91% Coverage)
The FastAPI backend is tested using `pytest` and heavily relies on dependency injection and mocking to simulate complex AI and File I/O workflows without consuming API credits.
* **Unit & Boundary Testing:** Validates all FastAPI endpoints using Pydantic, ensuring malicious paths and empty payloads return proper HTTP error codes.
* **Integration Testing:** Tests the `ProductionAgent` end-to-end by mocking external NVIDIA LLM and GitHub connections, while allowing local FAISS vectorization, Neo4j database routing, and Matplotlib graph generation to execute securely.

**Run Backend Tests:**
\`\`\`bash
cd backend
uv run pytest tests/ --cov=main --cov=chat_agent --cov=aura_agent --cov-report=term-missing
\`\`\`

### Frontend Testing (81% Coverage)
The React frontend is tested using `Vitest` and `React Testing Library` to simulate a fully interactive DOM environment.
* **UI Interaction & State:** Simulates user flows including repository URL submission, tab switching, and dynamic rendering of the streaming AI chat.
* **API Mocking:** Isolates the frontend from the backend by intercepting `axios` and native `fetch` requests, guaranteeing the UI handles both "Happy Path" data and missing/broken data without crashing.

**Run Frontend Tests:**
\`\`\`bash
cd aura-frontend
npm run coverage
\`\`\`

## 🔒 Security & Compliance (SBOM)

To comply with modern supply chain security standards, this repository includes fully generated **Software Bill of Materials (SBOM)** for both environments. These track all open-source dependencies and transitives used in AURA.
* **Backend:** `backend/sbom-backend.json`
* **Frontend:** `aura-frontend/sbom-frontend.json`