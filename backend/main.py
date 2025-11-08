import os
import redis
import asyncio
import json
from typing import List
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from comments import Comment
from manager import ConnectionManger

# Redis client for data storage and pub/sub
redis_client = redis.Redis(
    host=os.getenv("REDIS_HOST", "localhost"),
    port=int(os.getenv("REDIS_PORT", 6379)),
    db=0,
    decode_responses=True
)

app = FastAPI(
    title="WebSocket Threads API",
    description="Real-time thread comments with WebSockets",
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Frontend URL
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

manager = ConnectionManger()

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


@app.post("/threads/{thread_id}/comments/", response_model=Comment)
async def create_comment(thread_id: str, body: Comment) -> Comment:
    """
    Creates the comment onto the associated thread.
    """
    # created the comment object
    comment = Comment(**body.model_dump())
    comment.thread_id = thread_id

    comment_to_dict = comment.model_dump(mode="json")

    # Store in redis
    redis_client.hset(f"comment:{comment.comment_id}", mapping=comment_to_dict)
    redis_client.lpush(f"thread:{thread_id}", f"comment:{comment.comment_id}")

    # Create message for pub/sub
    message = {
        "type": "new_comment",
        "thread_id": thread_id,
        "comment": comment_to_dict,
    }

    redis_client.publish(f"thread:{thread_id}", json.dumps(message))

    return comment


@app.get("/threads/{thread_id}/comments/", response_model=List[Comment])
async def get_comments(thread_id: str) -> List[Comment]:
    lookup = f"thread:{thread_id}"
    comment_ids = redis_client.lrange(lookup, 0, -1)
    if comment_ids is None:
        raise HTTPException(404, "could not find thread")

    comments = []
    for comment_id in comment_ids:
        comment = redis_client.hgetall(comment_id)
        comments.append(Comment(**comment))

    return comments


@app.websocket("/ws/{thread_id}/comments/")
async def websocket_thread_endpoint(websocket: WebSocket, thread_id: str):
    # accept connection
    await manager.connect(websocket)

    # subscribe to event of thread topic
    pubsub = redis_client.pubsub()
    pubsub.subscribe(f"thread:{thread_id}")

    # event loop
    try:
        while True:
            message = pubsub.get_message(timeout=0.1)
            if message and message["type"] == "message":
                data = json.loads(message["data"])
                print(data)
                await manager.send_personal_message(data["comment"], websocket)
                # await manager.broadcast(data["comment"], websocket)
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        print(f"Websocket closed for thread: {thread_id}")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        manager.disconnect(websocket)
        pubsub.unsubscribe(f"thread:{thread_id}")
        pubsub.close()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
