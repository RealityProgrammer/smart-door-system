import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import requests
import json
import base64
import cv2
import numpy as np
from PIL import Image
import logging
from typing import Optional

# Setup logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

BASE_URL = "http://localhost:8000/api"

class APITester:
    def __init__(self):
        self.test_results = []
    
    def log_test_result(self, test_name: str, success: bool, message: str, data: dict = None):
        """Log test result"""
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "data": data or {}
        }
        self.test_results.append(result)
        
        status = "✓ PASS" if success else "✗ FAIL"
        print(f"{status} {test_name}: {message}")
        
    def create_test_image_base64(self, method='opencv') -> str:
        """Tạo ảnh test và chuyển thành base64"""
        try:
            if method == 'opencv':
                # Tạo ảnh test với OpenCV (BGR)
                img = np.zeros((400, 400, 3), dtype=np.uint8)
                img[:] = (200, 150, 100)  # BGR color
                
                # Vẽ một hình tròn đại diện cho khuôn mặt
                cv2.circle(img, (200, 150), 80, (255, 220, 180), -1)  # Face
                cv2.circle(img, (180, 130), 10, (0, 0, 0), -1)        # Left eye
                cv2.circle(img, (220, 130), 10, (0, 0, 0), -1)        # Right eye
                cv2.ellipse(img, (200, 180), (20, 10), 0, 0, 180, (0, 0, 0), 2)  # Mouth
                
                # Encode thành JPEG
                encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 95]
                success, buffer = cv2.imencode('.jpg', img, encode_param)
                
                if not success:
                    raise ValueError("Failed to encode with OpenCV")
                
                base64_string = base64.b64encode(buffer).decode('utf-8')
                return f"data:image/jpeg;base64,{base64_string}"
                
            elif method == 'pil':
                # Tạo ảnh test với PIL (RGB)
                img = Image.new('RGB', (400, 400), color=(150, 200, 100))
                
                # Convert to numpy for drawing (RGB)
                img_array = np.array(img)
                
                # Chuyển sang BGR cho OpenCV drawing
                img_bgr = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
                
                # Vẽ khuôn mặt
                cv2.circle(img_bgr, (200, 150), 80, (180, 220, 255), -1)  # Face
                cv2.circle(img_bgr, (180, 130), 10, (0, 0, 0), -1)        # Left eye
                cv2.circle(img_bgr, (220, 130), 10, (0, 0, 0), -1)        # Right eye
                cv2.ellipse(img_bgr, (200, 180), (20, 10), 0, 0, 180, (0, 0, 0), 2)  # Mouth
                
                # Encode
                success, buffer = cv2.imencode('.jpg', img_bgr)
                if not success:
                    raise ValueError("Failed to encode with PIL method")
                
                base64_string = base64.b64encode(buffer).decode('utf-8')
                return f"data:image/jpeg;base64,{base64_string}"
            
        except Exception as e:
            raise ValueError(f"Failed to create test image with {method}: {e}")
    
    def load_real_image_base64(self, image_path: str) -> Optional[str]:
        """Load real image file and convert to base64"""
        try:
            # Method 1: PIL
            with Image.open(image_path) as img:
                if img.mode != 'RGB':
                    img = img.convert('RGB')
                
                # Resize if too large
                max_size = 800
                if max(img.size) > max_size:
                    ratio = max_size / max(img.size)
                    new_size = (int(img.size[0] * ratio), int(img.size[1] * ratio))
                    img = img.resize(new_size, Image.Resampling.LANCZOS)
                
                # Convert to numpy array
                img_array = np.array(img, dtype=np.uint8)
                
                # Convert RGB to BGR for OpenCV
                img_bgr = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
                
                # Encode
                success, buffer = cv2.imencode('.jpg', img_bgr)
                if not success:
                    raise ValueError("Failed to encode image")
                
                base64_string = base64.b64encode(buffer).decode('utf-8')
                return f"data:image/jpeg;base64,{base64_string}"
                
        except Exception as e:
            logger.error(f"Failed to load real image: {e}")
            return None
    
    def validate_base64_image(self, base64_string: str) -> dict:
        """Validate base64 image"""
        try:
            # Parse header
            if ',' in base64_string:
                header, data = base64_string.split(',', 1)
            else:
                header = "no-header"
                data = base64_string
            
            # Decode base64
            img_data = base64.b64decode(data)
            
            # Try to decode with OpenCV
            np_arr = np.frombuffer(img_data, np.uint8)
            img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
            
            if img is None:
                return {"valid": False, "error": "OpenCV decode failed"}
            
            # Convert BGR to RGB for face_recognition
            img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            
            # Validation checks
            checks = {
                "has_3_dimensions": len(img_rgb.shape) == 3,
                "has_3_channels": img_rgb.shape[2] == 3,
                "is_uint8": img_rgb.dtype == np.uint8,
                "min_size_ok": min(img_rgb.shape[:2]) >= 50,
                "value_range_ok": img_rgb.min() >= 0 and img_rgb.max() <= 255
            }
            
            return {
                "valid": all(checks.values()),
                "header": header,
                "data_length": len(img_data),
                "image_shape": img_rgb.shape,
                "image_dtype": str(img_rgb.dtype),
                "value_range": [int(img_rgb.min()), int(img_rgb.max())],
                "checks": checks
            }
            
        except Exception as e:
            return {"valid": False, "error": str(e)}
    
    def test_base64_validation(self):
        """Test base64 image validation"""
        print("\n=== TEST BASE64 VALIDATION ===")
        
        # Test 1: Synthetic image with OpenCV
        try:
            base64_opencv = self.create_test_image_base64('opencv')
            validation = self.validate_base64_image(base64_opencv)
            
            self.log_test_result(
                "Base64 OpenCV Image",
                validation['valid'],
                f"Validation: {validation}",
                validation
            )
        except Exception as e:
            self.log_test_result("Base64 OpenCV Image", False, str(e))
        
        # Test 2: Synthetic image with PIL
        try:
            base64_pil = self.create_test_image_base64('pil')
            validation = self.validate_base64_image(base64_pil)
            
            self.log_test_result(
                "Base64 PIL Image",
                validation['valid'],
                f"Validation: {validation}",
                validation
            )
        except Exception as e:
            self.log_test_result("Base64 PIL Image", False, str(e))
        
        # Test 3: Real image if exists
        real_image_path = "D:\\MinhThanh\\Music\\Pictures\\Screenshots\\Screenshot 2025-08-16 001222.png"
        if os.path.exists(real_image_path):
            try:
                base64_real = self.load_real_image_base64(real_image_path)
                if base64_real:
                    validation = self.validate_base64_image(base64_real)
                    
                    self.log_test_result(
                        "Base64 Real Image",
                        validation['valid'],
                        f"Validation: {validation}",
                        validation
                    )
                else:
                    self.log_test_result("Base64 Real Image", False, "Failed to load real image")
            except Exception as e:
                self.log_test_result("Base64 Real Image", False, str(e))
    
    def test_api_endpoint(self, endpoint: str, method: str = "GET", data: dict = None) -> dict:
        """Test API endpoint"""
        try:
            url = f"{BASE_URL}{endpoint}"
            
            if method.upper() == "GET":
                response = requests.get(url, timeout=30)
            elif method.upper() == "POST":
                response = requests.post(url, json=data, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            return {
                "success": response.status_code == 200,
                "status_code": response.status_code,
                "response": response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    def test_face_api(self):
        """Test face recognition API"""
        print("\n=== TEST FACE RECOGNITION API ===")
        
        # Get valid base64 image
        base64_image = None
        try:
            base64_image = self.create_test_image_base64('opencv')
            validation = self.validate_base64_image(base64_image)
            if not validation['valid']:
                raise ValueError(f"Generated image is invalid: {validation}")
        except Exception as e:
            self.log_test_result("Generate Test Image", False, str(e))
            return
        
        self.log_test_result("Generate Test Image", True, "Successfully generated valid base64 image")
        
        # Test 1: Add face
        add_face_data = {
            "name": "TestUser_" + str(int(time.time())),
            "image": base64_image
        }
        
        result = self.test_api_endpoint("/faces/add", "POST", add_face_data)
        self.log_test_result(
            "Add Face API",
            result['success'],
            f"Status: {result.get('status_code', 'N/A')}, Response: {result.get('response', result.get('error', 'N/A'))}",
            result
        )
        
        # Test 2: Recognize face
        recognize_data = {
            "image": base64_image
        }
        
        result = self.test_api_endpoint("/faces/recognize", "POST", recognize_data)
        self.log_test_result(
            "Recognize Face API",
            result['success'],
            f"Status: {result.get('status_code', 'N/A')}, Response: {result.get('response', result.get('error', 'N/A'))}",
            result
        )
        
        # Test 3: Get faces info
        result = self.test_api_endpoint("/faces/info", "GET")
        self.log_test_result(
            "Get Faces Info API",
            result['success'],
            f"Status: {result.get('status_code', 'N/A')}, Response: {result.get('response', result.get('error', 'N/A'))}",
            result
        )
    
    def test_camera_api(self):
        """Test camera API"""
        print("\n=== TEST CAMERA API ===")
        
        # Test 1: Get available cameras
        result = self.test_api_endpoint("/cameras", "GET")
        self.log_test_result(
            "Get Cameras API",
            result['success'],
            f"Status: {result.get('status_code', 'N/A')}, Response: {result.get('response', result.get('error', 'N/A'))}",
            result
        )
        
        # Test 2: Select camera
        camera_data = {"camera_id": 0}
        result = self.test_api_endpoint("/cameras/select", "POST", camera_data)
        self.log_test_result(
            "Select Camera API",
            result['success'],
            f"Status: {result.get('status_code', 'N/A')}, Response: {result.get('response', result.get('error', 'N/A'))}",
            result
        )
        
        # Test 3: Get camera frame
        result = self.test_api_endpoint("/camera/frame", "GET")
        self.log_test_result(
            "Get Camera Frame API",
            result['success'],
            f"Status: {result.get('status_code', 'N/A')}, Response: {'Frame data received' if result.get('success') else result.get('response', result.get('error', 'N/A'))}",
            result
        )
    
    def run_all_tests(self):
        """Run all tests"""
        import time
        
        print("🚀 Starting API Tests...")
        print(f"Base URL: {BASE_URL}")
        
        # Test server connectivity
        try:
            response = requests.get(f"http://localhost:8000/", timeout=5)
            if response.status_code == 200:
                self.log_test_result("Server Connectivity", True, "Server is running")
            else:
                self.log_test_result("Server Connectivity", False, f"Server returned {response.status_code}")
                return
        except Exception as e:
            self.log_test_result("Server Connectivity", False, f"Cannot connect to server: {e}")
            return
        
        # Run tests
        self.test_base64_validation()
        self.test_face_api()
        self.test_camera_api()
        
        # Summary
        print("\n" + "="*50)
        print("TEST SUMMARY")
        print("="*50)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for r in self.test_results if r['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {passed_tests/total_tests*100:.1f}%")
        
        print("\nFailed Tests:")
        for result in self.test_results:
            if not result['success']:
                print(f"  ❌ {result['test']}: {result['message']}")

if __name__ == "__main__":
    import time
    tester = APITester()
    tester.run_all_tests()