from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import User
from ..schemas import AskRequest, SearchRequest
from ..services.search_service import answer_question, search_assets

router = APIRouter(tags=["knowledge"])


@router.get("/search")
def search_get(
    q: str = "",
    top_k: int = 10,
    business_line: str = "",
    asset_type: str = "",
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return search_assets(db, user, q, top_k, business_line, asset_type)


@router.post("/search")
def search_post(request: SearchRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return search_assets(db, user, request.query, request.top_k, request.business_line, request.asset_type)


@router.post("/ask")
def ask(request: AskRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return answer_question(db, user, request.query)
