import os
import logging
import base64
from typing import Optional
from supabase import create_client, Client
from datetime import datetime
from dotenv import load_dotenv
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '../../.env'))

logger = logging.getLogger(__name__)

class SupabaseService:
    def __init__(self):
        self.supabase_url = os.getenv("SUPABASE_URL")
        self.supabase_key = os.getenv("SUPABASE_ANON_KEY") 
        
        if not self.supabase_url or not self.supabase_key:
            raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY must be set in environment variables")
        
        self.client: Client = create_client(self.supabase_url, self.supabase_key)
        self.bucket_name = "faces"
        
        logger.info("Supabase service initialized")
    
    def upload_image(self, image_base64: str, file_name: str) -> Optional[str]:
        """
        Upload image to Supabase Storage
        Returns public URL if successful, None if failed
        """
        try:
            # Remove data URL prefix if present
            if image_base64.startswith('data:image'):
                image_base64 = image_base64.split(',')[1]
            
            # Decode base64 to bytes
            image_bytes = base64.b64decode(image_base64)
            
            # Upload to Supabase Storage
            result = self.client.storage.from_(self.bucket_name).upload(
                path=file_name,
                file=image_bytes,
                file_options={
                    "content-type": "image/jpeg",
                    "cache-control": "3600"
                }
            )
            logger.info(f"Supabase upload response: {result}")  # Log ra file log
            if result:
                # Get public URL
                public_url = self.client.storage.from_(self.bucket_name).get_public_url(file_name)
                logger.info(f"Image uploaded successfully: {file_name}")
                return public_url
            else:
                logger.error(f"Failed to upload image: {result}")
                return None
                
        except Exception as e:
            logger.error(f"Error uploading image to Supabase: {e}")
            return None
    
    def delete_image(self, file_name: str) -> bool:
        """Delete image from Supabase Storage"""
        try:
            result = self.client.storage.from_(self.bucket_name).remove([file_name])
            
            if result:
                logger.info(f"Image deleted successfully: {file_name}")
                return True
            else:
                logger.error(f"Failed to delete image: {file_name}")
                return False
                
        except Exception as e:
            logger.error(f"Error deleting image from Supabase: {e}")
            return False
    
    def get_public_url(self, file_name: str) -> str:
        """Get public URL for a file"""
        return self.client.storage.from_(self.bucket_name).get_public_url(file_name)
    
    def list_images(self, path: str = "") -> list:
        """List all images in bucket"""
        try:
            result = self.client.storage.from_(self.bucket_name).list(path)
            return result
        except Exception as e:
            logger.error(f"Error listing images: {e}")
            return []

# Create global instance
supabase_service = SupabaseService()