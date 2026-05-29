import logging

from fastapi import APIRouter, HTTPException

from app.models import IngestRequest, IngestResponse
from app.services.ingest import ingest_documents
from app.services.public_access import public_access_service


router = APIRouter(prefix="/ingest", tags=["ingest"])


@router.post("", response_model=IngestResponse)
def ingest(request: IngestRequest) -> IngestResponse:
    public_access_service.enforce_ingest_access()
    try:
        ingested, chunks = ingest_documents(request.paths, request.documents)
        return IngestResponse(ingested=ingested, chunks=chunks)
    except Exception as exc:  # noqa: BLE001
        logging.exception("Ingest failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc
