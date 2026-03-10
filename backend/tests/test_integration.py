import os
import shutil
import pytest
from unittest.mock import patch, MagicMock

# Import your actual agent
from aura_agent import ProductionAgent

# =========================================================
# THE INTEGRATION TEST (Running the Real Engine)
# =========================================================

@patch("aura_agent.GraphDatabase.driver") # Fake the Neo4j Database connection
@patch("aura_agent.NVIDIAEmbeddings.embed_documents") # Fake the NVIDIA FAISS embedding math
@patch("aura_agent.NVIDIAEmbeddings.embed_query")
@patch("aura_agent.ChatNVIDIA.invoke") # Fake the NVIDIA LLM chat responses
@patch.object(ProductionAgent, "_mcp_clone") # Fake the GitHub download
def test_full_agent_integration(mock_clone, mock_invoke, mock_embed_query, mock_embed_docs, mock_neo4j):
    """
    INTEGRATION TEST:
    We fake the internet (GitHub & NVIDIA), but we let the code actually build 
    the FAISS database, draw the Matplotlib graph, and write the Markdown files!
    """
    
    # 1. SETUP THE FAKE GITHUB CLONE
    # Instead of downloading code, we instantly create a fake repo on the hard drive
    async def fake_clone_action(url, target_path):
        os.makedirs(target_path, exist_ok=True)
        # Create a fake Python file that imports another file (to test your AST parser!)
        with open(os.path.join(target_path, "main.py"), "w", encoding="utf-8") as f:
            f.write("import utils\nprint('Hello AURA')\n")
        with open(os.path.join(target_path, "utils.py"), "w", encoding="utf-8") as f:
            f.write("def helper(): pass\n")
            
    mock_clone.side_effect = fake_clone_action

    # 2. SETUP THE FAKE NVIDIA AI
    # FAISS needs a list of floats to represent the text. 
    # FIX: We dynamically return exactly as many math vectors as there are text chunks!
    mock_embed_docs.side_effect = lambda texts: [[0.1, 0.2, 0.3]] * len(texts)
    mock_embed_query.return_value = [0.1, 0.2, 0.3]
    
    # The LLM needs to return an object with a '.content' attribute
    class DummyAIResponse:
        def __init__(self, text):
            self.content = text
            
    def smart_ai_mock(prompt, *args, **kwargs):
        prompt_str = str(prompt)
        # If the code asks for the JSON chapter plan, give it a fake JSON array
        if "table of contents" in prompt_str:
            return DummyAIResponse('[{"chapter_num": 1, "title": "Test Chapter", "topic": "test", "role": "Tester"}]')
        # Otherwise, just return fake markdown text
        return DummyAIResponse("Fake AI Generated Content for the report.")
        
    mock_invoke.side_effect = smart_ai_mock

    # ---------------------------------------------------------
    # 3. EXECUTE THE REAL CODE
    # ---------------------------------------------------------
    agent = ProductionAgent()
    
    # Give it Neo4j credentials (which will be intercepted by our mock)
    from aura_agent import DependencyEngine
    agent.dep_engine = DependencyEngine("dummy_path", "bolt://fake", "user", "pass")
    
    # Run the Pipeline!
    repo_url = "https://github.com/test/demo_integration_repo"
    
    # Phase 1: Clone & Vectorize
    agent.initialize_repo(repo_url)
    
    # Phase 2: Generate the massive Technical Report & Graph
    report_path = agent.generate_aura_report()
    
    # Phase 3: Generate the Business Manual
    manual_path = agent.generate_business_manual()

    # ---------------------------------------------------------
    # 4. ASSERTIONS (Proving it physically worked)
    # ---------------------------------------------------------
    # Did it physically create the markdown files on the hard drive?
    assert os.path.exists(report_path)
    assert os.path.exists(manual_path)
    
    # Did Matplotlib successfully draw and save the network graph?
    expected_image_path = os.path.join("images", "architecture_demo_integration_repo.png")
    assert os.path.exists(expected_image_path)
    
    # Did FAISS successfully save the vector database?
    expected_db_path = os.path.join("faiss_dbs", "faiss_db_demo_integration_repo")
    assert os.path.exists(expected_db_path)

    # Clean up the physical files we just created so we don't clutter your computer
    shutil.rmtree(expected_db_path, ignore_errors=True)
    shutil.rmtree(os.path.join("cloned_repos", "demo_integration_repo"), ignore_errors=True)
    if os.path.exists(report_path): os.remove(report_path)
    if os.path.exists(manual_path): os.remove(manual_path)
    if os.path.exists(expected_image_path): os.remove(expected_image_path)