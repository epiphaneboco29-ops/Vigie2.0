# Prototype RAG minimal pour épidémiologistes (FR)

But : prototype conversationnel RAG en français — ingestion de documents, index FAISS, API FastAPI /chat qui retourne réponse + sources.

Prérequis
- Python 3.10+
- (Optionnel) clé OpenAI si tu veux utiliser l'API OpenAI pour l'étape de génération.
- (Optionnel) Docker pour conteneuriser.

Installer
1. Cloner le projet
2. Créer un venv et installer :
   pip install -r requirements.txt

Configuration
- Copier `.env.example` → `.env` et remplir :
  - OPENAI_API_KEY (optionnel) : si fourni, sera utilisé pour la génération.
  - FAISS_INDEX_PATH (optionnel) : chemin où persist l'index.

Usage local (rapide)
1. Placer des fichiers texte dans data/texts/ (ou convertir tes PDFs en .txt).
2. Lancer l’ingestion :
   python -m app.ingest --data-dir data/texts
   (créera l'index faiss et le store)
3. Lancer l’API :
   uvicorn app.main:app --reload --port 8000
4. Appeler l'endpoint /chat (POST JSON) :
   { "question": "Quels sont les symptômes courants du virus X ?", "k": 4 }

Endpoints
- POST /ingest : (optionnel) ingérer un dossier de textes via API.
- POST /chat : question → réponse en FR + sources.

Déploiement
- Dockerfile inclus. Pour production, remplacer FAISS par un vectorstore managé (Pinecone/Weaviate/PGVector) et utiliser un LLM adapté (HF ou self-hosted).
