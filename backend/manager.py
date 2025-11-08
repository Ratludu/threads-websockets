from typing import Dict, Set
from fastapi import WebSocket


class ConnectionManger:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def send_personal_message(
        self, message: Dict[str, str], websocket: WebSocket
    ):
        await websocket.send_json(message)

    async def broadcast(self, message: Dict[str, str], websocket: WebSocket):
        for connection in self.active_connections:
            if connection is not websocket:
                await connection.send_json(message)
