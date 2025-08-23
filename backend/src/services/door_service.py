import os
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from supabase import create_client, Client
import asyncio

logger = logging.getLogger(__name__)

class DoorService:
    def __init__(self):
        self.supabase_url = os.getenv("SUPABASE_URL")
        self.supabase_key = os.getenv("SUPABASE_ANON_KEY")
        
        if not self.supabase_url or not self.supabase_key:
            raise ValueError("Supabase credentials not found in environment variables")
            
        self.client: Client = create_client(self.supabase_url, self.supabase_key)
        
    async def register_device(self, device_id: str, device_type: str, ip_address: str, status: str):
        """Register or update device in Supabase"""
        try:
            device_data = {
                "device_id": device_id,
                "device_type": device_type,
                "ip_address": ip_address,
                "status": status,
                "last_seen": datetime.now().isoformat(),
                "registered_at": datetime.now().isoformat()
            }
            
            # Upsert device (insert or update)
            result = self.client.table("door_devices").upsert(
                device_data,
                on_conflict="device_id"
            ).execute()
            
            logger.info(f"Device {device_id} registered successfully")
            return result.data[0] if result.data else None
            
        except Exception as e:
            logger.error(f"Error registering device {device_id}: {e}")
            raise
    
    async def send_door_command(self, device_id: str, command: str, recognized_name: Optional[str] = None):
        """Send command to specific device"""
        try:
            command_data = {
                "device_id": device_id,
                "command": command,
                "recognized_name": recognized_name,
                "status": "pending",
                "created_at": datetime.now().isoformat(),
                "expires_at": (datetime.now() + timedelta(minutes=1)).isoformat()
            }
            
            result = self.client.table("door_commands").insert(command_data).execute()
            
            logger.info(f"Command {command} sent to device {device_id}")
            return result.data[0] if result.data else None
            
        except Exception as e:
            logger.error(f"Error sending command to {device_id}: {e}")
            raise
    
    async def get_pending_command(self, device_id: str):
        """Get pending command for device"""
        try:
            # Get most recent pending command that hasn't expired
            result = self.client.table("door_commands").select("*").eq(
                "device_id", device_id
            ).eq(
                "status", "pending"
            ).gt(
                "expires_at", datetime.now().isoformat()
            ).order(
                "created_at", desc=True
            ).limit(1).execute()
            
            if result.data:
                return result.data[0]
            return None
            
        except Exception as e:
            logger.error(f"Error getting command for {device_id}: {e}")
            raise
    
    async def acknowledge_command(self, device_id: str, timestamp: int, status: str):
        """Mark command as acknowledged"""
        try:
            # Update most recent pending command
            result = self.client.table("door_commands").update({
                "status": "executed",
                "executed_at": datetime.now().isoformat(),
                "device_timestamp": timestamp
            }).eq(
                "device_id", device_id
            ).eq(
                "status", "pending"
            ).execute()
            
            logger.info(f"Command acknowledged by device {device_id}")
            return result.data
            
        except Exception as e:
            logger.error(f"Error acknowledging command for {device_id}: {e}")
            raise
    
    async def update_door_status(self, device_id: str, door_status: str, timestamp: int):
        """Update device door status"""
        try:
            status_data = {
                "device_id": device_id,
                "door_status": door_status,
                "device_timestamp": timestamp,
                "server_timestamp": datetime.now().isoformat()
            }
            
            # Insert status log
            result = self.client.table("door_status_log").insert(status_data).execute()
            
            # Update device current status
            self.client.table("door_devices").update({
                "current_door_status": door_status,
                "last_status_update": datetime.now().isoformat(),
                "last_seen": datetime.now().isoformat()
            }).eq("device_id", device_id).execute()
            
            logger.info(f"Door status updated for {device_id}: {door_status}")
            return result.data[0] if result.data else None
            
        except Exception as e:
            logger.error(f"Error updating status for {device_id}: {e}")
            raise
    
    async def get_all_devices(self):
        """Get all registered devices"""
        try:
            result = self.client.table("door_devices").select("*").execute()
            return result.data
            
        except Exception as e:
            logger.error(f"Error getting devices: {e}")
            raise
    
    async def get_device_status(self, device_id: str):
        """Get device current status"""
        try:
            result = self.client.table("door_devices").select("*").eq(
                "device_id", device_id
            ).single().execute()
            
            return result.data
            
        except Exception as e:
            logger.error(f"Error getting device status for {device_id}: {e}")
            raise

# Global instance
door_service = DoorService()