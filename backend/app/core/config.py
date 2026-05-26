from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    api_title: str = "Atlas RAG Studio"
    api_version: str = "0.1.0"

    anthropic_api_key: str
    anthropic_model: str = "claude-3-5-sonnet-20241022"

    pinecone_api_key: str
    pinecone_index: str = "atlas-rag"
    pinecone_cloud: str = "aws"
    pinecone_region: str = "us-east-1"

    embedding_model: str = "BAAI/bge-small-en-v1.5"
    embedding_dim: int = 384

    max_chunk_chars: int = 1200
    chunk_overlap: int = 200

    cors_origins: list[str] = ["http://localhost:5173"]


settings = Settings()
