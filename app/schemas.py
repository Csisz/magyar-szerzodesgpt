from pydantic import BaseModel
from typing import Optional, List, Literal


# ---- DB-s contract modellek ----

class ContractBase(BaseModel):
    title: str
    content: str


class ContractCreate(ContractBase):
    pass


class ContractRead(ContractBase):
    id: int

    class Config:
        orm_mode = True  # Pydantic v2-ben warning, de működik; később átírhatjuk from_attributes-re


# ---- AI-s endpointokhoz használt modellek: GENERATE ----

class ContractGenerateRequest(BaseModel):
    type: str                    # pl. "megbízási szerződés"
    parties: str                 # pl. "Kiss János (megbízó) és Teszt Kft. (megbízott)"
    subject: str                 # pl. "online marketing szolgáltatások"
    payment: str                 # pl. "havi 200.000 Ft + áfa"
    duration: str                # pl. "határozatlan idő"
    special_terms: Optional[str] = None  # pl. "titoktartás, versenytilalom"


class ContractGenerateResponse(BaseModel):
    contract_text: str           # formális jogi szöveg
    summary_hu: str              # laikus, magyar összefoglaló
    summary_en: Optional[str] = None   # opcionális angol összefoglaló


# ---- AI-s endpointokhoz használt modellek: REVIEW ----

class ContractReviewRequest(BaseModel):
    contract_text: str                    # a teljes szerződés szövege
    contract_type: Optional[str] = None   # pl. "megbízási szerződés", "bérleti szerződés"
    party_role: Optional[str] = None      # pl. "megbízó", "megbízott", "bérlő", "bérbeadó"


class ContractReviewIssue(BaseModel):
    clause_excerpt: str                   # rövid idézet vagy összefoglaló a kifogásolt pontról
    issue: str                            # mi a probléma jogilag / gyakorlatban
    risk_level: Literal["alacsony", "közepes", "magas"]
    disadvantaged_party: Optional[str] = None   # kit hoz hátrányos helyzetbe (pl. "megbízó")
    suggestion: str                       # javasolt, kiegyensúlyozottabb megfogalmazás


class ContractReviewResponse(BaseModel):
    summary_hu: str                       # a szerződés laikus összefoglalója
    issues: List[ContractReviewIssue]     # problémás / kockázatos pontok listája
    overall_risk: Literal["alacsony", "közepes", "magas"]
    notes: Optional[str] = None           # egyéb megjegyzés, disclaimer


# ---- AI-s endpointokhoz: SUGGESTIONS ALKALMAZÁSA ----

class ContractApplySuggestionsRequest(BaseModel):
    original_contract: str                # az eredeti, teljes szerződés szövege
    issues_to_apply: List[ContractReviewIssue]  # azok a javaslatok, amelyeket ténylegesen alkalmazni szeretnél


class ContractApplySuggestionsResponse(BaseModel):
    updated_contract_text: str            # módosított szerződés teljes szövege
    change_summary: str                   # rövid összefoglaló arról, milyen fő változtatások történtek

class ContractExtractResponse(BaseModel):
    text: str

# ... (ContractGenerateRequest, ContractReviewRequest stb.)

class ContractImproveRequest(BaseModel):
    contract_text: str
    contract_type: Optional[str] = None     # pl. "Lakásbérleti szerződés"
    party_role: Optional[str] = None        # pl. "bérbeadó", "megbízó"


class ContractImproveResponse(BaseModel):
    improved_text: str                      # javított / módosított szerződés teljes szövege
    summary_hu: Optional[str] = None        # rövid magyar összefoglaló arról, mit javított

class ContractExportRequest(BaseModel):
    """
    Szerződés export kérés a backend felé.
    - template_name: melyik sablont használjuk (pl. "megbizasi")
    - format: "pdf" vagy "docx"
    - template_vars: a szerződéssablonban használt placeholder-ek értékei
    - a többi mező a layout/base.html-hez megy
    """

    template_name: str                      # pl. "megbizasi"
    format: Literal["pdf", "docx"]

    template_vars: dict                     # pl. {"megbizo_neve": "...", ...}

    document_title: Optional[str] = None
    document_date: Optional[str] = None
    document_number: Optional[str] = None

    brand_name: Optional[str] = None
    brand_subtitle: Optional[str] = None
    footer_text: Optional[str] = None
