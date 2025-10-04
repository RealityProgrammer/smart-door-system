from fastapi import WebSocket, WebSocketDisconnect
from collections import defaultdict
from typing import Callable, List, Dict, Optional
import logging

from starlette.websockets import WebSocketState

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.callbacks: Dict[str, List[Callable]] = defaultdict(list)

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

        for callback in self.callbacks['connect']:
            await callback(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

        for callback in self.callbacks['disconnect']:
            callback(websocket)

    async def send_message(self, message: str):
        for connection in self.active_connections:
            if connection.client_state == WebSocketState.CONNECTED:
                await connection.send_text(message)

        for callback in self.callbacks['message']:
            await callback(message)

    def on(self, event: str, func: Optional[Callable] = None):
        def subscribe(func: Callable):
            if not callable(func):
                raise ValueError("Argument func must be callable.")
            self.callbacks[event].append(func)
            return func

        if func is None:
            return subscribe
        subscribe(func)

websocket_manager = ConnectionManager()

@websocket_manager.on('message')
async def _debug_message(message: str):
    logger.info(f"Received: {message}")

async def websocket_endpoint(websocket: WebSocket):
    await websocket_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            await websocket_manager.send_message(data)
    except WebSocketDisconnect:
        websocket_manager.disconnect(websocket)