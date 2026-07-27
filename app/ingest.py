import os
import json
from tqdm import tqdm
from .rag import RAGEngine, chunk_text

def read_text_file(path: str) -> str:
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        return f.read()

def ingest_texts(data_dir: str, rag_engine: RAGEngine):
    """
    Parcours data_dir, lit *.txt, découpe et ajoute dans l'index.
    """
    docs = []
    files = [os.path.join(data_dir, f) for f in os.listdir(data_dir) if f.lower().endswith(".txt")]
    for path in files:
        text = read_text_file(path)
        chunks = chunk_text(text)
        for i, c in enumerate(chunks):
            docs.append({
                "id": f"{os.path.basename(path)}_{i}",
                "text": c,
                "meta": {"source": os.path.basename(path)}
            })
    if docs:
        rag_engine.add_documents(docs)
        rag_engine.save_store()
    return len(files)

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", required=True, help="répertoire avec fichiers .txt")
    args = parser.parse_args()
    # crée un engine temporaire (chemins par défaut)
    engine = RAGEngine()
    count = ingest_texts(args.data_dir, engine)
    print(f"Ingested {count} files.")
