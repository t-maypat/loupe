from app.models import SourceChunk
from app.services.embeddings import embedding_service
from app.services.pinecone_client import pinecone_index


def retrieve_chunks(query: str, top_k: int) -> list[SourceChunk]:
    query_vector = embedding_service.embed_texts([query])[0]
    response = pinecone_index.query(vector=query_vector, top_k=top_k, include_metadata=True)

    chunks: list[SourceChunk] = []
    for match in response.matches or []:
        metadata = match.metadata or {}
        chunks.append(
            SourceChunk(
                chunk_id=match.id,
                score=float(match.score or 0),
                title=metadata.get("title"),
                source=metadata.get("source"),
                text=metadata.get("text") or "",
            )
        )

    return chunks
