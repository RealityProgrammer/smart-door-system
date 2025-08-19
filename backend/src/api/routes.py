from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from src.services.facial_recognition import add_face, recognize_face, get_faces_info, delete_face
from src.services.camera_service import capture_frame, get_latest_frame, initialize_camera, start_capture, stop_capture, get_available_cameras, get_camera_info
import logging
import os

logger = logging.getLogger(__name__)

router = APIRouter()

class FaceAddRequest(BaseModel):
    name: str
    image: str = None
    variation_type: str = "default"  # Thêm field này

class FaceRecognizeRequest(BaseModel):
    image: str = None  # Optional, if not provided will capture from camera

class CameraSelectRequest(BaseModel):
    camera_id: int

class FaceDeleteRequest(BaseModel):
    name: str

@router.post("/faces/add")
async def add_face_route(request: FaceAddRequest):
    """Add face using provided image from client with variation type"""
    try:
        if not request.image:
            raise HTTPException(status_code=400, detail="Image is required from client")
        
        # Validate tên người dùng - CHO PHÉP TIẾNG VIỆT
        name = request.name.strip()
        if not name or len(name) < 2:
            raise HTTPException(status_code=400, detail="Name must be at least 2 characters")
        
        import re
        # Cập nhật regex để hỗ trợ Unicode (tiếng Việt)
        if not re.match(r"^[\w\s\u00C0-\u024F\u1E00-\u1EFF]+$", name, re.UNICODE):
            raise HTTPException(status_code=400, detail="Name contains invalid characters")
        
        # Validate variation type
        variation_type = request.variation_type.strip() if request.variation_type else "default"
        if not re.match("^[a-zA-Z0-9_]+$", variation_type):
            raise HTTPException(status_code=400, detail="Variation type can only contain letters, numbers and underscore")
        
        result = add_face(name, request.image, variation_type)
        return {"success": True, "message": "Face variation added successfully", "result": result}
        
    except ValueError as e:
        logger.error(f"Validation error adding face: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error adding face: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/faces/recognize")
async def recognize_face_route(request: FaceRecognizeRequest):
    """Recognize face using provided image from client"""
    try:
        # Bắt buộc phải có image từ client
        if not request.image:
            raise HTTPException(status_code=400, detail="Image is required from client")
        
        result = recognize_face(request.image)
        return {"success": True, "message": "Face recognition completed", "result": result}
        
    except ValueError as e:
        logger.error(f"Validation error recognizing face: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error recognizing face: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/faces/add-realtime")
async def add_face_realtime(request: FaceAddRequest):
    """Add face using real-time camera capture"""
    try:
        logger.info(f"Adding face realtime for: {request.name}")
        
        image_data = capture_frame()
        if not image_data:
            raise HTTPException(status_code=500, detail="Cannot capture image from camera")
        
        result = add_face(request.name, image_data)
        return {"success": True, "message": "Face added successfully from camera", "result": result}
        
    except ValueError as e:
        logger.error(f"Error adding face realtime: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error adding face realtime: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/faces/recognize-realtime")
async def recognize_face_realtime():
    """Recognize face using real-time camera capture"""
    try:
        logger.info("Recognizing face realtime")
        
        image_data = capture_frame()
        if not image_data:
            raise HTTPException(status_code=500, detail="Cannot capture image from camera")
        
        result = recognize_face(image_data)
        return {"success": True, "message": "Face recognition completed from camera", "result": result}
        
    except ValueError as e:
        logger.error(f"Error recognizing face realtime: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error recognizing face realtime: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.delete("/faces/{name}")
async def delete_face_route(name: str):
    """Delete a face from database"""
    try:
        success = delete_face(name)
        if success:
            return {"success": True, "message": f"Face '{name}' deleted successfully"}
        else:
            raise HTTPException(status_code=404, detail=f"Face '{name}' not found")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting face: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/faces/info")
async def get_faces_info_route():
    """Get information about all faces with Supabase URLs"""
    try:
        faces_info = get_faces_info()
        
        # Ensure all variations have image_url field
        for person in faces_info:
            if 'variations' in person:
                for variation in person['variations']:
                    if 'image_url' not in variation and 'image_path' in variation:
                        # Fallback: generate URL from path if needed
                        filename = os.path.basename(variation['image_path'])
                        variation['image_url'] = f"/api/images/{filename}"
        
        return {
            "success": True, 
            "faces": faces_info, 
            "total": len(faces_info)
        }
    except Exception as e:
        logger.error(f"Error getting faces info: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Add endpoint to serve local images as fallback
@router.get("/images/{filename}")
async def serve_image(filename: str):
    """Serve local image files as fallback"""
    try:
        from fastapi.responses import FileResponse
        image_path = os.path.join("data/faces", filename)
        
        if os.path.exists(image_path):
            return FileResponse(image_path, media_type="image/jpeg")
        else:
            raise HTTPException(status_code=404, detail="Image not found")
            
    except Exception as e:
        logger.error(f"Error serving image: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "Smart Door System API",
        "version": "2.0.0",
        "face_recognition": "DeepFace"
    }

@router.get("/faces/{name}/variations")
async def get_face_variations(name: str):
    """Get all variations for a specific person"""
    try:
        faces_info = get_faces_info()
        
        for person in faces_info:
            if person['name'] == name:
                variations = person.get('variations', [])
                return {
                    "success": True,
                    "name": name,
                    "variations": variations,
                    "total_variations": len(variations)
                }
        
        raise HTTPException(status_code=404, detail=f"Person '{name}' not found")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting face variations: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.delete("/faces/{name}/variations/{variation_type}")
async def delete_face_variation(name: str, variation_type: str):
    """Delete a specific variation of a person"""
    try:
        from services.facial_recognition import facial_recognition_service
        success = facial_recognition_service.delete_face_variation(name, variation_type)
        
        if success:
            return {"success": True, "message": f"Variation '{variation_type}' deleted for '{name}'"}
        else:
            raise HTTPException(status_code=404, detail=f"Variation '{variation_type}' not found for '{name}'")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting face variation: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")