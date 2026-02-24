import os
import ast
import shutil
import stat
import subprocess
import networkx as nx
import concurrent.futures
import time
import asyncio
import matplotlib.pyplot as plt # <-- NEW: For generating the architecture image
from dotenv import load_dotenv
from neo4j import GraphDatabase
from langchain_nvidia_ai_endpoints import NVIDIAEmbeddings, ChatNVIDIA
from langchain_community.vectorstores import FAISS
from langchain_community.document_loaders import TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_mcp_adapters.client import MultiServerMCPClient

load_dotenv()

BASE_REPOS_DIR = os.path.abspath("./cloned_repos")

class DependencyEngine:
    def __init__(self, root_path, neo4j_uri, neo4j_user, neo4j_password):
        self.root_path = root_path
        self.graph = nx.DiGraph()
        self.ignored = {
            'node_modules', '.next', '.git', 'dist', 'build', 'coverage', 
            'locales', '__snapshots__', 'fonts', 'docs', 'scripts', 'tests', 'public',
            'venv', 'env', '__pycache__', 'migrations'
        }
        
        try:
            self.driver = GraphDatabase.driver(neo4j_uri, auth=(neo4j_user, neo4j_password))
            print("🟢 Connected to Neo4j Database.")
        except Exception as e:
            print(f"🔴 Failed to connect to Neo4j: {e}")
            self.driver = None

    def close(self):
        if self.driver:
            self.driver.close()

    def _save_to_neo4j(self, nodes, edges, repo_name):
        if not self.driver: return
        print(f"💾 Saving {len(nodes)} files and {len(edges)} connections to Neo4j for '{repo_name}'...")
        try:
            with self.driver.session() as session:
                session.run(
                    "MERGE (r:Repository {name: $repo_name})", 
                    repo_name=repo_name
                )
                for node in nodes:
                    filename = os.path.basename(node)
                    session.run(
                        """
                        MERGE (f:File {path: $path, repo: $repo_name}) 
                        SET f.name = $name, f.language = 'Python'
                        WITH f
                        MATCH (r:Repository {name: $repo_name})
                        MERGE (r)-[:OWNS]->(f)
                        """,
                        path=node, name=filename, repo_name=repo_name
                    )
                for source, target in edges:
                    session.run(
                        """
                        MATCH (a:File {path: $source, repo: $repo_name}) 
                        MATCH (b:File {path: $target, repo: $repo_name}) 
                        MERGE (a)-[:IMPORTS]->(b)
                        """, 
                        source=source, target=target, repo_name=repo_name
                    )
            print("✅ Graph successfully grouped and stored in Neo4j!")
        except Exception as e:
            print(f"⚠️ Failed to save to Neo4j: {e}")

    def build(self, repo_name):
        print(f"🕸️  Mapping Python Backend Dependencies (AST)...")
        files = self._get_files()
        
        for f in files:
            rel_path = os.path.relpath(f, self.root_path).replace("\\", "/")
            self.graph.add_node(rel_path)
        
        for f in files:
            rel_path = os.path.relpath(f, self.root_path).replace("\\", "/")
            imports = self._extract_imports_via_ast(f)
            for imp in imports:
                target = self._resolve_python_import(f, imp, files)
                if target:
                    self.graph.add_edge(rel_path, target)
        
        print(f"✅ In-Memory Graph Built: {len(self.graph.nodes)} nodes.")
        self._save_to_neo4j(list(self.graph.nodes), list(self.graph.edges), repo_name)

    def get_react_graph_data(self, repo_name):
        if not self.driver: return {"nodes": [], "links": []}
        try:
            with self.driver.session() as session:
                nodes_result = session.run("MATCH (f:File {repo: $repo}) RETURN f.path AS id, f.name AS name", repo=repo_name)
                nodes = [{"id": record["id"], "name": record["name"], "val": 1} for record in nodes_result]
                
                links_result = session.run(
                    "MATCH (a:File {repo: $repo})-[rel:IMPORTS]->(b:File {repo: $repo}) "
                    "RETURN a.path AS source, b.path AS target", 
                    repo=repo_name
                )
                links = [{"source": record["source"], "target": record["target"]} for record in links_result]
                
                return {"nodes": nodes, "links": links}
        except Exception as e:
            print(f"⚠️ Error fetching graph: {e}")
            return {"nodes": [], "links": []}

    def _get_files(self):
        code_files = []
        for root, dirs, files in os.walk(self.root_path):
            dirs[:] = [d for d in dirs if d not in self.ignored]
            for f in files:
                if f.endswith('.py') and 'test' not in f:
                    code_files.append(os.path.abspath(os.path.join(root, f)))
        return code_files

    def _extract_imports_via_ast(self, file_path):
        found_imports = []
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                tree = ast.parse(f.read(), filename=file_path)
            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    for alias in node.names: found_imports.append(alias.name)
                elif isinstance(node, ast.ImportFrom):
                    if node.module: found_imports.append(node.module)
        except: pass
        return found_imports

    def _resolve_python_import(self, current_file, import_str, all_files):
        path_parts = import_str.replace('.', '/')
        for f in all_files:
            rel = os.path.relpath(f, self.root_path).replace("\\", "/")
            if rel.replace(".py", "").endswith(path_parts): return rel
            if rel.endswith("__init__.py") and os.path.dirname(rel).endswith(path_parts): return rel
        return None

