from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import BusinessLine, User
from ..services.asset_service import ASSET_TYPES, STATUSES

router = APIRouter(tags=["meta"])


@router.get("/meta/options")
def options(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return {
        "business_lines": [{"name": item.name, "slug": item.slug} for item in db.query(BusinessLine).order_by(BusinessLine.name).all()],
        "statuses": STATUSES,
        "asset_types": ASSET_TYPES,
        "visibilities": ["public", "business", "private"],
        "roles": ["admin", "reviewer", "editor", "member"],
    }
