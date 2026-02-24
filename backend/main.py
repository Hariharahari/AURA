import os
import glob  
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse 
from pydantic import BaseModel
import uvicorn

# Import the Document Generator
from aura_agent import ProductionAgent, DependencyEngine
# 🔥 Import the new Chatbot Agent
from chat_agent import ChatAgent

app = FastAPI(title="AURA Backend API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

NEO4J_URI = "bolt://127.0.0.1:7687"
NEO4J_USER = "neo4j"
NEO4J_PASSWORD = "harish@12" # Make sure this matches your Neo4j password!

class AnalyzeRequest(BaseModel):
    url: str

# 🔥 NEW: Schema for Chat Requests
class ChatRequest(BaseModel):
    repo_name: str
    question: str

@app.post("/api/analyze")
def api_analyze_repo(request: AnalyzeRequest):
    try:
        agent = ProductionAgent()
        agent.dep_engine = DependencyEngine("", NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD)
        
        agent.initialize_repo(request.url)
        report_filename = agent.generate_aura_report()
        
        agent.dep_engine.close()
        return {"status": "success", "repo_name": agent.current_repo_name, "report_file": report_filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 🔥 NEW ENDPOINT: Handle Chatbot questions
@app.post("/api/chat")
def api_chat(request: ChatRequest):
    try:
        chat_agent = ChatAgent()
        answer = chat_agent.ask_question(request.repo_name, request.question)
        return {"answer": answer}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/reports/{repo_name}")
def api_get_report(repo_name: str):
    filepath = f"AURA_REPORT_{repo_name}.md"
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Report not found. Generate it first.")
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    return {"repo_name": repo_name, "content": content}

@app.get("/api/graph/{repo_name}")
def api_get_graph(repo_name: str):
    engine = DependencyEngine("", NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD)
    graph_data = engine.get_react_graph_data(repo_name)
    engine.close()
    return graph_data

@app.get("/api/images/{image_name}")
def api_get_image(image_name: str):
    image_path = os.path.abspath(f"./{image_name}")
    if os.path.exists(image_path):
        return FileResponse(image_path)
    raise HTTPException(status_code=404, detail="Image not found")

@app.get("/api/repos")
def api_list_repos():
    files = glob.glob("AURA_REPORT_*.md")
    repos = [f.replace("AURA_REPORT_", "").replace(".md", "") for f in files]
    return {"repos": repos}

if __name__ == "__main__":
    print("🚀 Starting AURA Backend API on http://localhost:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)