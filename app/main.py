from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv
import os
from .rag import RAGEngine

load_dotenv()
app = FastAPI(title="Prototype RAG épidémiologie (FR)")

# initialise engine (index loaded/created by ingestion)
INDEX_PATH = os.getenv("FAISS_INDEX_PATH", "faiss_index.bin")
DOC_STORE_PATH = os.getenv("DOC_STORE_PATH", "doc_store.jsonl")
rag = RAGEngine(index_path=INDEX_PATH, docs_path=DOC_STORE_PATH)

class ChatRequest(BaseModel):
    question: str
    k: int = 4
    language: str = "fr"

class IngestRequest(BaseModel):
    data_dir: str

@app.post("/chat")
def chat(req: ChatRequest):
    if not req.question:
        raise HTTPException(status_code=400, detail="Question manquante")
    answer = rag.query(req.question, k=req.k, language=req.language)
    return answer

@app.post("/ingest")
def ingest(req: IngestRequest):
    # ingérer un dossier de textes (path relatif)
    from .ingest import ingest_texts
    count = ingest_texts(req.data_dir, rag)
    return {"ingested_files": count}
