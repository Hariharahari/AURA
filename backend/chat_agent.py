import os
from langchain_nvidia_ai_endpoints import NVIDIAEmbeddings, ChatNVIDIA
from langchain_community.vectorstores import FAISS
from dotenv import load_dotenv

load_dotenv()

class ChatAgent:
    def __init__(self):
        # Using the exact same AI models as your Document Agent
        self.embeddings = NVIDIAEmbeddings(model="nvidia/nv-embed-v1", model_type="passage")
        self.llm = ChatNVIDIA(model="meta/llama-3.1-70b-instruct", temperature=0.1)

    def ask_question(self, repo_name, question):
        print(f"💬 Searching codebase '{repo_name}' for: '{question}'")
        try:
            # 1. Load the FAISS database from the hard drive
            vector_db = FAISS.load_local(
                f"faiss_db_{repo_name}", 
                self.embeddings, 
                allow_dangerous_deserialization=True
            )
            
            # 2. Retrieve the top 12 most relevant code chunks (bumped up for tougher questions)
            docs = vector_db.similarity_search(question, k=12)
            context = "\n".join([d.page_content for d in docs])
            
            # 3. Generate the answer with an ultra-strict, highly analytical prompt
            # 3. Generate the answer with an ultra-strict, highly analytical prompt
            # 3. Generate the answer with an ultra-strict, highly analytical prompt
            prompt = (
                f"You are AURA, a Principal Software Architect and Elite Codebase Analyst. "
                f"Your task is to answer complex, highly technical questions about the '{repo_name}' repository.\n\n"
                f"=========================================\n"
                f"CONTEXT EXTRACTED FROM CODEBASE:\n{context}\n"
                f"=========================================\n\n"
                f"USER QUESTION: {question}\n\n"
                "STRICT EXECUTION RULES:\n"
                "1. **THEORETICAL ELEVATION:** Focus heavily on the theoretical Software Engineering principles, Design Patterns (e.g., Adapter, Factory, Singleton), and Architectural Decisions behind the code. Explain WHY the system was built this way.\n"
                "2. **NO RAW CODE DUMPS:** Do NOT copy-paste raw code blocks or use multi-line code snippets to explain theoretical concepts. It clutters the explanation. \n"
                "3. **INLINE CITATIONS ONLY:** Instead of code blocks, seamlessly integrate the exact `ClassNames`, `function_names()`, and `file_names.py` found in the context directly into your sentences as proof of your analysis.\n"
                "4. **ZERO HALLUCINATION:** Base your entire answer STRICTLY on the provided context. Do NOT guess external information.\n"
                "5. **PROFESSIONAL TONE:** Speak directly like a senior engineer. STRICTLY FORBIDDEN: Do not use generic filler wrap-ups like 'In summary', 'In conclusion', or 'To conclude'."
            )
            
            return self.llm.invoke(prompt).content
            
        except Exception as e:
            print(f"Chat Error: {e}")
            return f"⚠️ Could not load the knowledge base for **{repo_name}**. Make sure you have analyzed this repository first!"