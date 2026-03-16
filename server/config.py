import os

from dotenv import load_dotenv

load_dotenv()

_CLIENT_APP_URLS = os.getenv("CLIENT_APP_URLS", "http://localhost:3000,https://travel-map-nine.vercel.app")
CLIENT_APP_URLS = [
    origin.strip()
    for origin in _CLIENT_APP_URLS.split(",")
    if origin.strip()
]
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret")
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")  # Project Settings → API → JWT Secret
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
PORT = int(os.getenv("PORT", "5001"))

DB_CONFIG = {
    # Prefer Supabase-specific names; keep POSTGRES_* as fallback for compatibility.
    "host": os.getenv("SUPABASE_DB_HOST") or os.getenv("POSTGRES_HOST"),
    "port": int(os.getenv("SUPABASE_DB_PORT") or os.getenv("POSTGRES_PORT", "5432")),
    "dbname": os.getenv("SUPABASE_DB_NAME") or os.getenv("POSTGRES_DB"),
    "user": os.getenv("SUPABASE_DB_USER") or os.getenv("POSTGRES_USER"),
    "password": os.getenv("SUPABASE_DB_PASSWORD") or os.getenv("POSTGRES_PASSWORD"),
    "sslmode": os.getenv("SUPABASE_DB_SSLMODE") or os.getenv("POSTGRES_SSLMODE", "require"),
}

AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME")
S3_PUBLIC_BASE_URL = os.getenv("S3_PUBLIC_BASE_URL")
