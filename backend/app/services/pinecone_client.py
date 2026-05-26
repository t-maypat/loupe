from pinecone import Pinecone, ServerlessSpec

from app.core.config import settings


pc = Pinecone(api_key=settings.pinecone_api_key)

existing = pc.list_indexes().names()
if settings.pinecone_index not in existing:
    pc.create_index(
        name=settings.pinecone_index,
        dimension=settings.embedding_dim,
        metric="cosine",
        spec=ServerlessSpec(cloud=settings.pinecone_cloud, region=settings.pinecone_region),
    )

pinecone_index = pc.Index(settings.pinecone_index)
