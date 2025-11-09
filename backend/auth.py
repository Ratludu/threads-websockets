from passlib.context import CryptContext
from dotenv import load_dotenv
from jose import JWTError, jwt
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from datetime import datetime, timedelta
import os

load_dotenv()


SECRET = os.getenv("SECRET")
ALGO = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["bcrypt"])
security = HTTPBearer()


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, str(SECRET), algorithm=ALGO)


def verify_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, str(SECRET), algorithms=[ALGO])
        return payload
    except JWTError:
        raise HTTPException(401, "Invalid Credentials")


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    token = credentials.credentials
    payload = verify_token(token)
    username = payload.get("sub")
    if not username:
        raise HTTPException(401, "Invalid Token")
    return {"username": username, "user_id": payload.get("user_id")}
