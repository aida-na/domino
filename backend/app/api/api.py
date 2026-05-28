from fastapi import APIRouter
from app.api.endpoints import auth, items, webhook, waitlist

api_router = APIRouter()

api_router.include_router(auth.router, tags=["auth"])
api_router.include_router(items.router, tags=["items"])
api_router.include_router(webhook.router, tags=["webhook"])
api_router.include_router(waitlist.router, tags=["waitlist"])
