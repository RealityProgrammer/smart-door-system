import os
import json
import pickle
import logging
import numpy as np
from datetime import datetime
from typing import Dict, List, Optional, Tuple
import tempfile
import cv2

# DeepFace imports
from deepface import DeepFace
import tensorflow as tf

# Local imports
from src.utils.image_utils import decode_base64_image, encode_image_to_base64
from src.config.deepface_config import DEFAULT_CONFIG, REALTIME_CONFIG, ENROLLMENT_CONFIG
from src.services.supabase_service import supabase_service

logger = logging.getLogger(__name__)

# Set TensorFlow logging level
tf.get_logger().setLevel('ERROR')
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'

class DeepFacialRecognitionService:
    def __init__(self):
        self.faces_db_path = "data/faces_db.pkl"
        self.faces_info_path = "data/faces_info.json"
        self.faces_embeddings_dir = "data/embeddings"
        self.faces_images_dir = "data/faces"
        
        # Create directories
        os.makedirs("data", exist_ok=True)
        os.makedirs(self.faces_embeddings_dir, exist_ok=True)
        os.makedirs(self.faces_images_dir, exist_ok=True)
        
        # Load existing face database
        # Thay đổi cấu trúc database
        # Từ: {name: {'embedding': array, 'image_path': str, ...}}
        # Thành: {name: {'embeddings': [array1, array2, ...], 'images': [path1, path2, ...], ...}}
        self.known_faces = {}
        self.load_known_faces()
        
        # Initialize models (warm up)
        self._initialize_models()
    
    def _initialize_models(self):
        """Initialize DeepFace models to reduce first-time loading delay"""
        try:
            logger.info("Initializing DeepFace models...")
            
            # Create a small test image
            test_image = np.random.randint(0, 255, (224, 224, 3), dtype=np.uint8)
            
            # Warm up the models
            for model_name in ['Facenet', 'Facenet512']:
                try:
                    with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp_file:
                        cv2.imwrite(tmp_file.name, cv2.cvtColor(test_image, cv2.COLOR_RGB2BGR))
                        
                        DeepFace.represent(
                            img_path=tmp_file.name,
                            model_name=model_name,
                            detector_backend='opencv',
                            enforce_detection=False
                        )
                        logger.info(f"Model {model_name} initialized successfully")
                        
                    os.unlink(tmp_file.name)
                    
                except Exception as e:
                    logger.warning(f"Failed to initialize {model_name}: {e}")
            
            logger.info("DeepFace models initialization completed")
            
        except Exception as e:
            logger.error(f"Error initializing models: {e}")
    
    def load_known_faces(self):
        """Load known faces from database"""
        try:
            if os.path.exists(self.faces_db_path):
                with open(self.faces_db_path, 'rb') as f:
                    self.known_faces = pickle.load(f)
                logger.info(f"Loaded {len(self.known_faces)} known faces from database")
            else:
                logger.info("No existing face database found, starting fresh")
                
        except Exception as e:
            logger.error(f"Error loading face database: {e}")
            self.known_faces = {}
    
    def save_known_faces(self):
        """Save known faces to database"""
        try:
            with open(self.faces_db_path, 'wb') as f:
                pickle.dump(self.known_faces, f)
            logger.info("Face database saved successfully")
            
        except Exception as e:
            logger.error(f"Error saving face database: {e}")
    
    def save_face_info(self, name: str, image_path: str, model_name: str):
        """Save face information to JSON file"""
        try:
            face_info = {
                'name': name,
                'image_path': image_path,
                'model_name': model_name,
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
            logger.error(f"Error saving face info: {e}")
    
    def extract_face_embedding(self, image: np.ndarray, config: dict = None) -> np.ndarray:
        """
        Extract face embedding using DeepFace
        """
        try:
            if config is None:
                config = DEFAULT_CONFIG
            
            logger.debug(f"Extracting embedding with model: {config['model_name']}")
            
            # Preprocess image for better face detection
            processed_image = self._preprocess_image_for_face_detection(image)
            
            # Create temp file with proper cleanup
            temp_file = None
            try:
                # Create temp file
                temp_file = tempfile.NamedTemporaryFile(suffix='.jpg', delete=False)
                temp_path = temp_file.name
                
                # Convert RGB to BGR for OpenCV
                img_bgr = cv2.cvtColor(processed_image, cv2.COLOR_RGB2BGR)
                
                # Close file handle before writing
                temp_file.close()
                
                # Write image with higher quality
                encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 95]
                success = cv2.imwrite(temp_path, img_bgr, encode_param)
                if not success:
                    raise ValueError("Failed to write temporary image")
                
                # Try multiple configurations if first fails
                configs_to_try = [config]
                
                # Add backup config with less strict settings
                if config['enforce_detection']:
                    backup_config = config.copy()
                    backup_config['enforce_detection'] = False
                    configs_to_try.append(backup_config)
                
                # Try different detector backends
                if config['detector_backend'] != 'opencv':
                    opencv_config = config.copy()
                    opencv_config['detector_backend'] = 'opencv'
                    opencv_config['enforce_detection'] = False
                    configs_to_try.append(opencv_config)
                
                last_error = None
                for attempt_config in configs_to_try:
                    try:
                        logger.debug(f"Trying config: {attempt_config}")
                        
                        # Extract embedding using DeepFace
                        embedding = DeepFace.represent(
                            img_path=temp_path,
                            model_name=attempt_config['model_name'],
                            detector_backend=attempt_config['detector_backend'],
                            enforce_detection=attempt_config['enforce_detection'],
                            align=attempt_config['align'],
                            normalization=attempt_config['normalization']
                        )
                        
                        # DeepFace returns list of embeddings (one per face)
                        if not embedding:
                            raise ValueError("No face embedding extracted")
                        
                        # Take the first face embedding
                        embedding_vector = np.array(embedding[0]['embedding'])
                        
                        logger.debug(f"Embedding extracted successfully: shape={embedding_vector.shape}")
                        return embedding_vector
                        
                    except Exception as e:
                        last_error = e
                        logger.debug(f"Config failed: {e}")
                        continue
                
                # If all configs failed, raise the last error
                raise last_error or ValueError("All face detection attempts failed")
                    
            finally:
                # Clean up temporary file
                if temp_file is not None:
                    self._safe_remove_temp_file(temp_file.name)
                            
        except Exception as e:
            logger.error(f"Error extracting face embedding: {e}")
            raise ValueError(f"Failed to extract face embedding: {e}")
    
    def _preprocess_image_for_face_detection(self, image: np.ndarray) -> np.ndarray:
        """Preprocess image to improve face detection"""
        try:
            # Ensure image is large enough
            height, width = image.shape[:2]
            min_size = 160  # Minimum size for face detection
            
            if height < min_size or width < min_size:
                # Resize image while maintaining aspect ratio
                scale = max(min_size / width, min_size / height)
                new_width = int(width * scale)
                new_height = int(height * scale)
                
                image = cv2.resize(image, (new_width, new_height), interpolation=cv2.INTER_CUBIC)
                logger.debug(f"Resized image from {width}x{height} to {new_width}x{new_height}")
            
            # Enhance contrast if image is too dark or bright
            gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
            mean_brightness = np.mean(gray)
            
            if mean_brightness < 50:  # Too dark
                # Brighten the image
                hsv = cv2.cvtColor(image, cv2.COLOR_RGB2HSV)
                hsv[:, :, 2] = cv2.add(hsv[:, :, 2], 30)  # Increase brightness
                image = cv2.cvtColor(hsv, cv2.COLOR_HSV2RGB)
                logger.debug("Enhanced brightness for dark image")
                
            elif mean_brightness > 200:  # Too bright
                # Reduce brightness
                hsv = cv2.cvtColor(image, cv2.COLOR_RGB2HSV)
                hsv[:, :, 2] = cv2.subtract(hsv[:, :, 2], 20)  # Decrease brightness
                image = cv2.cvtColor(hsv, cv2.COLOR_HSV2RGB)
                logger.debug("Reduced brightness for bright image")
            
            # Apply slight sharpening if image is blurry
            kernel = np.array([[-1,-1,-1], [-1,9,-1], [-1,-1,-1]])
            sharpened = cv2.filter2D(image, -1, kernel)
            
            # Blend original and sharpened (subtle sharpening)
            image = cv2.addWeighted(image, 0.7, sharpened, 0.3, 0)
            
            return image
            
        except Exception as e:
            logger.warning(f"Error preprocessing image: {e}")
            return image  # Return original if preprocessing fails
    
    def calculate_distance(self, embedding1: np.ndarray, embedding2: np.ndarray, metric: str = 'cosine') -> float:
        """Calculate distance between two embeddings"""
        try:
            # Validate inputs
            if embedding1 is None or embedding2 is None:
                logger.warning("One of the embeddings is None")
                return 1.0
            
            if len(embedding1) == 0 or len(embedding2) == 0:
                logger.warning("One of the embeddings is empty")
                return 1.0
            
            # Ensure embeddings are numpy arrays
            embedding1 = np.array(embedding1, dtype=np.float64)
            embedding2 = np.array(embedding2, dtype=np.float64)
            
            # Check for NaN or inf values
            if np.any(np.isnan(embedding1)) or np.any(np.isnan(embedding2)):
                logger.warning("NaN values found in embeddings")
                return 1.0
            
            if np.any(np.isinf(embedding1)) or np.any(np.isinf(embedding2)):
                logger.warning("Inf values found in embeddings")
                return 1.0
            
            if metric == 'cosine':
                # Cosine distance
                dot_product = np.dot(embedding1, embedding2)
                norm1 = np.linalg.norm(embedding1)
                norm2 = np.linalg.norm(embedding2)
                
                if norm1 == 0 or norm2 == 0 or np.isnan(norm1) or np.isnan(norm2):
                    logger.warning("Zero or NaN norm in cosine distance calculation")
                    return 1.0
                
                cosine_similarity = dot_product / (norm1 * norm2)
                
                # Clamp similarity to valid range [-1, 1]
                cosine_similarity = np.clip(cosine_similarity, -1.0, 1.0)
                
                cosine_distance = 1 - cosine_similarity
                
                # Ensure distance is finite and in valid range
                cosine_distance = np.clip(cosine_distance, 0.0, 2.0)
                
                return float(cosine_distance)
                
            elif metric == 'euclidean':
                distance = np.linalg.norm(embedding1 - embedding2)
                
                # Ensure finite value
                if np.isnan(distance) or np.isinf(distance):
                    logger.warning("Invalid euclidean distance calculated")
                    return 1000.0  # Large but finite value
                
                return float(distance)
                
            elif metric == 'euclidean_l2':
                distance = np.sqrt(np.sum((embedding1 - embedding2) ** 2))
                
                # Ensure finite value
                if np.isnan(distance) or np.isinf(distance):
                    logger.warning("Invalid euclidean_l2 distance calculated")
                    return 1000.0  # Large but finite value
                
                return float(distance)
                
            else:
                raise ValueError(f"Unsupported distance metric: {metric}")
                
        except Exception as e:
            logger.error(f"Error calculating distance: {e}")
            return 1.0  # Return safe default value
    
    def add_face(self, name: str, image_base64: str) -> Dict:
        """Add a new face to the database"""
        try:
            logger.info(f"Adding face for: {name}")
            
            # Check if name already exists
            if name in self.known_faces:
                raise ValueError(f"Name '{name}' already exists in database")
            
            # Decode image
            rgb_image = decode_base64_image(image_base64)
            
            # Validate image quality for face detection
            if not self._validate_image_for_face_detection(rgb_image):
                raise ValueError("Image quality is not suitable for face detection. Please use a clearer image with a visible face.")
            
            # Use enrollment configuration for better accuracy
            config = ENROLLMENT_CONFIG.copy()
            
            # Extract face embedding
            embedding = self.extract_face_embedding(rgb_image, config)
            
            # Validate embedding
            if embedding is None or len(embedding) == 0:
                raise ValueError("Failed to extract valid face embedding")
            
            # Check for invalid values in embedding
            if np.any(np.isnan(embedding)) or np.any(np.isinf(embedding)):
                raise ValueError("Invalid embedding values detected")
            
            # Save image
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            image_filename = f"{name}_{timestamp}.jpg"
            image_path = os.path.join(self.faces_images_dir, image_filename)
            
            # Convert RGB to BGR and save
            img_bgr = cv2.cvtColor(rgb_image, cv2.COLOR_RGB2BGR)
            success = cv2.imwrite(image_path, img_bgr)
            
            if not success:
                raise ValueError("Failed to save image")
            
            # Add to database
            self.known_faces[name] = {
                'embedding': embedding,
                'image_path': image_path,
                'model': config['model_name'],
                'added_date': datetime.now().isoformat()
            }
            
            # Save database
            self.save_known_faces()
            self.save_face_info(name, image_path, config['model_name'])
            
            logger.info(f"Successfully added face: {name}")
            
            return {
                "success": True,
                "name": name,
                "model_used": config['model_name'],
                "total_faces": len(self.known_faces),
                "message": f"Face '{name}' added successfully using {config['model_name']}"
            }
            
        except Exception as e:
            logger.error(f"Error adding face: {e}")
            raise ValueError(str(e))
    
    def add_face_embedding(self, name: str, image_base64: str, variation_type: str = "default") -> Dict:
        """
        Thêm một embedding mới cho người dùng đã tồn tại hoặc tạo mới
        """
        try:
            logger.info(f"Adding face embedding for: {name} (variation: {variation_type})")
            
            # Decode image
            rgb_image = decode_base64_image(image_base64)
            
            # Validate image quality
            if not self._validate_image_for_face_detection(rgb_image):
                raise ValueError("Image quality is not suitable for face detection")
            
            # Use enrollment configuration for better accuracy
            config = ENROLLMENT_CONFIG.copy()
            
            # Extract face embedding
            embedding = self.extract_face_embedding(rgb_image, config)
            
            # Validate embedding
            if embedding is None or len(embedding) == 0:
                raise ValueError("Failed to extract valid face embedding")
            
            if np.any(np.isnan(embedding)) or np.any(np.isinf(embedding)):
                raise ValueError("Invalid embedding values detected")
            
            # Generate file name
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            image_filename = f"{name}_{variation_type}_{timestamp}.jpg"
            
            # Upload to Supabase Storage
            image_url = supabase_service.upload_image(image_base64, image_filename)
            
            if not image_url:
                raise ValueError("Failed to upload image to cloud storage")
            
            # Also save locally as backup (optional)
            local_image_path = os.path.join(self.faces_images_dir, image_filename)
            img_bgr = cv2.cvtColor(rgb_image, cv2.COLOR_RGB2BGR)
            cv2.imwrite(local_image_path, img_bgr)
            
            # Save embedding to file
            embedding_path = os.path.join(self.faces_embeddings_dir, f"{name}_{variation_type}_{timestamp}.npy")
            np.save(embedding_path, embedding)
            
            # Add to database
            if name not in self.known_faces:
                self.known_faces[name] = {
                    'embeddings': [],
                    'images': [],
                    'image_urls': [],  # New field for Supabase URLs
                    'variations': [],
                    'model': config['model_name'],
                    'added_date': datetime.now().isoformat(),
                    'total_embeddings': 0
                }
            
            # Add new embedding and URL
            self.known_faces[name]['embeddings'].append(embedding)
            self.known_faces[name]['images'].append(local_image_path)  # Local backup
            self.known_faces[name]['image_urls'].append(image_url)     # Supabase URL
            self.known_faces[name]['variations'].append(variation_type)
            self.known_faces[name]['total_embeddings'] = len(self.known_faces[name]['embeddings'])
            self.known_faces[name]['last_updated'] = datetime.now().isoformat()
            
            # Save database
            self.save_known_faces()
            self.save_face_info_multiple(name, local_image_path, image_url, config['model_name'], variation_type)
            
            total_variations = len(self.known_faces[name]['embeddings'])
            logger.info(f"Successfully added embedding {total_variations} for {name} ({variation_type})")
            
            return {
                "success": True,
                "name": name,
                "variation_type": variation_type,
                "total_variations": total_variations,
                "model_used": config['model_name'],
                "image_url": image_url,  # Return Supabase URL
                "message": f"Added variation '{variation_type}' for {name}. Total: {total_variations} variations"
            }
            
        except Exception as e:
            logger.error(f"Error adding face embedding: {e}")
            raise ValueError(str(e))
    
    def save_face_info_multiple(self, name: str, image_path: str, image_url: str, model_name: str, variation_type: str):
        """Save face information with Supabase URL"""
        try:
            faces_info = []
            if os.path.exists(self.faces_info_path):
                with open(self.faces_info_path, 'r', encoding='utf-8') as f:
                    faces_info = json.load(f)
            
            # Find existing person
            person_found = False
            for person in faces_info:
                if person['name'] == name:
                    if 'variations' not in person:
                        person['variations'] = []
                    
                    person['variations'].append({
                        'type': variation_type,
                        'image_path': image_path,      # Local backup
                        'image_url': image_url,        # Supabase URL
                        'added_date': datetime.now().isoformat()
                    })
                    person['total_variations'] = len(person['variations'])
                    person['last_updated'] = datetime.now().isoformat()
                    person_found = True
                    break
            
            # Create new person if not found
            if not person_found:
                new_person = {
                    'name': name,
                    'model_name': model_name,
                    'added_date': datetime.now().isoformat(),
                    'recognition_count': 0,
                    'variations': [{
                        'type': variation_type,
                        'image_path': image_path,
                        'image_url': image_url,
                        'added_date': datetime.now().isoformat()
                    }],
                    'total_variations': 1,
                    'last_updated': datetime.now().isoformat()
                }
                faces_info.append(new_person)
            
            # Save file
            with open(self.faces_info_path, 'w', encoding='utf-8') as f:
                json.dump(faces_info, f, ensure_ascii=False, indent=2)
                
        except Exception as e:
            logger.error(f"Error saving face info: {e}")
    
    def recognize_face(self, image_base64: str) -> Dict:
        """Recognize face in the given image"""
        try:
            logger.info("Starting face recognition")
            
            if not self.known_faces:
                return {
                    "recognized": False,
                    "name": None,
                    "confidence": 0.0,
                    "distance": 100.0,
                    "model_used": None,
                    "message": "No faces in database"
                }
            
            # Decode image
            rgb_image = decode_base64_image(image_base64)
            
            # Use realtime configuration
            config = REALTIME_CONFIG.copy()
            
            # Extract embedding from unknown face
            try:
                unknown_embedding = self.extract_face_embedding(rgb_image, config)
            except ValueError as e:
                return {
                    "recognized": False,
                    "name": None,
                    "confidence": 0.0,
                    "distance": 100.0,
                    "model_used": config['model_name'],
                    "message": "No face detected in image"
                }
        
            # Compare with known faces
            best_match = None
            best_distance = float('inf')
            threshold = config['threshold'][config['model_name']]  # Dùng threshold từ config
            
            logger.info(f"Using threshold: {threshold} for model: {config['model_name']}")
            
            for known_name, known_data in self.known_faces.items():
                try:
                    # Validate known embedding
                    if 'embedding' not in known_data or known_data['embedding'] is None:
                        logger.warning(f"Invalid embedding for {known_name}")
                        continue
                    
                    # Calculate distance
                    distance = self.calculate_distance(
                        unknown_embedding, 
                        known_data['embedding'],
                        config['distance_metric']
                    )
                    
                    logger.info(f"Distance to {known_name}: {distance:.4f} (threshold: {threshold})")
                    
                    if distance < best_distance:
                        best_distance = distance
                        best_match = known_name
                        
                except Exception as e:
                    logger.warning(f"Error comparing with {known_name}: {e}")
                    continue
            
            # Ensure distance is finite and JSON serializable
            if best_distance == float('inf'):
                best_distance = 100.0
            else:
                best_distance = float(np.clip(best_distance, 0.0, 100.0))
            
            # Check if best match is within threshold
            if best_match and best_distance <= threshold and confidence > 0.5:
                # Calculate confidence
                if config['distance_metric'] == 'cosine' :
                    # Cosine distance: 0 = identical, 1 = opposite
                    confidence = max(0.0, (threshold - best_distance) / threshold)
                else:
                    confidence = max(0.0, 1.0 - (best_distance / threshold))
                
                confidence = float(np.clip(confidence, 0.0, 1.0))
                
                # Update recognition count
                self.update_recognition_count(best_match)
                
                logger.info(f"✅ RECOGNIZED: {best_match} (confidence: {confidence:.3f}, distance: {best_distance:.4f})")
                
                return {
                    "recognized": True,
                    "name": best_match,
                    "confidence": confidence,
                    "distance": best_distance,
                    "threshold": float(threshold),
                    "model_used": config['model_name'],
                    "message": f"Welcome {best_match}!"
                }
            else:
                logger.info(f"❌ NOT RECOGNIZED (best: {best_match}, distance: {best_distance:.4f}, threshold: {threshold})")
                
                return {
                    "recognized": False,
                    "name": best_match,  # Trả về best match để debug
                    "confidence": 0.0,
                    "distance": best_distance,
                    "threshold": float(threshold),
                    "model_used": config['model_name'],
                    "message": "Face not recognized"
                }
            
        except Exception as e:
            logger.error(f"Error during face recognition: {e}")
            raise ValueError(str(e))
    
    def recognize_face_multiple_embeddings(self, image_base64: str) -> Dict:
        """
        Nhận diện khuôn mặt với nhiều embedding cho mỗi người
        """
        try:
            logger.info("Starting face recognition with multiple embeddings")
            
            if not self.known_faces:
                return {
                    "recognized": False,
                    "name": None,
                    "confidence": 0.0,
                    "distance": 100.0,
                    "best_variation": None,
                    "model_used": None,
                    "message": "No faces in database"
                }
            
            # Decode image
            rgb_image = decode_base64_image(image_base64)
            
            # Use realtime configuration
            config = REALTIME_CONFIG.copy()
            
            # Extract embedding from unknown face
            try:
                unknown_embedding = self.extract_face_embedding(rgb_image, config)
            except ValueError as e:
                return {
                    "recognized": False,
                    "name": None,
                    "confidence": 0.0,
                    "distance": 100.0,
                    "best_variation": None,
                    "model_used": config['model_name'],
                    "message": "No face detected in image"
                }
            
            # Compare with all known embeddings
            best_match = None
            best_distance = float('inf')
            best_variation = None
            threshold = config['threshold'][config['model_name']]
            
            logger.info(f"Using threshold: {threshold} for model: {config['model_name']}")
            
            recognition_details = []
            
            for known_name, known_data in self.known_faces.items():
                try:
                    # Validate known embeddings
                    if 'embeddings' not in known_data or not known_data['embeddings']:
                        logger.warning(f"No embeddings for {known_name}")
                        continue
                    
                    # So sánh với tất cả embedding của người này
                    person_best_distance = float('inf')
                    person_best_variation = None
                    
                    for i, known_embedding in enumerate(known_data['embeddings']):
                        if known_embedding is None:
                            continue
                            
                        # Calculate distance
                        distance = self.calculate_distance(
                            unknown_embedding, 
                            known_embedding,
                            config['distance_metric']
                        )
                        
                        variation_type = known_data['variations'][i] if i < len(known_data['variations']) else f"var_{i}"
                        
                        logger.debug(f"Distance to {known_name}[{variation_type}]: {distance:.4f}")
                        
                        # Lưu chi tiết cho debug
                        recognition_details.append({
                            'name': known_name,
                            'variation': variation_type,
                            'distance': distance,
                            'within_threshold': distance <= threshold
                        })
                        
                        # Tìm embedding tốt nhất của người này
                        if distance < person_best_distance:
                            person_best_distance = distance
                            person_best_variation = variation_type
                    
                    # Tìm người tốt nhất tổng thể
                    if person_best_distance < best_distance:
                        best_distance = person_best_distance
                        best_match = known_name
                        best_variation = person_best_variation
                    
                    logger.info(f"Best for {known_name}: {person_best_distance:.4f} ({person_best_variation})")
                        
                except Exception as e:
                    logger.warning(f"Error comparing with {known_name}: {e}")
                    continue
            
            # Ensure distance is finite and JSON serializable
            if best_distance == float('inf'):
                best_distance = 100.0
            else:
                best_distance = float(np.clip(best_distance, 0.0, 100.0))
            
            # Check if best match is within threshold
            if best_match and best_distance <= threshold:
                # Calculate confidence
                if config['distance_metric'] == 'cosine':
                    confidence = max(0.0, (threshold - best_distance) / threshold)
                else:
                    confidence = max(0.0, 1.0 - (best_distance / threshold))
                
                confidence = float(np.clip(confidence, 0.0, 1.0))
                
                # Update recognition count
                self.update_recognition_count(best_match)
                
                logger.info(f"✅ RECOGNIZED: {best_match}[{best_variation}] (confidence: {confidence:.3f}, distance: {best_distance:.4f})")
                
                return {
                    "recognized": True,
                    "name": best_match,
                    "confidence": confidence,
                    "distance": best_distance,
                    "best_variation": best_variation,
                    "threshold": float(threshold),
                    "model_used": config['model_name'],
                    "total_comparisons": len(recognition_details),
                    "recognition_details": recognition_details[:5],  # Top 5 để debug
                    "message": f"Welcome {best_match}! (matched with {best_variation} variation)"
                }
            else:
                logger.info(f"❌ NOT RECOGNIZED (best: {best_match}[{best_variation}], distance: {best_distance:.4f}, threshold: {threshold})")
                
                return {
                    "recognized": False,
                    "name": best_match,
                    "confidence": 0.0,
                    "distance": best_distance,
                    "best_variation": best_variation,
                    "threshold": float(threshold),
                    "model_used": config['model_name'],
                    "total_comparisons": len(recognition_details),
                    "recognition_details": recognition_details[:5],  # Top 5 để debug
                    "message": f"Face not recognized (closest: {best_match}[{best_variation}])"
                }
                
        except Exception as e:
            logger.error(f"Error during face recognition: {e}")
            raise ValueError(str(e))
    
    def update_recognition_count(self, name: str):
        """Update recognition count for a face"""
        try:
            if os.path.exists(self.faces_info_path):
                with open(self.faces_info_path, 'r', encoding='utf-8') as f:
                    faces_info = json.load(f)
                
                for face_info in faces_info:
                    if face_info['name'] == name:
                        face_info['recognition_count'] = face_info.get('recognition_count', 0) + 1
                        face_info['last_recognized'] = datetime.now().isoformat()
                        break
                
                with open(self.faces_info_path, 'w', encoding='utf-8') as f:
                    json.dump(faces_info, f, ensure_ascii=False, indent=2)
                    
        except Exception as e:
            logger.error(f"Error updating recognition count: {e}")
    
    def get_faces_info(self) -> List[Dict]:
        """Get information about all faces in database"""
        try:
            if os.path.exists(self.faces_info_path):
                with open(self.faces_info_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            return []
        except Exception as e:
            logger.error(f"Error getting faces info: {e}")
            return []
    
    def delete_face(self, name: str) -> bool:
        """Delete a face from the database"""
        try:
            if name not in self.known_faces:
                return False
            
            # Remove from memory
            face_data = self.known_faces.pop(name)
            
            # Remove image file if exists
            if 'image_path' in face_data and os.path.exists(face_data['image_path']):
                os.remove(face_data['image_path'])
            
            # Save updated database
            self.save_known_faces()
            
            # Update faces info
            if os.path.exists(self.faces_info_path):
                with open(self.faces_info_path, 'r', encoding='utf-8') as f:
                    faces_info = json.load(f)
                
                faces_info = [info for info in faces_info if info['name'] != name]
                
                with open(self.faces_info_path, 'w', encoding='utf-8') as f:
                    json.dump(faces_info, f, ensure_ascii=False, indent=2)
            
            logger.info(f"Face {name} deleted successfully")
            return True
            
        except Exception as e:
            logger.error(f"Error deleting face {name}: {e}")
            return False

    def delete_face_variation(self, name: str, variation_type: str) -> bool:
        """Delete a specific variation (including from Supabase)"""
        try:
            if name not in self.known_faces:
                return False
            
            face_data = self.known_faces[name]
            if 'variations' not in face_data:
                return False
            
            # Find variation index
            variation_index = -1
            for i, var_type in enumerate(face_data['variations']):
                if var_type == variation_type:
                    variation_index = i
                    break
            
            if variation_index == -1:
                return False
            
            # Delete from Supabase if URL exists
            if 'image_urls' in face_data and variation_index < len(face_data['image_urls']):
                image_url = face_data['image_urls'][variation_index]
                # Extract filename from URL
                filename = image_url.split('/')[-1]
                supabase_service.delete_image(filename)
                face_data['image_urls'].pop(variation_index)
            
            # Delete local file
            if 'images' in face_data and variation_index < len(face_data['images']):
                local_path = face_data['images'][variation_index]
                if os.path.exists(local_path):
                    os.remove(local_path)
                face_data['images'].pop(variation_index)
            
            # Remove embedding and variation
            face_data['embeddings'].pop(variation_index)
            face_data['variations'].pop(variation_index)
            face_data['total_embeddings'] = len(face_data['embeddings'])
            
            # If no variations left, delete person entirely
            if len(face_data['embeddings']) == 0:
                return self.delete_face(name)
            
            # Save database
            self.save_known_faces()
            self._update_faces_info_after_variation_delete(name, variation_type)
            
            logger.info(f"Variation '{variation_type}' deleted for {name}")
            return True
            
        except Exception as e:
            logger.error(f"Error deleting variation: {e}")
            return False
    
    def _update_faces_info_after_variation_delete(self, name: str, variation_type: str):
        """Update faces_info.json after deleting a variation"""
        try:
            if os.path.exists(self.faces_info_path):
                with open(self.faces_info_path, 'r', encoding='utf-8') as f:
                    faces_info = json.load(f)
                
                for person in faces_info:
                    if person['name'] == name:
                        if 'variations' in person:
                            person['variations'] = [
                                v for v in person['variations'] 
                                if v['type'] != variation_type
                            ]
                            person['total_variations'] = len(person['variations'])
                            person['last_updated'] = datetime.now().isoformat()
                        break
                
                with open(self.faces_info_path, 'w', encoding='utf-8') as f:
                    json.dump(faces_info, f, ensure_ascii=False, indent=2)
                    
        except Exception as e:
            logger.error(f"Error updating faces info after variation delete: {e}")
    
    def _validate_image_for_face_detection(self, image: np.ndarray) -> bool:
        """Validate if image is suitable for face detection"""
        try:
            if image is None or image.size == 0:
                return False
            
            height, width = image.shape[:2]
            if height < 50 or width < 50:
                return False
            
            # Check if image is too dark or too bright
            gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
            mean_brightness = np.mean(gray)
            
            if mean_brightness < 10 or mean_brightness > 245:
                return False
            
            return True
            
        except Exception as e:
            logger.warning(f"Error validating image: {e}")
            return False
    
    def save_face_info_multiple(self, name: str, image_path: str, image_url: str, model_name: str, variation_type: str):
        """Save face information with Supabase URL"""
        try:
            faces_info = []
            if os.path.exists(self.faces_info_path):
                with open(self.faces_info_path, 'r', encoding='utf-8') as f:
                    faces_info = json.load(f)
            
            # Find existing person
            person_found = False
            for person in faces_info:
                if person['name'] == name:
                    if 'variations' not in person:
                        person['variations'] = []
                    
                    person['variations'].append({
                        'type': variation_type,
                        'image_path': image_path,      # Local backup
                        'image_url': image_url,        # Supabase URL
                        'added_date': datetime.now().isoformat()
                    })
                    person['total_variations'] = len(person['variations'])
                    person['last_updated'] = datetime.now().isoformat()
                    person_found = True
                    break
            
            # Create new person if not found
            if not person_found:
                new_person = {
                    'name': name,
                    'model_name': model_name,
                    'added_date': datetime.now().isoformat(),
                    'recognition_count': 0,
                    'variations': [{
                        'type': variation_type,
                        'image_path': image_path,
                        'image_url': image_url,
                        'added_date': datetime.now().isoformat()
                    }],
                    'total_variations': 1,
                    'last_updated': datetime.now().isoformat()
                }
                faces_info.append(new_person)
            
            # Save file
            with open(self.faces_info_path, 'w', encoding='utf-8') as f:
                json.dump(faces_info, f, ensure_ascii=False, indent=2)
                
        except Exception as e:
            logger.error(f"Error saving face info: {e}")

    def _safe_remove_temp_file(self, filepath: str, max_retries: int = 3):
        """Safely remove temporary file with retries"""
        import time
        for attempt in range(max_retries):
            try:
                if os.path.exists(filepath):
                    os.remove(filepath)
                return True
            except Exception as e:
                if attempt < max_retries - 1:
                    time.sleep(0.1)
                    continue
                logger.warning(f"Failed to remove temp file {filepath}: {e}")
        return False

    def _ensure_json_serializable(self, value):
        """Ensure value is JSON serializable"""
        try:
            if isinstance(value, np.ndarray):
                return value.tolist()
            elif isinstance(value, (np.integer, np.floating)):
                return float(value)
            elif value is None or isinstance(value, (str, int, float, bool, list, dict)):
                return value
            else:
                return str(value)
        except Exception:
            return str(value)
    
# Create global instance
facial_recognition_service = DeepFacialRecognitionService()

# Wrapper functions for backward compatibility
def add_face(name: str, image: str, variation_type: str = "default"):
    return facial_recognition_service.add_face_embedding(name, image, variation_type)

def recognize_face(image: str):
    return facial_recognition_service.recognize_face_multiple_embeddings(image)

def get_faces_info():
    return facial_recognition_service.get_faces_info()

def delete_face(name: str):
    return facial_recognition_service.delete_face(name)