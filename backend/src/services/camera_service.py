from fastapi import HTTPException
import cv2

class CameraService:
    def __init__(self):
        self.cameras = self.get_available_cameras()

    def get_available_cameras(self):
        available_cameras = []
        index = 0
        while True:
            cap = cv2.VideoCapture(index)
            if not cap.isOpened():
                break
            available_cameras.append(index)
            cap.release()
            index += 1
        return available_cameras

    def select_camera(self, camera_index):
        if camera_index not in self.cameras:
            raise HTTPException(status_code=404, detail="Camera not found")
        self.current_camera = camera_index

    def stream_camera(self):
        if not hasattr(self, 'current_camera'):
            raise HTTPException(status_code=400, detail="No camera selected")
        
        cap = cv2.VideoCapture(self.current_camera)
        if not cap.isOpened():
            raise HTTPException(status_code=500, detail="Failed to open camera")

        while True:
            ret, frame = cap.read()
            if not ret:
                break
            # Here you would typically yield the frame to a WebSocket or similar
            # For now, we just display it (this is not suitable for production)
            cv2.imshow("Camera Feed", frame)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break

        cap.release()
        cv2.destroyAllWindows()