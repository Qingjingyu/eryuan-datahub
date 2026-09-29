from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session
from .database import get_db
from .models import User, AuditLog, Asset
from .utils import verify_token


def get_current_user(authorization: str = Header(default=""), db: Session = Depends(get_db)) -> User:
    token = authorization.replace("Bearer ", "").strip()
    username = verify_token(token)
    if not username:
        raise HTTPException(status_code=401, detail="未登录或 token 无效")
    user = db.query(User).filter(User.username == username, User.active == True).first()  # noqa: E712
    if not user:
        raise HTTPException(status_code=401, detail="用户不存在或已停用")
    return user


def require_roles(user: User, *roles: str) -> None:
    if user.role == "admin" or user.role in roles:
        return
    raise HTTPException(status_code=403, detail="当前角色无权执行此操作")


def can_read(user: User, asset: Asset) -> bool:
    if user.role == "admin":
        return True
    if asset.visibility == "public":
        return True
    if asset.owner in {user.username, user.display_name}:
        return True
    return asset.visibility == "business" and asset.business_line == user.business_line


def can_mutate(user: User, asset: Asset) -> bool:
    return user.role in {"admin", "reviewer", "editor"} or asset.owner in {user.username, user.display_name}


def audit(
    db: Session,
    user: User | None,
    action: str,
    resource: str = "",
    asset_id: str = "",
    before=None,
    after=None,
    reason: str = "",
) -> None:
    db.add(AuditLog(
        actor=user.username if user else "system",
        actor_type="user" if user else "system",
        action=action,
        resource=resource,
        asset_id=asset_id,
        before_state=before or {},
        after_state=after or {},
        reason=reason,
    ))
