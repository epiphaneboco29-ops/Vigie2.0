import os
import json
from typing import List, Dict, Any
from sentence_transformers import SentenceTransformer
import faiss
import numpy as np
import openai
from dotenv import load_dotenv
load_dotenv()

EMBED_MODEL_NAME = os.getenv("EMBED_MODEL_NAME", "sentence-transformers/all-MiniLM-L6-v2")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if OPENAI_API_KEY:
    openai.api_key = OPENAI_API_KEY

def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200):
    chunks = []
    start = 0
    L = len(text)
    while start < L:
        end = min(start + chunk_size, L)
        chunks.append(text[start:end])
        start += chunk_size - overlap
    return chunks

class RAGEngine:
    def __init__(self, index_path: str = "faiss_index.bin", docs_path: str = "doc_store.jsonl"):
        self.index_path = index_path
        self.docs_path = docs_path
        self.embedder = SentenceTransformer(EMBED_MODEL_NAME)
        self.dimension = self.embedder.get_sentence_embedding_dimension()
        self.index = None
        self.doc_store = []  # list of {id, text, meta}
        if os.path.exists(self.index_path) and os.path.exists(self.docs_path):
            self._load_store()

    def _load_store(self):
        # load doc store
        self.doc_store = []
        with open(self.docs_path, "r", encoding="utf-8") as f:
            for line in f:
                self.doc_store.append(json.loads(line))
        # load faiss
        self.index = faiss.read_index(self.index_path)

    def save_store(self):
        with open(self.docs_path, "w", encoding="utf-8") as f:
            for doc in self.doc_store:
                f.write(json.dumps(doc, ensure_ascii=False) + "\n")
        faiss.write_index(self.index, self.index_path)

    def add_documents(self, documents: List[Dict[str, Any]]):
        # documents: list of {id, text, meta}
        texts = [d["text"] for d in documents]
        embeddings = self.embedder.encode(texts, show_progress_bar=True, convert_to_numpy=True)
        if self.index is None:
            self.index = faiss.IndexFlatL2(self.dimension)
        self.index.add(np.array(embeddings).astype("float32"))
        start_index = len(self.doc_store)
        for i, d in enumerate(documents):
            self.doc_store.append(d)

    def query(self, question: str, k: int = 4, language: str = "fr"):
        # embed query
        q_emb = self.embedder.encode([question], convert_to_numpy=True).astype("float32")
        if self.index is None or self.index.ntotal == 0:
            return {"answer": "Index vide — ingère des documents d'abord.", "sources": []}
        D, I = self.index.search(q_emb, k)
        hits = []
        for idx in I[0]:
            if idx < len(self.doc_store):
                hits.append(self.doc_store[idx])
        # build prompt in FR with context and ask LLM
        context = "\n\n---\n\n".join([f"Source: {h.get('meta',{}).get('source','unknown')}\n{h['text'][:1500]}" for h in hits])
        prompt = f"""Tu es un assistant pour des épidémiologistes. Réponds en {language}. Utilise uniquement les informations dans les sources fournies. Si l'information n'est pas dans les sources, dis \"Je ne sais pas\" ou recommande vérification.

Contexte :
{context}

Question : {question}

Répond brièvement, structure ta réponse, et fournis pour chaque affirmation la source (nom du fichier ou metadata)."""
        answer_text = self._call_llm(prompt)
        sources = [{"source": h.get("meta", {}).get("source", "unknown"), "id": h.get("id")} for h in hits]
        return {"answer": answer_text, "sources": sources}

    def _call_llm(self, prompt: str, max_tokens: int = 512) -> str:
        if OPENAI_API_KEY:
            try:
                resp = openai.ChatCompletion.create(
                    model="gpt-3.5-turbo",
                    messages=[{"role":"system","content":"You are a helpful assistant."},
                              {"role":"user","content":prompt}],
                    max_tokens=max_tokens,
                    temperature=0.0,
                )
                return resp["choices"][0]["message"]["content"].strip()
            except Exception as e:
                return f"Erreur LLM: {e}"
        else:
            # fallback: simple heuristic echo (pour démo)
            return "LLM non configuré (set OPENAI_API_KEY). Prompt résumé :\n" + prompt[:1000]
