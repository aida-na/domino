from fastapi import APIRouter
from app.api.endpoints import auth, discover, friends, items, webhook, waitlist

api_router = APIRouter()

api_router.include_router(auth.router, tags=["auth"])
api_router.include_router(items.router, tags=["items"])
api_router.include_router(webhook.router, tags=["webhook"])
api_router.include_router(waitlist.router, tags=["waitlist"])
api_router.include_router(discover.router, tags=["discover"])
api_router.include_router(friends.router, tags=["friends"])
