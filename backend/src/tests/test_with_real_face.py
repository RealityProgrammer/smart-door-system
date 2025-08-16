import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import requests
import json
import base64
import cv2
import numpy as np
from PIL import Image, ImageDraw
import logging
import time

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BASE_URL = "http://localhost:8000/api"

def create_better_test_face():
    """Tạo ảnh khuôn mặt realistic hơn"""
    # Tạo ảnh nền
    img = np.ones((400, 400, 3), dtype=np.uint8) * 240  # Light background
    
    # Vẽ khuôn mặt với nhiều chi tiết hơn
    face_center = (200, 200)
    
    # Khuôn mặt chính (oval)
    cv2.ellipse(img, face_center, (90, 110), 0, 0, 360, (255, 220, 177), -1)
    
    # Bóng khuôn mặt
    cv2.ellipse(img, (face_center[0], face_center[1] + 10), (85, 105), 0, 0, 360, (245, 210, 167), -1)
    
    # Mắt trái
    left_eye_center = (170, 170)
    cv2.ellipse(img, left_eye_center, (20, 12), 0, 0, 360, (255, 255, 255), -1)
    cv2.circle(img, left_eye_center, 8, (70, 50, 30), -1)
    cv2.circle(img, (left_eye_center[0] + 2, left_eye_center[1] - 2), 3, (0, 0, 0), -1)
    
    # Mắt phải
    right_eye_center = (230, 170)
    cv2.ellipse(img, right_eye_center, (20, 12), 0, 0, 360, (255, 255, 255), -1)
    cv2.circle(img, right_eye_center, 8, (70, 50, 30), -1)
    cv2.circle(img, (right_eye_center[0] + 2, right_eye_center[1] - 2), 3, (0, 0, 0), -1)
    
    # Lông mày
    cv2.ellipse(img, (170, 155), (18, 5), 0, 0, 180, (139, 90, 43), -1)
    cv2.ellipse(img, (230, 155), (18, 5), 0, 0, 180, (139, 90, 43), -1)
    
    # Mũi
    nose_points = np.array([
        [200, 185],
        [195, 205],
        [205, 205]
    ], np.int32)
    cv2.fillPoly(img, [nose_points], (235, 200, 157))
    cv2.circle(img, (197, 203), 2, (210, 180, 140), -1)
    cv2.circle(img, (203, 203), 2, (210, 180, 140), -1)
    
    # Miệng
    cv2.ellipse(img, (200, 230), (25, 8), 0, 0, 180, (180, 80, 80), -1)
    cv2.ellipse(img, (200, 228), (20, 6), 0, 0, 180, (200, 100, 100), -1)
    
    # Cằm
    cv2.ellipse(img, (200, 280), (70, 40), 0, 0, 180, (245, 210, 167), -1)
    
    # Tóc
    cv2.ellipse(img, (200, 120), (95, 60), 0, 0, 180, (101, 67, 33), -1)
    
    # Chuyển BGR sang RGB
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    
    return img_rgb

def test_with_camera_capture():
    """Test với ảnh từ camera"""
    try:
        # Bật camera để capture ảnh thật
        response = requests.get(f"{BASE_URL}/camera/frame")
        if response.status_code == 200:
            frame_data = response.json()['frame']
            print("✓ Captured frame from camera")
            return frame_data
    except Exception as e:
        print(f"✗ Failed to capture from camera: {e}")
    
    return None

