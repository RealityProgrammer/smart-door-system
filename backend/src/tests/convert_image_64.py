import base64
import cv2
import numpy as np
from PIL import Image
import io

def convert_image_to_base64(image_path: str) -> str:
    """
    Tải ảnh từ file và chuyển đổi thành chuỗi base64 đúng định dạng RGB 8-bit.
    
    Args:
        image_path (str): Đường dẫn tới file ảnh.
    
    Returns:
        str: Chuỗi base64 của ảnh với header `data:image/jpeg;base64,`.
    """
    try:
        print(f"Đang xử lý ảnh: {image_path}")
        
        # Phương pháp 1: Sử dụng PIL (tốt hơn cho việc xử lý nhiều định dạng)
        with Image.open(image_path) as img:
            print(f"Thông tin ảnh gốc: Mode={img.mode}, Size={img.size}")
            
            # Chuyển sang RGB nếu cần
            if img.mode != 'RGB':
                print(f"Chuyển đổi từ {img.mode} sang RGB")
                img = img.convert('RGB')
            
            # Đảm bảo ảnh không quá lớn (resize nếu cần)
            max_size = 1024
            if max(img.size) > max_size:
                ratio = max_size / max(img.size)
                new_size = (int(img.size[0] * ratio), int(img.size[1] * ratio))
                img = img.resize(new_size, Image.Resampling.LANCZOS)
                print(f"Resize ảnh về: {new_size}")
            
            # Chuyển PIL Image thành numpy array
            img_array = np.array(img, dtype=np.uint8)
            print(f"Array shape: {img_array.shape}, dtype: {img_array.dtype}")
            
            # Validate định dạng
            if len(img_array.shape) != 3 or img_array.shape[2] != 3:
                raise ValueError(f"Ảnh phải có 3 kênh RGB, nhận được: {img_array.shape}")
            
            if img_array.dtype != np.uint8:
                raise ValueError(f"Ảnh phải có định dạng uint8, nhận được: {img_array.dtype}")
            
            # Chuyển RGB thành BGR cho OpenCV encode
            img_bgr = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
            
            # Encode thành JPEG
            encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 95]
            success, buffer = cv2.imencode('.jpg', img_bgr, encode_param)
            
            if not success:
                raise ValueError("Không thể encode ảnh thành JPEG")
            
            # Encode thành base64
            base64_image = base64.b64encode(buffer).decode("utf-8")
            
            # Thêm header
            result = f"data:image/jpeg;base64,{base64_image}"
            print(f"Chuyển đổi thành công! Base64 length: {len(result)}")
            
            return result
            
    except Exception as e:
        print(f"Lỗi với PIL, thử phương pháp OpenCV: {e}")
        
        # Phương pháp 2: Fallback với OpenCV
        try:
            img = cv2.imread(image_path)
            if img is None:
                raise ValueError("OpenCV không thể đọc ảnh")
            
            print(f"OpenCV - Shape: {img.shape}, dtype: {img.dtype}")
            
            # Đảm bảo định dạng uint8
            if img.dtype != np.uint8:
                img = img.astype(np.uint8)
            
            # Resize nếu cần
            height, width = img.shape[:2]
            max_size = 1024
            if max(height, width) > max_size:
                ratio = max_size / max(height, width)
                new_width = int(width * ratio)
                new_height = int(height * ratio)
                img = cv2.resize(img, (new_width, new_height), interpolation=cv2.INTER_LANCZOS4)
                print(f"OpenCV - Resized to: {img.shape}")
            
            # Encode thành JPEG
            encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 95]
            success, buffer = cv2.imencode('.jpg', img, encode_param)
            
            if not success:
                raise ValueError("OpenCV không thể encode ảnh")
            
            base64_image = base64.b64encode(buffer).decode("utf-8")
            result = f"data:image/jpeg;base64,{base64_image}"
            
            print(f"OpenCV - Chuyển đổi thành công! Base64 length: {len(result)}")
            return result
            
        except Exception as e2:
            raise ValueError(f"Cả hai phương pháp đều thất bại. PIL: {e}, OpenCV: {e2}")

def validate_base64_image(base64_string: str) -> bool:
    """
    Kiểm tra tính hợp lệ của chuỗi base64 image
    """
    try:
        if ',' in base64_string:
            header, data = base64_string.split(',', 1)
        else:
            data = base64_string
        
        # Decode base64
        img_data = base64.b64decode(data)
        
        # Thử decode bằng OpenCV
        np_arr = np.frombuffer(img_data, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        
        if img is None:
            return False
        
        # Kiểm tra định dạng
        if len(img.shape) != 3 or img.shape[2] != 3:
            return False
        
        if img.dtype != np.uint8:
            return False
        
        print(f"Validation passed - Shape: {img.shape}, dtype: {img.dtype}")
        return True
        
    except Exception as e:
        print(f"Validation failed: {e}")
        return False

# Test function
def test_conversion():
    """Test việc chuyển đổi với nhiều loại ảnh"""
    image_path = "D:\MinhThanh\Music\Pictures\Screenshots\Screenshot 2025-08-16 001222.png"
    output_path = "D:\MinhThanh\Music\Pictures\Screenshots\image_base64_output.txt"
    
    try:
        # Chuyển đổi
        print("=== BẮT ĐẦU CHUYỂN ĐỔI ===")
        image_base64 = convert_image_to_base64(image_path)
        
        # Validate
        print("\n=== KIỂM TRA TÍNH HỢP LỆ ===")
        is_valid = validate_base64_image(image_base64)
        print(f"Ảnh hợp lệ: {is_valid}")
        
        # Lưu file
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(image_base64)
        
        print(f"\nKết quả đã được lưu vào: {output_path}")
        print(f"Độ dài base64: {len(image_base64)} ký tự")
        
        # Test decode lại
        print("\n=== TEST DECODE LẠI ===")
        test_decode(image_base64)
        
    except Exception as e:
        print(f"Lỗi: {e}")

def test_decode(base64_string: str):
    """Test decode lại ảnh để đảm bảo đúng định dạng"""
    try:
        # Tách header
        if ',' in base64_string:
            header, data = base64_string.split(',', 1)
        else:
            data = base64_string
        
        # Decode
        img_data = base64.b64decode(data)
        np_arr = np.frombuffer(img_data, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        
        if img is None:
            raise ValueError("Decode thất bại")
        
        # Chuyển BGR sang RGB (như trong face_recognition)
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        
        print(f"Decode success:")
        print(f"- BGR shape: {img.shape}, dtype: {img.dtype}")
        print(f"- RGB shape: {img_rgb.shape}, dtype: {img_rgb.dtype}")
        print(f"- RGB range: [{img_rgb.min()}, {img_rgb.max()}]")
        
        # Kiểm tra face_recognition compatibility
        if len(img_rgb.shape) == 3 and img_rgb.shape[2] == 3 and img_rgb.dtype == np.uint8:
            print("✓ Tương thích với face_recognition")
        else:
            print("✗ Không tương thích với face_recognition")
            
    except Exception as e:
        print(f"Test decode failed: {e}")

if __name__ == "__main__":
    test_conversion()