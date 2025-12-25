from typing import List, Dict

from fastapi import (
    APIRouter,
    Depends,
    UploadFile,
    File,
    HTTPException,
    Response,
)
from sqlalchemy.orm import Session
from pydantic import BaseModel

from ... import models, schemas
from ..deps import get_db

# 🔹 Régi OpenAI-alapú szolgáltatások (review, improve, stb.)
from ...services.openai_service import (
    analyze_contract,
    apply_suggestions,
    ai_improve_contract,
)

# 🔹 ÚJ: template-alapú szerződés generátor
from app.services.contract_generator import generate_contract as generate_contract_from_template

# 🔹 File extract
from ...services.file_extract_service import (
    extract_text_from_pdf,
    extract_text_from_docx,
    extract_text_from_txt,
)

# 🔹 Export
from app.services.export_service import create_export_file


router = APIRouter(
    prefix="/contracts",
    tags=["Contracts"],
)

# ============================================================
# REQUEST MODEL – TEMPLATE-ALAPÚ GENERÁLÁSHOZ
# ============================================================

class ContractGenerateTemplateRequest(BaseModel):
    contract_type: str            # "megbizasi", "nda"
    generation_mode: str          # "fast" | "detailed"
    form_data: Dict[str, str]     # {{PLACEHOLDER}} → érték


# ============================================================
# MANUÁLIS CONTRACT CRUD
# ============================================================

@router.post("/", response_model=schemas.ContractRead)
def create_contract(
    contract_in: schemas.ContractCreate,
    db: Session = Depends(get_db),
):
    """
    Egyszerű manuális contract létrehozás (AI nélkül).
    """
    db_contract = models.Contract(
        title=contract_in.title,
        content=contract_in.content,
    )
    db.add(db_contract)
    db.commit()
    db.refresh(db_contract)
    return db_contract


@router.get("/", response_model=List[schemas.ContractRead])
def list_contracts(db: Session = Depends(get_db)):
    """
    Összes elmentett szerződés listázása.
    """
    return db.query(models.Contract).all()


# ============================================================
# 🧠 TEMPLATE-ALAPÚ SZERZŐDÉSGENERÁLÁS (FAST / DETAILED)
# ============================================================

@router.post("/generate", response_model=schemas.ContractGenerateResponse)
def generate_contract_endpoint(
    request: ContractGenerateTemplateRequest,
):
    try:
        result = generate_contract_from_template(
            contract_type=request.contract_type,
            mode=request.generation_mode,
            form_data=request.form_data,
        )

        # ⛑️ KRITIKUS VÉDELEM
        if not isinstance(result, dict):
            raise ValueError("A szerződésgenerátor nem várt formátumban tért vissza.")

        if "contract_html" not in result:
            raise ValueError("Hiányzik a generált szerződés szövege.")

        return schemas.ContractGenerateResponse(
            contract_text=result["contract_html"],
            summary_hu=result.get("summary_hu", ""),
            summary_en=None,
            telemetry=result.get("telemetry"),
        )

    except (FileNotFoundError, ValueError) as e:
        if request.generation_mode == "fast":
            return schemas.ContractGenerateResponse(
                contract_text="",
                summary_hu=(
                    "Gyors módban nem sikerült automatikusan feldolgozni "
                    "a megadott adatokat. A szerződés sablon alapú volt. "
                    "Részletesebb eredményhez válaszd az „Alapos” módot."
                ),
                summary_en=None,
                telemetry={
                    "mode": "fast",
                    "fallback": True,
                    "internal_error": str(e),  # ⬅️ logolásra marad
                },
            )

        raise HTTPException(status_code=400, detail=str(e))


    except Exception as e:
        # 🔴 EZ IS JSON
        raise HTTPException(
            status_code=500,
            detail=f"Szerződés generálása közben hiba történt: {e}",
        )



# ============================================================
# 🔍 AI-ALAPÚ REVIEW
# ============================================================

@router.post("/review", response_model=schemas.ContractReviewResponse)
def review_contract_endpoint(
    request: schemas.ContractReviewRequest,
):
    """
    AI-alapú szerződés review:
    - összefoglaló
    - max 5 kockázatos pont
    - általános kockázati szint
    """
    return analyze_contract(request)


# ============================================================
# ✏️ JAVASLATOK ALKALMAZÁSA
# ============================================================

@router.post(
    "/apply-suggestions",
    response_model=schemas.ContractApplySuggestionsResponse,
)
def apply_suggestions_endpoint(
    request: schemas.ContractApplySuggestionsRequest,
):
    """
    A kiválasztott AI-javaslatok beépítése a szerződésbe.
    """
    return apply_suggestions(request)


# ============================================================
# 📄 SZÖVEGKINYERÉS FELTÖLTÖTT FILE-BÓL
# ============================================================

@router.post("/extract-text", response_model=schemas.ContractExtractResponse)
async def extract_contract_text(file: UploadFile = File(...)):
    """
    PDF / DOCX / TXT szerződésből szöveget nyer ki.
    """
    filename = file.filename or ""
    lower_name = filename.lower()

    try:
        if lower_name.endswith(".pdf"):
            text = extract_text_from_pdf(file.file)
        elif lower_name.endswith(".docx"):
            text = extract_text_from_docx(file.file)
        elif lower_name.endswith(".txt") or lower_name.endswith(".doc"):
            text = extract_text_from_txt(file.file)
        else:
            raise HTTPException(
                status_code=400,
                detail="Csak PDF, DOCX vagy TXT fájl tölthető fel.",
            )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Nem sikerült a szöveg kinyerése: {e}",
        )

    if not text.strip():
        raise HTTPException(
            status_code=400,
            detail="Nem találtam olvasható szöveget a fájlban.",
        )

    return schemas.ContractExtractResponse(text=text)


# ============================================================
# 🛠️ SZERZŐDÉS JAVÍTÁSA (AI IMPROVE)
# ============================================================

@router.post("/improve", response_model=schemas.ContractImproveResponse)
async def improve_contract_endpoint(
    req: schemas.ContractImproveRequest,
):
    """
    Meglévő szerződés javított / kiegyensúlyozottabb változata AI segítségével.
    """
    try:
        return ai_improve_contract(req)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Nem sikerült a szerződés javítása: {e}",
        )


# ============================================================
# 📦 EXPORT (PDF / DOCX)
# ============================================================

@router.post("/export")
async def export_contract(
    req: schemas.ContractExportRequest,
):
    try:
        meta = {
            "document_title": req.document_title or "Szerződés",
            "document_date": req.document_date or "",
            "document_number": req.document_number or "",
            "brand_name": req.brand_name or "Magyar SzerződésGPT",
            "brand_subtitle": req.brand_subtitle
                or "AI-alapú szerződésgenerálás (általános tájékoztatás, nem jogi tanácsadás)",
            "footer_text": req.footer_text
                or "A dokumentum automatikusan generált, és nem minősül jogi tanácsadásnak.",
        }

        filename, content, mime_type = create_export_file(
            template_name=req.template_name,
            template_vars=req.template_vars or {},
            format=req.format,
            meta=meta,
        )

        headers = {
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
        return Response(content=content, media_type=mime_type, headers=headers)

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Nem sikerült a szerződés exportálása: {e}",
        )
