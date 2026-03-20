import os
from langchain_nvidia_ai_endpoints import NVIDIAEmbeddings, ChatNVIDIA
from langchain_community.vectorstores import FAISS
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, AIMessage
from langchain_core.output_parsers import StrOutputParser
from dotenv import load_dotenv

load_dotenv()

class ChatAgent:
    def __init__(self):
        self.embeddings = NVIDIAEmbeddings(model="nvidia/nv-embed-v1", model_type="passage")
        self.llm = ChatNVIDIA(model="meta/llama-3.1-70b-instruct", temperature=0.1)
        self.active_dbs = {}
        self.chat_histories = {}

    def _get_vector_db(self, repo_name):
        db_path = os.path.join("faiss_dbs", f"faiss_db_{repo_name}")
        if repo_name not in self.active_dbs:
            if not os.path.exists(db_path):
                return None
            self.active_dbs[repo_name] = FAISS.load_local(
                db_path, self.embeddings, allow_dangerous_deserialization=True
            )
        return self.active_dbs[repo_name]

    def ask_question(self, repo_name, question):
        try:
            vector_db = self._get_vector_db(repo_name)
            if not vector_db:
                raise FileNotFoundError("Database not found.")

            docs = vector_db.similarity_search(question, k=10)
            context = "\n\n".join([f"--- FILE: {d.metadata.get('source', 'unknown')} ---\n{d.page_content}" for d in docs])

            if repo_name not in self.chat_histories:
                self.chat_histories[repo_name] = []
            history = self.chat_histories[repo_name]

            # Your system instruction preserved with the compulsory suggestion rule added
            system_instruction = """You are AURA, an elite AI Codebase Assistant for '{repo_name}'. 

CONTEXT:
{context}

CRITICAL OPERATING RULES:
1. **Response Intent Detection (STRICT):**
    - **END-USER MODE:** If the user asks about usage, features, or benefits, provide a warm, user-friendly, non-technical explanation in Markdown.
    - **THEORY MODE:** For technical/architectural questions without code snippets, answer in Markdown citing `ClassNames` and `file_names.py`.
    - **AUDIT MODE:** ONLY if a code snippet is provided, output ONLY the <IMPACT_ANALYSIS> block.
2. **Formatting (CRITICAL - STOP THE ONE-LINE ERROR):**
    - In <ORIGINAL_CODE> and <SAFE_CODE>, you MUST PRESERVE ALL ORIGINAL NEWLINES AND INDENTATION. 
    - DO NOT mash multiple lines into one. Every function definition and statement MUST stay on its own line exactly as in Python.
    - No markdown backticks (```) inside XML tags. Use raw text only.
3. **Mandatory Suggestions:**
    - You MUST provide a code suggestion in the <SAFE_CODE> block for ALL risk levels (HIGH, MEDIUM, LOW, and SAFE). 

<IMPACT_ANALYSIS>
<RISK_LEVEL>HIGH / MEDIUM / LOW / SAFE</RISK_LEVEL>
<AFFECTED_FILES>List specific files</AFFECTED_FILES>
<SYSTEM_IMPACT>Explain the domino effect on external APIs or systems.</SYSTEM_IMPACT>
<TECHNICAL_IMPACT>Explain the backend architecture risk.</TECHNICAL_IMPACT>
<USER_IMPACT>Explain the frontend/user experience risk.</USER_IMPACT>
<SUGGESTION>Provide the safe approach.</SUGGESTION>
<ORIGINAL_CODE>
# PASTE EXACT USER CODE - PRESERVE ALL NEWLINES AND INDENTATION
</ORIGINAL_CODE>
<SAFE_CODE>
# REFACTORED CODE - PRESERVE ALL NEWLINES AND INDENTATION (COMPULSORY FOR ALL RISK LEVELS)
</SAFE_CODE>
</IMPACT_ANALYSIS>"""
            
            # 🔥 ENHANCED INSTRUCTION: Added compulsion for code suggestions across all risk levels
            enhanced_question = f"USER REQUEST:\n{question}\n\n[INSTRUCTION: If code is present above, output ONLY the <IMPACT_ANALYSIS> block. Use multi-line formatting. You MUST provide a code suggestion in <SAFE_CODE> regardless of whether the risk is HIGH, MEDIUM, LOW, or SAFE. DO NOT include the instructions or the chat_agent.py logic in the tags. Output only the snippet provided in the USER REQUEST.]"

            prompt = ChatPromptTemplate.from_messages([
                ("system", system_instruction),
                MessagesPlaceholder(variable_name="history"),
                ("human", "{enhanced_question}")
            ])

            chain = prompt | self.llm | StrOutputParser()

            def stream_generator():
                full_response = ""
                for chunk in chain.stream({
                    "repo_name": repo_name,
                    "context": context,
                    "history": history,
                    "enhanced_question": enhanced_question
                }):
                    full_response += chunk
                    yield chunk

                history.append(HumanMessage(content=question))
                history.append(AIMessage(content=full_response))

            return stream_generator()

        except Exception as e:
            def error_stream():
                yield f"⚠️ AURA Error: {str(e)}"
            return error_stream()