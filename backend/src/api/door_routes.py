from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import logging
from datetime import datetime, timedelta
import asyncio
from src.services.door_service import door_service

logger = logging.getLogger(__name__)
door_router = APIRouter(prefix="/door", tags=["door"])

class DeviceRegistration(BaseModel):
    device_id: str
    device_type: str
    ip_address: str
    status: str

class DoorCommand(BaseModel):
    device_id: str
    command: str
    recognized_name: Optional[str] = None
    timestamp: Optional[datetime] = None

class DoorStatus(BaseModel):
    device_id: str
    door_status: str
    timestamp: int

class CommandAcknowledgment(BaseModel):
    device_id: str
    timestamp: int
    status: str

@door_router.post("/register")
async def register_device(registration: DeviceRegistration):
    """Register ESP8266 device"""
    try:
        result = await door_service.register_device(
            registration.device_id,
            registration.device_type,
            registration.ip_address,
            registration.status
        )
        
        logger.info(f"Device registered: {registration.device_id} at {registration.ip_address}")
        
        return {
            "success": True,
            "message": "Device registered successfully",
            "device_id": registration.device_id
        }
        
    except Exception as e:
        logger.error(f"Device registration error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@door_router.get("/command/{device_id}")
async def get_door_command(device_id: str):
    """Get pending door command for device"""
    try:
        command = await door_service.get_pending_command(device_id)
        
        if command:
            return {
                "has_command": True,
                "command": command["command"],
                "recognized_name": command.get("recognized_name"),
                "timestamp": command.get("timestamp")
            }
        else:
            return {
                "has_command": False,
                "command": None
            }
            
    except Exception as e:
        logger.error(f"Get command error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@door_router.post("/acknowledge")
async def acknowledge_command(ack: CommandAcknowledgment):
    """Acknowledge command execution"""
    try:
        await door_service.acknowledge_command(
            ack.device_id,
            ack.timestamp,
            ack.status
        )
        
        return {
            "success": True,
            "message": "Command acknowledged"
        }
        
    except Exception as e:
        logger.error(f"Acknowledge error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@door_router.post("/status")
async def update_door_status(status: DoorStatus):
    """Update door status"""
    try:
        await door_service.update_door_status(
            status.device_id,
            status.door_status,
            status.timestamp
        )
        
        return {
            "success": True,
            "message": "Status updated"
        }
        
    except Exception as e:
        logger.error(f"Status update error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@door_router.post("/open")
async def open_door_command(device_id: str, recognized_name: Optional[str] = None):
    """Send open door command"""
    try:
        await door_service.send_door_command(device_id, "open_door", recognized_name)
        
        logger.info(f"Door open command sent to {device_id} for {recognized_name}")
        
        return {
            "success": True,
            "message": "Door open command sent",
            "device_id": device_id,
            "recognized_name": recognized_name
        }
        
    except Exception as e:
        logger.error(f"Open door error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@door_router.get("/devices")
async def get_registered_devices():
    """Get all registered devices"""
    try:
        devices = await door_service.get_all_devices()
        return {
            "success": True,
            "devices": devices,
            "total": len(devices)
        }
        
    except Exception as e:
        logger.error(f"Get devices error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@door_router.get("/status/{device_id}")
async def get_device_status(device_id: str):
    """Get device current status"""
    try:
        status = await door_service.get_device_status(device_id)
        return {
            "success": True,
            "device_id": device_id,
            "status": status
        }
        
    except Exception as e:
        logger.error(f"Get device status error: {e}")
        raise HTTPException(status_code=500, detail=str(e))