import base64
import cv2
import numpy as np
import os
import logging
import threading
import time
from typing import Dict, Optional
from src.utils.image_utils import encode_image_to_base64

logger = logging.getLogger(__name__)

class CameraService:
    def __init__(self):
        self.camera = None
        self.camera_index = 0
        self.is_capturing = False
        self.latest_frame = None
        self.capture_thread = None
        self.frame_lock = threading.Lock()
        
    def initialize_camera(self, camera_index: int = 0) -> bool:
        """Initialize camera with given index"""
        try:
            if self.camera is not None:
                self.camera.release()
            
            # Sử dụng DirectShow thay cho MSMF (Windows)
            self.camera = cv2.VideoCapture(camera_index, cv2.CAP_DSHOW)
            self.camera_index = camera_index
            
            # Set camera properties for better performance
            self.camera.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            self.camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
            self.camera.set(cv2.CAP_PROP_FPS, 30)
            self.camera.set(cv2.CAP_PROP_BUFFERSIZE, 1)  # Reduce buffer to avoid lag
            
            if not self.camera.isOpened():
                logger.error(f"Cannot open camera {camera_index}")
                return False
            
            # Test capture
            ret, frame = self.camera.read()
            if not ret or frame is None:
                logger.error(f"Cannot read from camera {camera_index}")
                self.camera.release()
                self.camera = None
                return False
            
            logger.info(f"Camera {camera_index} initialized successfully")
            return True
            
        except Exception as e:
            logger.error(f"Error initializing camera: {e}")
            return False
    
    def start_capture(self) -> bool:
        """Start continuous frame capture"""
        if self.camera is None or not self.camera.isOpened():
            if not self.initialize_camera():
                return False
        
        if self.is_capturing:
            logger.warning("Camera capture already running")
            return True
        
        self.is_capturing = True
        self.capture_thread = threading.Thread(target=self._capture_loop, daemon=True)
        self.capture_thread.start()
        
        logger.info("Camera capture started")
        return True
    
    def _capture_loop(self):
        """Continuous frame capture loop"""
        while self.is_capturing and self.camera and self.camera.isOpened():
            try:
                ret, frame = self.camera.read()
                if ret and frame is not None:
                    with self.frame_lock:
                        self.latest_frame = frame.copy()
                else:
                    logger.warning("Failed to read frame from camera")
                    
            except Exception as e:
                logger.error(f"Error in capture loop: {e}")
                
            time.sleep(0.033)  # ~30 FPS
    
    def capture_frame(self) -> Optional[str]:
        """Capture a single frame and return as base64"""
        try:
            if self.camera is None or not self.camera.isOpened():
                if not self.initialize_camera():
                    raise ValueError("Cannot initialize camera")
            
            ret, frame = self.camera.read()
            if not ret or frame is None:
                raise ValueError("Cannot capture frame from camera")
            
            # Convert BGR to RGB
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            # Encode to base64
            return encode_image_to_base64(frame_rgb, format='JPEG', quality=90)
            
        except Exception as e:
            logger.error(f"Error capturing frame: {e}")
            return None
    
    def get_latest_frame(self) -> Optional[str]:
        """Get the latest frame from continuous capture"""
        try:
            with self.frame_lock:
                if self.latest_frame is None:
                    return self.capture_frame()
                
                # Convert BGR to RGB
                frame_rgb = cv2.cvtColor(self.latest_frame, cv2.COLOR_BGR2RGB)
                
                # Encode to base64
                return encode_image_to_base64(frame_rgb, format='JPEG', quality=90)
                
        except Exception as e:
            logger.error(f"Error getting latest frame: {e}")
            return None
    
    def stop_capture(self):
        """Stop continuous capture"""
        self.is_capturing = False
        if self.capture_thread:
            self.capture_thread.join(timeout=1.0)
        logger.info("Camera capture stopped")
    
    def release_camera(self):
        """Release camera resources"""
        self.stop_capture()
        if self.camera is not None:
            self.camera.release()
            self.camera = None
        
        with self.frame_lock:
            self.latest_frame = None
            
        logger.info("Camera released")
    
    def get_available_cameras(self) -> Dict[int, str]:
        """Get list of available cameras"""
        cameras = {}
        
        for i in range(10):  # Check first 10 camera indices
            try:
                cap = cv2.VideoCapture(i)
                if cap.isOpened():
                    ret, frame = cap.read()
                    if ret and frame is not None:
                        # Get camera properties
                        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                        fps = int(cap.get(cv2.CAP_PROP_FPS))
                        
                        cameras[i] = f"Camera {i} ({width}x{height} @ {fps}fps)"
                    else:
                        cameras[i] = f"Camera {i} (No signal)"
                
                cap.release()
                
            except Exception as e:
                logger.debug(f"Error checking camera {i}: {e}")
                continue
        
        return cameras
    
    def get_camera_info(self) -> Dict:
        """Get current camera information"""
        if self.camera is None or not self.camera.isOpened():
            return {"status": "not_initialized"}
        
        try:
            return {
                "status": "active",
                "index": self.camera_index,
                "width": int(self.camera.get(cv2.CAP_PROP_FRAME_WIDTH)),
                "height": int(self.camera.get(cv2.CAP_PROP_FRAME_HEIGHT)),
                "fps": int(self.camera.get(cv2.CAP_PROP_FPS)),
                "is_capturing": self.is_capturing
            }
        except Exception as e:
            logger.error(f"Error getting camera info: {e}")
            return {"status": "error", "error": str(e)}

# Create global instance
camera_service = CameraService()

# Wrapper functions for backward compatibility
def capture_frame():
    return camera_service.capture_frame()

def get_latest_frame():
    return camera_service.get_latest_frame()

def initialize_camera(camera_index: int = 0):
    return camera_service.initialize_camera(camera_index)

def start_capture():
    return camera_service.start_capture()

def stop_capture():
    camera_service.stop_capture()

def get_available_cameras():
    return camera_service.get_available_cameras()

def get_camera_info():
    return camera_service.get_camera_info()

def release_camera():
    camera_service.release_camera()