import json
import hashlib

from app.services.openai_service import call_openai


# egyszerű in-memory cache (később Redis / DB)
_NORMALIZE_CACHE = {}


def normalize_parties_cached(parties_text: str) -> dict:
    """
    Szabad szöveges felek leírását strukturált jogi adatokra bontja.
    Cache-elve, hogy FAST maradjon.
    """

    if not parties_text or not parties_text.strip():
        return {}

    key = hashlib.sha256(parties_text.encode("utf-8")).hexdigest()

    if key in _NORMALIZE_CACHE:
        return _NORMALIZE_CACHE[key]

    prompt = f"""
A következő szöveg szerződő feleket ír le magyar nyelven:

"{parties_text}"

Feladat:
Bontsd fel a felek adatait strukturált mezőkre.

KIZÁRÓLAG érvényes JSON objektumot adj vissza az alábbi kulcsokkal:
- CLIENT_NAME
- CLIENT_ADDRESS
- CLIENT_REGNO
- CLIENT_TAXNO
- CLIENT_REP
- CONTRACTOR_NAME
- CONTRACTOR_ADDRESS
- CONTRACTOR_REGNO
- CONTRACTOR_TAXNO

Ha egy adat nem ismert, értéke legyen üres string.
Ne adj magyarázatot.
"""

    response = call_openai(
        model="gpt-4o-mini",
        system_prompt=(
            "Te egy magyar jogi adatfeldolgozó asszisztens vagy. "
            "Szabad szöveges szerződő feleket strukturált jogi mezőkre bontasz."
        ),
        user_prompt=prompt,
        temperature=0.0,
        max_tokens=400,
    )

    data = json.loads(response["content"])
    _NORMALIZE_CACHE[key] = data

    return data
