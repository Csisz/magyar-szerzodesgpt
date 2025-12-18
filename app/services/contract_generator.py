from app.utils.template_loader import load_contract_template
from app.services.prompt_builder import build_contract_prompt
from app.services.openai_service import call_openai


def generate_contract(
    contract_type: str,
    mode: str,
    form_data: dict,
):

    if mode not in ("fast", "detailed"):
        raise ValueError("generation_mode must be 'fast' or 'detailed'")

    template_html = load_contract_template(contract_type, mode)

    prompt = build_contract_prompt(
        template_html=template_html,
        form_data=form_data,
        mode=mode,
    )

    model = "gpt-4o-mini" if mode == "fast" else "gpt-4o"

    response = call_openai(
        model=model,
        system_prompt="Te egy magyar jogra specializált szerződésgenerátor vagy.",
        user_prompt=prompt,
        temperature=0.2 if mode == "fast" else 0.3,
    )

    return {
        "contract_html": response["content"],
        "summary_hu": "A szerződés a megadott adatok alapján került kitöltésre."
    }
