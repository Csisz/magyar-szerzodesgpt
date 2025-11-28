import os
from typing import List, Tuple

import numpy as np
from dotenv import load_dotenv
from openai import OpenAI
from sqlalchemy.orm import Session

from .database import SessionLocal, engine, Base
from .models import RAGChunk

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=OPENAI_API_KEY)


def parse_ptk_file(path: str) -> List[Tuple[str, str]]:
    """
    Beolvassa a data/ptk_chunks.txt fájlt.
    Visszaad: listát (source, content) tuple-ökkel.
    """
    with open(path, "r", encoding="utf-8") as f:
        raw = f.read()

    entries = [e.strip() for e in raw.split("---") if e.strip()]
    results: List[Tuple[str, str]] = []

    for entry in entries:
        lines = [l for l in entry.splitlines() if l.strip()]
        if len(lines) < 2:
            continue
        source = lines[0].strip()
        content = "\n".join(lines[1:]).strip()
        results.append((source, content))

    return results


def embed_texts(texts: List[str]) -> List[List[float]]:
    """
    OpenAI embedding API: text-embedding-3-small-et használunk.
    """
    response = client.embeddings.create(
        model="text-embedding-3-small",
        input=texts,
    )
    embeddings = [item.embedding for item in response.data]
    return embeddings


def init_rag_from_ptk():
    """
    Ptk. részletek beolvasása, embedding készítése, mentés az adatbázisba.
    """
    Base.metadata.create_all(bind=engine)

    db: Session = SessionLocal()

    file_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "ptk_chunks.txt")
    chunks = parse_ptk_file(file_path)

    print(f"{len(chunks)} jogszabály-részletet találtam, embedding készül...")

    texts = [c[1] for c in chunks]
    embeddings = embed_texts(texts)

    # töröljük a régi bejegyzéseket (opcionális)
    db.query(RAGChunk).delete()

    for (source, content), emb in zip(chunks, embeddings):
        db_chunk = RAGChunk(
            source=source,
            content=content,
            embedding=emb,  # JSON-ként tároljuk a float listát
        )
        db.add(db_chunk)

    db.commit()
    db.close()

    print("RAG adatbázis feltöltve.")


if __name__ == "__main__":
    init_rag_from_ptk()
