from typing import List, Tuple
import numpy as np
from sqlalchemy.orm import Session

from ..models import RAGChunk
from openai import OpenAI
import os
from dotenv import load_dotenv

load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


def embed_query(text: str) -> List[float]:
    response = client.embeddings.create(
        model="text-embedding-3-small",
        input=[text],
    )
    return response.data[0].embedding


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))


def search_legal_context(db: Session, query: str, top_k: int = 5) -> List[Tuple[str, str]]:
    """
    Egyszerű RAG keresés:
    - lekéri az összes RAGChunk-ot
    - kiszámolja a cosine hasonlóságot
    - visszaadja a top_k (source, content) párokat
    """
    query_emb = np.array(embed_query(query))

    chunks = db.query(RAGChunk).all()

    scored: List[Tuple[float, str, str]] = []

    for ch in chunks:
        emb = np.array(ch.embedding, dtype=float)
        score = cosine_similarity(query_emb, emb)
        scored.append((score, ch.source, ch.content))

    scored.sort(key=lambda x: x[0], reverse=True)
    top = scored[:top_k]

    return [(s, c) for _, s, c in top]
