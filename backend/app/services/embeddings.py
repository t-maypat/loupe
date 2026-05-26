from fastembed import TextEmbedding

from app.core.config import settings


class EmbeddingService:
    def __init__(self, model_name: str) -> None:
        self.model = TextEmbedding(model_name)

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        vectors = self.model.embed(texts)
        return [vector.tolist() for vector in vectors]


embedding_service = EmbeddingService(settings.embedding_model)
