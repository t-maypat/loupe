from anthropic import Anthropic

from app.core.config import settings


client = Anthropic(api_key=settings.anthropic_api_key)


def generate_answer(system_prompt: str, user_prompt: str) -> str:
    message = client.messages.create(
        model=settings.anthropic_model,
        max_tokens=900,
        temperature=0.2,
        system=system_prompt,
        messages=[{"role": "user", "content": user_prompt}],
    )

    if not message.content:
        return ""

    return message.content[0].text