class ProductionAgent:
    def __init__(self):
        self.embeddings = NVIDIAEmbeddings(model="nvidia/nv-embed-v1", model_type="passage")
        self.llm = ChatNVIDIA(model="meta/llama-3.1-70b-instruct", temperature=0.1)
        self.vector_db = None
        self.dep_engine = None
        self.current_repo_name = "UNKNOWN"

    def _load_file_content(self, file_path):
        try: return TextLoader(file_path, encoding='utf-8').load()
        except: return []

    async def _mcp_clone(self, url, target_path):
        print(f"🔌 Connecting to Git MCP Server (via uvx)...")
        client = MultiServerMCPClient({
            "git": {
                "command": "uvx",
                "args": ["mcp-server-git", "--repository", "."], 
                "transport": "stdio"
            }
        })
        try:
            await client.call_tool("git", "git_clone", url=url, repo_path=target_path)
            print("   ✅ MCP Server Clone Complete.")
        except Exception as e:
            print(f"   ⚠️ MCP Server Note: {e}")
            print("   🔄 Falling back to Native OS Subprocess Clone...")
            subprocess.run(["git", "clone", url, target_path], check=True)
            print("   ✅ Native Clone Complete.")

    def initialize_repo(self, url):
        self.current_repo_name = url.rstrip("/").split("/")[-1].replace(".git", "")
        target_path = os.path.join(BASE_REPOS_DIR, self.current_repo_name)
        
        print(f"\n🚀 STARTING AURA GENERATION: {url}")
        os.makedirs(BASE_REPOS_DIR, exist_ok=True)
        
        if os.path.exists(target_path):
            shutil.rmtree(target_path, onerror=lambda f,p,e: (os.chmod(p, stat.S_IWRITE), f(p)))
        
        asyncio.run(self._mcp_clone(url, target_path))
        
        self.dep_engine.root_path = target_path
        self.dep_engine.build(self.current_repo_name)
        
        print("⚡ Loading Knowledge Base (High Density)...")
        all_docs = []
        files = self.dep_engine._get_files()
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            future_to_file = {executor.submit(self._load_file_content, f): f for f in files}
            for i, future in enumerate(concurrent.futures.as_completed(future_to_file)):
                all_docs.extend(future.result())
                if i % 50 == 0: print(f"   📂 Loaded {i}/{len(files)}...", end="\r")
        
        splitter = RecursiveCharacterTextSplitter(chunk_size=2000, chunk_overlap=200)
        chunks = splitter.split_documents(all_docs)
        
        print(f"\n   📡 Vectorizing {len(chunks)} chunks...")
        if len(chunks) > 0:
            self.vector_db = FAISS.from_documents(chunks[:20], self.embeddings)
            for i in range(20, len(chunks), 20):
                self.vector_db.add_documents(chunks[i : i + 20])
                time.sleep(0.1)
                
            # 🔥 THE ONLY CHANGE: Saving the vector DB so the ChatAgent can use it
            self.vector_db.save_local(f"faiss_db_{self.current_repo_name}")
            
        print("✅ Knowledge Base Ready.")

    def _safe_search(self, query, k=15):
        try: return self.vector_db.similarity_search(query, k=k)
        except: return []

    def write_heavy_chapter(self, chapter_num, title, topic, role):
        print(f"   ✍️  Writing {title} (Repository-Grounded Mode)...")
        
        docs = self._safe_search(topic, k=20)
        context = "\n".join([d.page_content[:800] for d in docs])
        
        # 🔥 UPGRADED PROMPT: Forces AI to explain exactly how the project connects to the topic
        text_prompt = (
            f"Act as a {role} and Lead System Architect. Write a COMPREHENSIVE, ACADEMIC-GRADE chapter titled '{title}'.\n\n"
            f"TOPIC: {topic}\n"
            f"CONTEXT FROM CODEBASE: {context}\n\n"
            "CRITICAL REQUIREMENTS:\n"
            "1. **NO GENERIC DEFINITIONS:** DO NOT write dictionary definitions of what a topic is. Assume the reader already knows the theory.\n"
            "2. **REPOSITORY CONNECTION (CRITICAL):** You MUST explain exactly HOW this specific project implements the topic. Every subheading must explicitly analyze the actual codebase logic, naming specific classes, functions, and architecture decisions found in the Context.\n"
            f"3. **Dynamic Numbered Subheadings:** Use numbered H2 (##) subheadings (e.g., ## {chapter_num}.1, ## {chapter_num}.2). The titles MUST be specific to how the codebase operates (e.g., '## {chapter_num}.2 Core File Parsing Logic' instead of '## {chapter_num}.2 Theory').\n"
            "4. **Anti-Hallucination:** If the context lacks the specific topic, state clearly why this repository's architecture doesn't need it. Do not invent fake code.\n"
            "5. **Length:** Write at least 1500 words. Be extremely verbose and highly analytical.\n\n"
            "Start the chapter immediately."
        )
        
        diag_prompt = (
            f"Act as a System Architect. Generate a Mermaid.js diagram for '{topic}'.\n"
            f"Context: {context}\n"
            "Return ONLY the mermaid code block (inside ```mermaid ... ```)."
        )
        
        try:
            content = self.llm.invoke(text_prompt).content
            diagram = self.llm.invoke(diag_prompt).content.replace("```mermaid", "").replace("```", "").strip()
            
            mermaid_block = "```mermaid\n" + diagram + "\n```"
            
            full_chapter = (
                f"# {title}\n\n"
                f"{content}\n\n"
                f"### {chapter_num}.X Subsystem Flow Diagram\n"
                "The following diagram illustrates the structural relationships implemented in this module:\n\n"
                f"{mermaid_block}\n\n"
            )
            return full_chapter
        except Exception as e:
            print(f"   ⚠️ Error writing chapter: {e}")
            return f"# {title}\n(Content generation failed)\n\n"

    def generate_aura_report(self):
        print("\n📚 GENERATING AURA REPORT (THEORETICAL EDITION)...")
        
        full_document = (
            f"# AURA: {self.current_repo_name.upper()} ARCHITECTURAL AUDIT\n\n"
            f"**Target Repository:** {self.current_repo_name}\n"
            f"**Generated By:** AURA Production Agent\n"
            f"**Focus:** Applied System Architecture & Technical Implementation\n\n"
        )

        # YOUR EXACT UNTOUCHED CHAPTER GENERATION LOOP
        full_document += self.write_heavy_chapter(
            1, "Chapter 1: Executive Vision & Domain Theory",
            "Business logic, domain driven design, core value proposition",
            "Chief Technology Officer"
        )
        time.sleep(3)
        
        full_document += self.write_heavy_chapter(
            2, "Chapter 2: User Experience & Interaction Flows",
            "Authentication sequences, user session management, frontend-backend contract",
            "Product Architect"
        )
        time.sleep(3)
        
        full_document += self.write_heavy_chapter(
            3, "Chapter 3: System Architecture & Design Patterns",
            "Dependency injection, factory patterns, singleton usage, service layer isolation",
            "Principal Software Engineer"
        )
        time.sleep(3)

        full_document += self.write_heavy_chapter(
            4, "Chapter 4: Data Persistence & Schema Theory",
            "ORM mapping strategies, database normalization, indexing strategy, transaction boundaries",
            "Senior Database Administrator"
        )
        time.sleep(3)

        full_document += self.write_heavy_chapter(
            5, "Chapter 5: API Interface Strategy",
            "RESTful constraints, serialization logic, content negotiation, endpoint security",
            "Backend Lead"
        )
        time.sleep(3)
        
        full_document += self.write_heavy_chapter(
            6, "Chapter 6: System Resilience & DevOps",
            "Error handling, logging, caching strategy, fault tolerance",
            "Site Reliability Engineer"
        )
        time.sleep(3)

        full_document += self.write_heavy_chapter(
            7, "Chapter 7: Technical Debt & Refactoring Strategy",
            "Code complexity, cyclical dependencies, refactoring opportunities",
            "Senior DevOps Engineer"
        )
        time.sleep(3)
        
        # 🔥 UPGRADED CHAPTER 8: Matplotlib Image + AI Analysis
        print("   🕸️  Visualizing Architecture Graph & Running AI Analysis...")
        
        # 1. Grab top nodes for the graph image
        top_nodes = sorted(self.dep_engine.graph.degree, key=lambda x: x[1], reverse=True)[:35]
        nodes_list = [n[0] for n in top_nodes]
        subgraph = self.dep_engine.graph.subgraph(nodes_list)
        
        # 2. Draw Graph Image using Matplotlib
        plt.figure(figsize=(10, 8))
        plt.gca().set_facecolor('#ffffff') # White background looks best for PDF
        pos = nx.spring_layout(subgraph, k=0.7, iterations=50)
        nx.draw_networkx_edges(subgraph, pos, edge_color='#94a3b8', alpha=0.8)
        nx.draw_networkx_nodes(subgraph, pos, node_color='#3b82f6', node_size=150)
        labels = {n: os.path.basename(n) for n in subgraph.nodes()}
        nx.draw_networkx_labels(subgraph, pos, labels, font_size=9, font_weight='bold')
        
        # Save image locally
        image_filename = f"architecture_{self.current_repo_name}.png"
        plt.axis('off')
        plt.savefig(image_filename, format="PNG", bbox_inches='tight', dpi=300)
        plt.close()

        # 3. AI Analysis of the Graph
        graph_explanation_prompt = (
            f"Act as a Principal System Architect. I have generated a Dependency Graph of the '{self.current_repo_name}' repository. "
            f"The most highly connected 'core' files in this architecture are: {', '.join([os.path.basename(n) for n in nodes_list[:15]])}.\n\n"
            f"Write a highly detailed, 500-word architectural analysis explaining WHY these specific files are the central nervous system of the app. "
            f"Explain how data and logic likely flow between these specific modules based on their names. Use subheadings (## 8.1, ## 8.2)."
        )
        
        try:
            graph_explanation = self.llm.invoke(graph_explanation_prompt).content
        except:
            graph_explanation = "Graph analysis could not be generated due to an AI error."

        # 4. Generate the fallback Mermaid Block
        mermaid_graph = "graph TD\n"
        for u, v in self.dep_engine.graph.edges():
            if os.path.basename(u) in [os.path.basename(n) for n in nodes_list[:20]] and os.path.basename(v) in [os.path.basename(n) for n in nodes_list[:20]]:
                mermaid_graph += f"    {os.path.basename(u)} --> {os.path.basename(v)}\n"

        graph_block = "```mermaid\n" + mermaid_graph + "\n```"

        # 5. Compile Chapter 8
        full_document += (
            "# Chapter 8: System Architecture Network\n\n"
            "This chapter visualizes the 'Nervous System' of the codebase, highlighting the most critical modules based on centrality analysis.\n\n"
            f"![System Architecture](http://localhost:8000/api/images/{image_filename})\n\n"
            f"{graph_explanation}\n\n"
            "### 8.X Critical Path Visualization (Mermaid)\n\n"
            f"{graph_block}\n\n"
        )

        output_filename = f"AURA_REPORT_{self.current_repo_name}.md"
        with open(output_filename, "w", encoding="utf-8") as f:
            f.write(full_document)
            
        print(f"\n✨ SUCCESS: '{output_filename}' generated.")
        return output_filename