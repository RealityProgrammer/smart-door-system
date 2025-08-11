from typing import List
import cv2
import numpy as np
import face_recognition

class FacialRecognitionService:
    def __init__(self):
        self.known_face_encodings = []
        self.known_face_names = []

    def add_face(self, image_path: str, name: str):
        image = face_recognition.load_image_file(image_path)
        encoding = face_recognition.face_encodings(image)[0]
        self.known_face_encodings.append(encoding)
        self.known_face_names.append(name)

    def recognize_faces(self, frame: np.ndarray) -> List[str]:
        rgb_frame = frame[:, :, ::-1]
        face_locations = face_recognition.face_locations(rgb_frame)
        face_encodings = face_recognition.face_encodings(rgb_frame, face_locations)

        recognized_names = []
        for face_encoding in face_encodings:
            matches = face_recognition.compare_faces(self.known_face_encodings, face_encoding)
            name = "Unknown"

            if True in matches:
                first_match_index = matches.index(True)
                name = self.known_face_names[first_match_index]

            recognized_names.append(name)

        return recognized_names

    def load_known_faces(self, faces_data: List[dict]):
        for face in faces_data:
            self.add_face(face['image_path'], face['name'])