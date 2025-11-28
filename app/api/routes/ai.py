from fastapi import APIRouter
from ...services.openai_service import ai_test_sentence

router = APIRouter(
    prefix="/ai",
    tags=["AI"],
)


@router.get("/test")
def ai_test():
    """
    Egyszerű AI teszt endpoint.
    """
    answer = ai_test_sentence()
    return {"answer": answer}
