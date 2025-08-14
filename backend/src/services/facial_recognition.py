import base64
import cv2
import numpy as np
import face_recognition
import os
import pickle
import json
from typing import Dict, List, Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class FacialRecognitionService:
    def __init__(self):
        self.known_face_encodings = []
        self.known_face_names = []
        self.faces_db_path = "data/faces_db.pkl"
        self.faces_info_path = "data/faces_info.json"
        self.load_known_faces()
        
        # Tạo thư mục data nếu chưa có
        os.makedirs("data", exist_ok=True)
    
    def load_known_faces(self):
        """Tải dữ liệu khuôn mặt đã lưu"""
        try:
            if os.path.exists(self.faces_db_path):
                with open(self.faces_db_path, 'rb') as f:
                    data = pickle.load(f)
                    self.known_face_encodings = data.get('encodings', [])
                    self.known_face_names = data.get('names', [])
                logger.info(f"Đã tải {len(self.known_face_names)} khuôn mặt từ database")
            else:
                logger.info("Chưa có database khuôn mặt, tạo mới")
        except Exception as e:
            logger.error(f"Lỗi khi tải database khuôn mặt: {e}")
            self.known_face_encodings = []
            self.known_face_names = []
    
    def save_known_faces(self):
        """Lưu dữ liệu khuôn mặt"""
        try:
            data = {
                'encodings': self.known_face_encodings,
                'names': self.known_face_names
            }
            with open(self.faces_db_path, 'wb') as f:
                pickle.dump(data, f)
            logger.info("Đã lưu database khuôn mặt")
        except Exception as e:
            logger.error(f"Lỗi khi lưu database khuôn mặt: {e}")
    
    def save_face_info(self, name: str, image_path: str):
        """Lưu thông tin khuôn mặt"""
        try:
            face_info = {
                'name': name,
                'image_path': image_path,
                'added_date': datetime.now().isoformat(),
                'recognition_count': 0
            }
            
            faces_info = []
            if os.path.exists(self.faces_info_path):
                with open(self.faces_info_path, 'r', encoding='utf-8') as f:
                    faces_info = json.load(f)
            
            faces_info.append(face_info)
            
            with open(self.faces_info_path, 'w', encoding='utf-8') as f:
                json.dump(faces_info, f, ensure_ascii=False, indent=2)
                
        except Exception as e:
            logger.error(f"Lỗi khi lưu thông tin khuôn mặt: {e}")
    
    def decode_image(self, image_base64: str) -> np.ndarray:
        """Decode base64 image thành numpy array"""
        try:
            # Loại bỏ header "data:image/jpeg;base64," nếu có
            if ',' in image_base64:
                image_base64 = image_base64.split(',')[1]
            
            img_data = base64.b64decode(image_base64)
            np_arr = np.frombuffer(img_data, np.uint8)
            img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
            
            if img is None:
                raise ValueError("Không thể decode ảnh")
            
            return img
        except Exception as e:
            logger.error(f"Lỗi decode ảnh: {e}")
            raise ValueError(f"Lỗi decode ảnh: {e}")
    
    def extract_face_encoding(self, image: np.ndarray) -> Optional[np.ndarray]:
        """Trích xuất face encoding từ ảnh"""
        try:
            # Chuyển từ BGR (OpenCV) sang RGB (face_recognition)
            rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            
            # Tìm vị trí khuôn mặt
            face_locations = face_recognition.face_locations(rgb_image)
            
            if not face_locations:
                raise ValueError("Không tìm thấy khuôn mặt trong ảnh")
            
            # Trích xuất encoding cho khuôn mặt đầu tiên
            face_encodings = face_recognition.face_encodings(rgb_image, face_locations)
            
            if not face_encodings:
                raise ValueError("Không thể trích xuất đặc trưng khuôn mặt")
            
            return face_encodings[0]
            
        except Exception as e:
            logger.error(f"Lỗi trích xuất face encoding: {e}")
            raise ValueError(f"Lỗi trích xuất đặc trưng khuôn mặt: {e}")
    
    def add_face(self, name: str, image_base64: str) -> Dict:
        """Thêm khuôn mặt mới vào database"""
        try:
            # Kiểm tra tên đã tồn tại
            if name in self.known_face_names:
                raise ValueError(f"Tên '{name}' đã tồn tại trong database")
            
            # Decode ảnh
            image = self.decode_image(image_base64)
            
            # Trích xuất face encoding
            face_encoding = self.extract_face_encoding(image)
            
            # Lưu ảnh
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            image_filename = f"{name}_{timestamp}.jpg"
            image_path = f"data/faces/{image_filename}"
            
            os.makedirs("data/faces", exist_ok=True)
            cv2.imwrite(image_path, image)
            
            # Thêm vào database
            self.known_face_encodings.append(face_encoding)
            self.known_face_names.append(name)
            
            # Lưu database
            self.save_known_faces()
            self.save_face_info(name, image_path)
            
            logger.info(f"Đã thêm khuôn mặt mới: {name}")
            
            return {
                "success": True,
                "name": name,
                "total_faces": len(self.known_face_names),
                "message": f"Đã thêm khuôn mặt '{name}' thành công"
            }
            
        except Exception as e:
            logger.error(f"Lỗi thêm khuôn mặt: {e}")
            raise ValueError(str(e))
    
    def recognize_face(self, image_base64: str) -> Dict:
        """Nhận diện khuôn mặt"""
        try:
            if not self.known_face_encodings:
                return {
                    "recognized": False,
                    "name": None,
                    "confidence": 0.0,
                    "message": "Database khuôn mặt trống"
                }
            
            # Decode ảnh
            image = self.decode_image(image_base64)
            
            # Trích xuất face encoding
            unknown_encoding = self.extract_face_encoding(image)
            
            # So sánh với database
            matches = face_recognition.compare_faces(
                self.known_face_encodings, 
                unknown_encoding,
                tolerance=0.6  # Độ chính xác (thấp hơn = chặt chẽ hơn)
            )
            
            face_distances = face_recognition.face_distance(
                self.known_face_encodings, 
                unknown_encoding
            )
            
            if True in matches:
                match_index = matches.index(True)
                name = self.known_face_names[match_index]
                confidence = 1 - face_distances[match_index]  # Chuyển distance thành confidence
                
                # Cập nhật số lần nhận diện
                self.update_recognition_count(name)
                
                logger.info(f"Nhận diện thành công: {name} (confidence: {confidence:.2f})")
                
                return {
                    "recognized": True,
                    "name": name,
                    "confidence": float(confidence),
                    "message": f"Chào mừng {name}!"
                }
            else:
                logger.info("Không nhận diện được khuôn mặt")
                return {
                    "recognized": False,
                    "name": None,
                    "confidence": 0.0,
                    "message": "Khuôn mặt không được nhận diện"
                }
                
        except Exception as e:
            logger.error(f"Lỗi nhận diện khuôn mặt: {e}")
            raise ValueError(str(e))
    
    def update_recognition_count(self, name: str):
        """Cập nhật số lần nhận diện"""
        try:
            if os.path.exists(self.faces_info_path):
                with open(self.faces_info_path, 'r', encoding='utf-8') as f:
                    faces_info = json.load(f)
                
                for face_info in faces_info:
                    if face_info['name'] == name:
                        face_info['recognition_count'] += 1
                        face_info['last_recognized'] = datetime.now().isoformat()
                        break
                
                with open(self.faces_info_path, 'w', encoding='utf-8') as f:
                    json.dump(faces_info, f, ensure_ascii=False, indent=2)
                    
        except Exception as e:
            logger.error(f"Lỗi cập nhật recognition count: {e}")
    
    def get_faces_info(self) -> List[Dict]:
        """Lấy thông tin tất cả khuôn mặt"""
        try:
            if os.path.exists(self.faces_info_path):
                with open(self.faces_info_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            return []
        except Exception as e:
            logger.error(f"Lỗi lấy thông tin khuôn mặt: {e}")
            return []

# Tạo instance global
facial_recognition_service = FacialRecognitionService()

# Wrapper functions để tương thích với code cũ
def add_face(name: str, image: str):
    """Wrapper function để thêm khuôn mặt"""
    return facial_recognition_service.add_face(name, image)

def recognize_face(image: str):
    """Wrapper function để nhận diện khuôn mặt"""
    return facial_recognition_service.recognize_face(image)

def get_faces_info():
    """Lấy thông tin tất cả khuôn mặt"""
    return facial_recognition_service.get_faces_info()