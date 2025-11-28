from sqlalchemy import Column, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON
from .database import Base


class Contract(Base):
    __tablename__ = "contracts"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    content = Column(Text)


class RAGChunk(Base):
    __tablename__ = "rag_chunks"

    id = Column(Integer, primary_key=True, index=True)
    source = Column(String, index=True)   # pl. "Ptk. 6:1 §"
    content = Column(Text)                # a paragrafus/részlet szövege
    embedding = Column(JSON)              # float lista (embedding)
