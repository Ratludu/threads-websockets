import socketio
import json

mgr = socketio.AsyncRedisManager("redis://localhost:6379/0")

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=[],
    transport=["websocket"],
    logger=True,
    engineio_logger=True,
    client_manager=mgr,
)

app = socketio.ASGIApp(sio)


@sio.event()
async def connect(sid, environ, auth):
    print("connet", sid)


@sio.event()
async def subscribe_thread(sid, data):
    data = json.loads(data)
    thread_id = data["thread_id"]
    await sio.enter_room(sid, f"thread:{thread_id}")


@sio.event()
async def unsubscribe_thread(sid, data):
    data = json.loads(data)
    thread_id = data["thread_id"]
    await sio.leave_room(sid, f"thread:{thread_id}")


@sio.event()
async def new_comment(data):
    print("$" * 234)
    data = json.loads(data)
    thread_id = data["thread_id"]
    await sio.emit("new_comment", data, room=f"thread:{thread_id}")


@sio.event()
async def message(sid, data):
    await sio.emit("message", "hello")


@sio.event()
async def disconnect(sid, reason):
    print("disconnect", sid, reason)