def test_add_face_with_different_images():
    """Test add face với nhiều loại ảnh khác nhau"""
    
    print("🧪 Testing Add Face with Different Image Types")
    print("=" * 50)
    
    test_cases = []
    
    # Test case 1: Better synthetic face
    try:
        print("\n1. Testing with better synthetic face...")
        better_face = create_better_test_face()
        
        # Convert to base64
        success, buffer = cv2.imencode('.jpg', cv2.cvtColor(better_face, cv2.COLOR_RGB2BGR))
        if success:
            base64_image = base64.b64encode(buffer).decode('utf-8')
            base64_image = f"data:image/jpeg;base64,{base64_image}"
            
            test_cases.append(("Better Synthetic", base64_image))
    except Exception as e:
        print(f"✗ Failed to create better synthetic face: {e}")
    
    # Test case 2: Camera capture
    try:
        print("\n2. Testing with camera capture...")
        camera_image = test_with_camera_capture()
        if camera_image:
            test_cases.append(("Camera Capture", camera_image))
    except Exception as e:
        print(f"✗ Failed camera capture: {e}")
    
    # Test case 3: Real image file
    try:
        print("\n3. Testing with real image file...")
        real_image_path = "D:\\MinhThanh\\Music\\Pictures\\Screenshots\\Screenshot 2025-08-16 001222.png"
        if os.path.exists(real_image_path):
            with Image.open(real_image_path) as img:
                if img.mode != 'RGB':
                    img = img.convert('RGB')
                
                # Resize
                max_size = 800
                if max(img.size) > max_size:
                    ratio = max_size / max(img.size)
                    new_size = (int(img.size[0] * ratio), int(img.size[1] * ratio))
                    img = img.resize(new_size, Image.Resampling.LANCZOS)
                
                img_array = np.array(img, dtype=np.uint8)
                img_bgr = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
                
                success, buffer = cv2.imencode('.jpg', img_bgr)
                if success:
                    base64_image = base64.b64encode(buffer).decode('utf-8')
                    base64_image = f"data:image/jpeg;base64,{base64_image}"
                    
                    test_cases.append(("Real Image File", base64_image))
    except Exception as e:
        print(f"✗ Failed to load real image: {e}")
    
    # Run tests
    for test_name, base64_image in test_cases:
        print(f"\n📸 Testing: {test_name}")
        
        try:
            # Test add face
            add_data = {
                "name": f"TestUser_{test_name}_{int(time.time())}",
                "image": base64_image
            }
            
            response = requests.post(f"{BASE_URL}/faces/add", json=add_data, timeout=30)
            
            if response.status_code == 200:
                result = response.json()
                print(f"✓ SUCCESS: {result}")
            else:
                error_detail = response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text
                print(f"✗ FAILED: Status {response.status_code}")
                print(f"  Error: {error_detail}")
                
                # Debug: Save image to file for manual inspection
                try:
                    if ',' in base64_image:
                        _, data = base64_image.split(',', 1)
                    else:
                        data = base64_image
                    
                    img_data = base64.b64decode(data)
                    debug_filename = f"debug_{test_name.replace(' ', '_')}.jpg"
                    with open(debug_filename, 'wb') as f:
                        f.write(img_data)
                    print(f"  Debug image saved as: {debug_filename}")
                except Exception as debug_e:
                    print(f"  Could not save debug image: {debug_e}")
            
        except Exception as e:
            print(f"✗ EXCEPTION: {e}")

def test_face_detection_locally():
    """Test face detection locally trước khi gửi API"""
    print("\n🔍 Testing Face Detection Locally")
    print("=" * 40)
    
    try:
        # Import face_recognition locally để test
        import face_recognition
        
        # Test với better synthetic face
        print("Testing better synthetic face...")
        better_face = create_better_test_face()
        
        print(f"Image shape: {better_face.shape}, dtype: {better_face.dtype}")
        print(f"Value range: [{better_face.min()}, {better_face.max()}]")
        
        # Test face locations
        face_locations = face_recognition.face_locations(better_face)
        print(f"Face locations found: {len(face_locations)}")
        
        if face_locations:
            print("✓ Face detected! Locations:", face_locations)
            
            # Test face encodings
            face_encodings = face_recognition.face_encodings(better_face, face_locations)
            print(f"Face encodings: {len(face_encodings)}")
            
            if face_encodings:
                print("✓ Face encoding successful!")
                print(f"Encoding shape: {face_encodings[0].shape}")
            else:
                print("✗ Face encoding failed!")
        else:
            print("✗ No face detected in synthetic image!")
            
            # Try with camera image
            print("\nTrying with camera image...")
            camera_image = test_with_camera_capture()
            if camera_image:
                # Decode camera image
                if ',' in camera_image:
                    _, data = camera_image.split(',', 1)
                else:
                    data = camera_image
                
                img_data = base64.b64decode(data)
                np_arr = np.frombuffer(img_data, np.uint8)
                img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
                img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
                
                face_locations_camera = face_recognition.face_locations(img_rgb)
                print(f"Camera face locations found: {len(face_locations_camera)}")
                
                if face_locations_camera:
                    print("✓ Face detected in camera image!")
                else:
                    print("✗ No face detected in camera image!")
        
    except ImportError:
        print("face_recognition library not available for local testing")
    except Exception as e:
        print(f"Local face detection test failed: {e}")

if __name__ == "__main__":
    # Test server connectivity
    try:
        response = requests.get("http://localhost:8000/", timeout=5)
        if response.status_code != 200:
            print("❌ Server not running!")
            exit(1)
    except:
        print("❌ Cannot connect to server!")
        exit(1)
    
    print("✅ Server is running")
    
    # Run local face detection test first
    test_face_detection_locally()
    
    # Run API tests
    test_add_face_with_different_images()