from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from ..utils import verify_token


def current_user(authorization: str = Header(default=""), db: Session = Depends(get_db)) -> User:
    token = authorization.replace("Bearer ", "").strip()
    username = verify_token(token)
    if not username:
        raise HTTPException(status_code=401, detail="未登录或 token 无效")
    user = db.query(User).filter(User.username == username, User.active == True).first()
    if not user:
        raise HTTPException(status_code=401, detail="用户不存在或已停用")
    return user


def require_roles(user: User, *roles: str) -> None:
    if "admin" in user.role or user.role in roles:
        return
    raise HTTPException(status_code=403, detail="当前角色无权执行此操作")
