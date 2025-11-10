import os
from uuid import UUID, uuid4
import redis
from typing import List
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware

from auth import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from comments import Comment
from users import UserLogin, UserResponse
from sockets import app as sockets_app
from sockets import sio

# Redis client for data storage and pub/sub
redis_client = redis.Redis(
    host=os.getenv("REDIS_HOST", "localhost"),
    port=int(os.getenv("REDIS_PORT", 6379)),
    db=0,
    decode_responses=True,
)

app = FastAPI(
    title="WebSocket Threads API",
    description="Real-time thread comments with WebSockets",
)
app.mount("/socket.io", sockets_app)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Frontend URL
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


##
# Logic of WebSockets for a simple thread application.
#
# Requirements:
# - data must be stored in redis
# - a thread id will connect the clients to the WebSockets
# - people will be able to see comment on a thread topic
# - api endpoints must work with the websocket integration
# - (nice to have) a jwt example of auth
#
# User Flow:
# - select a thread to be apart of
# - see previous comments
# - see in Real-time the new comments and will be able to have a conversation with the threads functionality
#
# Data Flow:
# - User submits a comment on a thread ->
# - Hits the post endpoint and gets stored in redis, then in published to redis to forward onto suscribers ->
# - The suscribed websockt will receive the message and be broadcasted to users who have suscribed
##


@app.post("/auth/register/", response_model=UserResponse)
async def register(user: UserLogin) -> UserResponse:
    if redis_client.exists(f"username:{user.username}"):
        raise HTTPException(400, "Username already exists")

    user_id = str(uuid4())
    new_user = {
        "user_id": user_id,
        "username": user.username,
        "password": hash_password(user.password),
    }

    redis_client.hset(f"user:{user_id}", mapping=new_user)
    redis_client.set(f"username:{user.username}", user_id)

    return UserResponse(**{"user_id": UUID(user_id), "username": user.username})


@app.post("/auth/login/")
async def login(user: UserLogin):
    user_id = redis_client.get(f"username:{user.username}")
    if not user_id:
        raise HTTPException(401, "Invalid credentials")

    user_data = redis_client.hgetall(f"user:{user_id}")
    if not user_id:
        raise HTTPException(401, "Invalid credentials")

    if not verify_password(user.password, user_data["password"]):
        raise HTTPException(401, "Invalid credentials")

    token = create_access_token({"sub": user.username, "user_id": user_id})

    return {"access_token": token, "token_type": "bearer"}


@app.post("/threads/{thread_id}/comments/", response_model=Comment)
async def create_comment(
    thread_id: str, body: Comment, current_user: dict = Depends(get_current_user)
) -> Comment:
    """
    Creates the comment onto the associated thread.
    """
    # created the comment object
    comment = Comment(**body.model_dump())
    comment.thread_id = thread_id
    comment.author = current_user["username"]

    comment_to_dict = comment.model_dump(mode="json")

    # Store in redis
    redis_client.hset(f"comment:{comment.comment_id}", mapping=comment_to_dict)
    redis_client.lpush(f"thread:{thread_id}", f"comment:{comment.comment_id}")

    # Create message for pub/sub
    message = {
        "event": "new_comment",
        "thread_id": thread_id,
        "data": comment_to_dict,
    }

    await sio.emit("new_comment", message, room=f"thread:{thread_id}")

    return comment


@app.delete("/threads/{thread_id}/comments/{comment_id}/")
async def delete_comment(
    thread_id: str, comment_id: str, current_user: dict = Depends(get_current_user)
):
    """
    Creates the comment onto the associated thread.
    """

    # Store in redis
    response = redis_client.delete(f"comment:{comment_id}")
    redis_client.lrem(f"thread:{thread_id}", 1, f"comment:{comment_id}")

    # Create message for pub/sub
    message = {
        "event": "delete_comment",
        "thread_id": thread_id,
        "data": {"comment_id": comment_id},
    }

    await sio.emit("delete_comment", message, room=f"thread:{thread_id}")

    return {"status": "ok"}


@app.get("/threads/{thread_id}/comments/", response_model=List[Comment])
async def get_comments(
    thread_id: str, current_user: dict = Depends(get_current_user)
) -> List[Comment]:
    lookup = f"thread:{thread_id}"
    comment_ids = redis_client.lrange(lookup, 0, -1)
    if comment_ids is None:
        raise HTTPException(404, "could not find thread")

    comments = []
    for comment_id in comment_ids:
        comment = redis_client.hgetall(comment_id)
        comments.append(Comment(**comment))

    return comments


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
