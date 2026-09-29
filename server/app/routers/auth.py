from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, require_roles
from ..models import User
from ..schemas import LoginRequest
from ..utils import hash_password, sign, verify_password, needs_rehash

router = APIRouter(tags=["auth"])


@router.post("/auth/login")
def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == request.username, User.active == True).first()  # noqa: E712
    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(request.password)
        db.commit()
    return {"token": sign(user.username), "user": {
        "username": user.username,
        "display_name": user.display_name,
        "role": user.role,
        "business_line": user.business_line,
    }}


@router.get("/auth/me")
def me(user: User = Depends(get_current_user)):
    return {
        "username": user.username,
        "display_name": user.display_name,
        "role": user.role,
        "business_line": user.business_line,
    }


@router.get("/admin/users")
def list_users(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    require_roles(user)
    return [{
        "username": item.username,
        "display_name": item.display_name,
        "role": item.role,
        "business_line": item.business_line,
        "active": item.active,
    } for item in db.query(User).order_by(User.id).all()]
