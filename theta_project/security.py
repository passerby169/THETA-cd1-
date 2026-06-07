from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext

# 1. 极其重要的秘钥（上线时必须换成几十位的随机乱码，存在 .env 里）
SECRET_KEY = "your-super-secret-production-key-here"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7 # 门票有效期：7天

# 2. 密码加密器配置
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# 验证密码
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

# 加密密码
def get_password_hash(password):
    return pwd_context.hash(password)

# 3. 制作数字门票（JWT）
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt