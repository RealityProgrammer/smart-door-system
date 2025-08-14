from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.facial_recognition import add_face, recognize_face, get_faces_info
from services.camera_service import get_camera_list, select_camera
from services.firebase_service import add_visitor_log, get_visitor_logs
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

class FaceAddRequest(BaseModel):
    name: str
    image: str

class FaceRecognizeRequest(BaseModel):
    image: str

class CameraSelectRequest(BaseModel):
    camera_id: str

class VisitorAddRequest(BaseModel):
    name: str
    image_url: str

@router.post("/faces/add")
async def add_face_route(request: FaceAddRequest):
    try:
        result = add_face(request.name, request.image)
        return {"message": "Face added successfully", "result": result}
    except Exception as e:
        logger.error(f"Error adding face: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/faces/recognize")
async def recognize_face_route(request: FaceRecognizeRequest):
    try:
        result = recognize_face(request.image)
        return {"message": "Face recognition completed", "result": result}
    except Exception as e:
        logger.error(f"Error recognizing face: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/faces/info")
async def get_faces_info_route():
    try:
        faces_info = get_faces_info()
        return {"faces": faces_info, "total": len(faces_info)}
    except Exception as e:
        logger.error(f"Error getting faces info: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/cameras")
async def get_cameras_route():
    try:
        cameras = get_camera_list()
        return {"cameras": cameras}
    except Exception as e:
        logger.error(f"Error getting cameras: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/cameras/select")
async def select_camera_route(request: CameraSelectRequest):
    try:
        result = select_camera(request.camera_id)
        return {"message": "Camera selected", "result": result}
    except Exception as e:
        logger.error(f"Error selecting camera: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/visitors/add")
async def add_visitor_route(request: VisitorAddRequest):
    try:
        result = add_visitor_log(request.name, request.image_url)
        return {"message": "Visitor log added", "result": result}
    except Exception as e:
        logger.error(f"Error adding visitor: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/visitors")
async def get_visitors_route():
    try:
        visitors = get_visitor_logs()
        return {"visitors": visitors}
    except Exception as e:
        logger.error(f"Error getting visitors: {e}")
        raise HTTPException(status_code=500, detail=str(e))