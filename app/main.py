from fastapi import FastAPI
from .database import Base, engine
from . import models
from .api.routes import ai, contracts
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Magyar SzerződésGPT API")

# táblák létrehozása
Base.metadata.create_all(bind=engine)

# health check
@app.get("/health")
def health_check():
    return {"status": "ok"}



# >>> IDE: CORS BEÁLLÍTÁSOK <<<

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,        # honnan engedjük a kéréseket
    allow_credentials=True,
    allow_methods=["*"],          # GET, POST, stb.
    allow_headers=["*"],          # bármilyen header
)

# routerek
app.include_router(ai.router)
app.include_router(contracts.router)
