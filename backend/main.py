import os
import glob  
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
import uvicorn

from aura_agent import ProductionAgent, DependencyEngine
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

global_chat_agent = ChatAgent()

class AnalyzeRequest(BaseModel):
    url: str
    doc_type: str = "both" # 🔥 Now accepts 'technical', 'business', or 'both'

class ChatRequest(BaseModel):
    repo_name: str
    question: str

@app.post("/api/analyze")
def api_analyze_repo(request: AnalyzeRequest):
    try:
        agent = ProductionAgent()
        agent.dep_engine = DependencyEngine("", NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD)
        agent.initialize_repo(request.url)
        
        # 🔥 The Magic Logic: Generate whatever the user requested!
        if request.doc_type in ["technical", "both"]:
            agent.generate_aura_report(doc_type="technical")
            
        if request.doc_type in ["business", "both"]:
            agent.generate_aura_report(doc_type="business")
            
        # Always generate release notes
        agent.generate_business_manual()
        
        agent.dep_engine.close()
        
        return {"status": "success", "repo_name": agent.current_repo_name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chat")
def api_chat(request: ChatRequest):
    try:
        response_generator = global_chat_agent.ask_question(request.repo_name, request.question)
        return StreamingResponse(response_generator, media_type="text/plain")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 🔥 NEW ENDPOINT: Fetch Technical Report
@app.get("/api/reports/technical/{repo_name}")
def api_get_tech_report(repo_name: str):
    filepath = os.path.join("reports", f"AURA_TECHNICAL_REPORT_{repo_name}.md")
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Technical report not found.")
    with open(filepath, "r", encoding="utf-8") as f:
        return {"content": f.read()}

# 🔥 NEW ENDPOINT: Fetch Business Report
@app.get("/api/reports/business/{repo_name}")
def api_get_biz_report(repo_name: str):
    filepath = os.path.join("reports", f"AURA_BUSINESS_REPORT_{repo_name}.md")
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Business report not found.")
    with open(filepath, "r", encoding="utf-8") as f:
        return {"content": f.read()}

@app.get("/api/notes/{repo_name}")
def api_get_notes(repo_name: str):
    filepath = os.path.join("reports", f"RELEASE_NOTES_{repo_name}.md")
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Release notes not found. Generate them first.")
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
    image_path = os.path.abspath(os.path.join("images", image_name))
    if os.path.exists(image_path):
        return FileResponse(image_path)
    raise HTTPException(status_code=404, detail="Image not found")

@app.get("/api/repos")
def api_list_repos():
    files = glob.glob(os.path.join("reports", "RELEASE_NOTES_*.md"))
    repos = [os.path.basename(f).replace("RELEASE_NOTES_", "").replace(".md", "") for f in files]
    return {"repos": list(set(repos))}

if __name__ == "__main__":
    print("🚀 Starting AURA Backend API on http://localhost:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)