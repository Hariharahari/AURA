import os
from langchain_nvidia_ai_endpoints import NVIDIAEmbeddings, ChatNVIDIA
from langchain_community.vectorstores import FAISS
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, AIMessage
from dotenv import load_dotenv

load_dotenv()

class ChatAgent:
    def __init__(self):
        self.embeddings = NVIDIAEmbeddings(model="nvidia/nv-embed-v1", model_type="passage")
        self.llm = ChatNVIDIA(model="meta/llama-3.1-70b-instruct", temperature=0.1)
        
        # UPGRADE 1: In-memory cache for FAISS databases
        self.active_dbs = {}
        
        # UPGRADE 3: Dictionary to store chat history per repository/user
        self.chat_histories = {}

    def _get_vector_db(self, repo_name):
        """Loads DB from disk ONCE, then serves from RAM"""
        db_path = os.path.join("faiss_dbs", f"faiss_db_{repo_name}")
        
        if repo_name not in self.active_dbs:
            print(f"💿 Loading {repo_name} database from disk into RAM...")
            self.active_dbs[repo_name] = FAISS.load_local(
                db_path, 
                self.embeddings, 
                allow_dangerous_deserialization=True
            )
        return self.active_dbs[repo_name]

    def ask_question(self, repo_name, question):
        print(f"💬 Streaming answer for '{repo_name}': '{question}'")
        try:
            vector_db = self._get_vector_db(repo_name)
            
            # MMR to ensure diverse code context
            retriever = vector_db.as_retriever(search_type="mmr", search_kwargs={"k": 12, "fetch_k": 20})
            docs = retriever.invoke(question)
            context = "\n".join([d.page_content for d in docs])
            
            # Fetch or initialize chat history
            if repo_name not in self.chat_histories:
                self.chat_histories[repo_name] = []
            history = self.chat_histories[repo_name]

            # 🔥 UPDATED PROMPT: Adaptive Persona + Interactive Graph JSON payload instructions
            prompt = ChatPromptTemplate.from_messages([
                ("system", 
                "You are AURA, an elite AI Codebase Assistant. Your task is to answer questions about the '{repo_name}' repository.\n\n"
                "=========================================\n"
                "CONTEXT EXTRACTED FROM CODEBASE:\n{context}\n"
                "=========================================\n\n"
                "ADAPTIVE PERSONA RULES:\n"
                "1. **Analyze the Intent:** First, determine if the user is asking a GENERAL question or a TECHNICAL question.\n"
                "2. **For General Questions (Product Manager Mode):** Explain things simply and clearly. Focus on the project's purpose and business value. Do NOT use heavy technical jargon.\n"
                "3. **For Technical Questions (Architect Mode):** Dive deep into the logic. Explain the architectural decisions and data flow. Cite specific `ClassNames` and `file_names.py` directly in your sentences.\n"
                "4. **Code Formatting:** Provide code snippets ONLY if explicitly requested or strictly necessary.\n"
                "5. **Zero Hallucination:** Only provide answers supported by the provided context.\n"
                "6. **INTERACTIVE GRAPH (CRITICAL):** If your answer involves specific files, you MUST append a hidden XML tag at the very end of your response so the UI can highlight them. Format exactly like this:\n"
                "<ui_graph>scrapy/core/engine.py, scrapy/core/scheduler.py</ui_graph>\n"
                "CRITICAL RULE: Output the tag silently. DO NOT announce that you are doing this. DO NOT say 'Files lighting up in red'. Never reference the graph in your text."
                ),
                MessagesPlaceholder(variable_name="history"),
                ("human", "{question}")
            ])

            chain = prompt | self.llm

            # Create a generator function to yield tokens as they arrive
            def stream_generator():
                full_response = ""
                # .stream() yields chunks from the LLM in real-time
                for chunk in chain.stream({
                    "repo_name": repo_name,
                    "context": context,
                    "history": history,
                    "question": question
                }):
                    full_response += chunk.content
                    yield chunk.content
                
                # Once streaming is complete, save the interaction to memory
                history.append(HumanMessage(content=question))
                history.append(AIMessage(content=full_response))

            # Return the generator object
            return stream_generator()
            
        except Exception as e:
            print(f"Chat Error: {e}")
            # Yield the error as a stream so the frontend doesn't break
            def error_stream():
                yield f"⚠️ Could not load the knowledge base for **{repo_name}**. Make sure you have analyzed this repository first!"
            return error_stream()