from fastapi import FastAPI

app = FastAPI(title="Magyar SzerződésGPT API")

@app.get("/health")
def health_check():
    return {"status": "ok"}