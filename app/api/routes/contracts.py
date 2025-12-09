from typing import List

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Response
from sqlalchemy.orm import Session

from ... import models, schemas
from ..deps import get_db
from ...services.openai_service import (
    generate_contract,
    analyze_contract,
    apply_suggestions,
    ai_improve_contract,
)
from ...services.file_extract_service import (
    extract_text_from_pdf,
    extract_text_from_docx,
    extract_text_from_txt,
)

# from app.services.export_service import create_export_file_from_template
from app.services.export_service import create_export_file


router = APIRouter(
    prefix="/contracts",
    tags=["Contracts"],
)


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
    contracts = db.query(models.Contract).all()
    return contracts


@router.post("/generate", response_model=schemas.ContractGenerateResponse)
def generate_contract_endpoint(
    request: schemas.ContractGenerateRequest,
):
    """
    Szerződéstervezet generálása OpenAI segítségével.
    """
    contract_text, summary_hu = generate_contract(request)

    return schemas.ContractGenerateResponse(
        contract_text=contract_text,
        summary_hu=summary_hu,
        summary_en=None,
    )


@router.post("/review", response_model=schemas.ContractReviewResponse)
def review_contract_endpoint(
    request: schemas.ContractReviewRequest,
):
    """
    AI-alapú szerződés review:
    - összefoglaló,
    - max 5 kockázatos pont,
    - általános kockázati szint.
    """
    review = analyze_contract(request)
    return review


@router.post(
    "/apply-suggestions",
    response_model=schemas.ContractApplySuggestionsResponse,
)
def apply_suggestions_endpoint(
    request: schemas.ContractApplySuggestionsRequest,
):
    """
    Az eredeti szerződéshez a kiválasztott javaslatok beépítése.
    Visszaadja a módosított szerződés szövegét és egy rövid változás-összefoglalót.
    """
    result = apply_suggestions(request)
    return result


@router.post("/extract-text", response_model=schemas.ContractExtractResponse)
async def extract_contract_text(file: UploadFile = File(...)):
    """PDF / DOCX / TXT szerződésből szöveget nyer ki."""
    filename = file.filename or ""
    lower_name = filename.lower()

    try:
        if lower_name.endswith(".pdf"):
            text = extract_text_from_pdf(file.file)
        elif lower_name.endswith(".docx"):
            text = extract_text_from_docx(file.file)
        elif lower_name.endswith(".txt") or lower_name.endswith(".doc"):
            # .doc esetére legegyszerűbb, ha előbb átkonvertálják docx-re,
            # itt most txt-szintű fallbacket adunk
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


@router.post("/improve", response_model=schemas.ContractImproveResponse)
async def improve_contract_endpoint(
    req: schemas.ContractImproveRequest,
):
    """
    Meglévő szerződés javított / kiegyensúlyozottabb változatát adja vissza AI segítségével.
    """
    try:
        result = ai_improve_contract(req)
        return result
    except Exception as e:
        # fejlesztéshez jó, élesben persze finomabban loggolnánk
        raise HTTPException(
            status_code=500,
            detail=f"Nem sikerült a szerződés javítása: {e}",
        )

@router.post("/export")
async def export_contract(
    req: schemas.ContractExportRequest,
):
    try:
        # Ezek MENNEK a meta-ba, mert create_export_file ezt várja
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

        # ⬅ A helyes hívás (NINCS layout_vars, NINCS output_format)
        filename, content, mime_type = create_export_file(
            template_name=req.template_name,
            template_vars=req.template_vars or {},
            format=req.format,     # ezt várja a függvény
            meta=meta,             # layout_vars → meta
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
