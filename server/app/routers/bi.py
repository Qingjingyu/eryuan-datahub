from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import User
from ..services import bi_service as bi

router = APIRouter(prefix="/bi", tags=["bi"])


@router.get("/overview")
def overview(
    days: int = Query(default=30, ge=1, le=365),
    business_line: str = "",
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return bi.overview(db, days=days, business_line=business_line)


@router.get("/metrics")
def metrics(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return bi.overview(db)


@router.get("/assets/trend")
def trend(
    days: int = Query(default=30, ge=1, le=365),
    business_line: str = "",
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return bi.asset_trend(db, days=days, business_line=business_line)


@router.get("/assets/distribution")
def distribution(
    business_line: str = "",
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return bi.distributions(db, business_line=business_line)


@router.get("/processing")
def processing(
    business_line: str = "",
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return bi.processing_metrics(db, business_line=business_line)


@router.get("/review")
def review(
    business_line: str = "",
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return bi.review_metrics(db, business_line=business_line)


@router.get("/index")
def index(
    business_line: str = "",
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return bi.index_metrics(db, business_line=business_line)


@router.get("/search")
def search(
    business_line: str = "",
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return bi.search_metrics(db, business_line=business_line)


@router.get("/agent")
def agent(
    business_line: str = "",
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return bi.agent_metrics(db, business_line=business_line)
