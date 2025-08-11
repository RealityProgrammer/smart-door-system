from fastapi import APIRouter, HTTPException
from services.facial_recognition import add_face, recognize_face
from services.camera_service import get_camera_list, select_camera
from services.firebase_service import add_visitor_log, get_visitor_logs

router = APIRouter()

@router.post("/faces/add")
async def add_face_route(name: str, image: str):
    try:
        result = add_face(name, image)
        return {"message": "Face added successfully", "result": result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/faces/recognize")
async def recognize_face_route(image: str):
    try:
        result = recognize_face(image)
        return {"message": "Face recognized", "result": result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/cameras")
async def get_cameras_route():
    try:
        cameras = get_camera_list()
        return {"cameras": cameras}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/cameras/select")
async def select_camera_route(camera_id: str):
    try:
        result = select_camera(camera_id)
        return {"message": "Camera selected", "result": result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/visitors/add")
async def add_visitor_route(name: str, image_url: str):
    try:
        result = add_visitor_log(name, image_url)
        return {"message": "Visitor log added", "result": result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/visitors")
async def get_visitors_route():
    try:
        visitors = get_visitor_logs()
        return {"visitors": visitors}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))