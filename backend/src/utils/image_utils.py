import base64
import cv2
import numpy as np
from PIL import Image
import io
import logging
from typing import Optional, Tuple

logger = logging.getLogger(__name__)

def normalize_image_for_deepface(image: np.ndarray) -> np.ndarray:
    """
    Normalize image for DeepFace processing
    
    Args:
        image: Input image as numpy array
        
    Returns:
        Normalized image in RGB format
    """
    try:
        # Ensure image is in the right format
        if len(image.shape) == 3:
            if image.shape[2] == 4:  # RGBA to RGB
                image = cv2.cvtColor(image, cv2.COLOR_RGBA2RGB)
            elif image.shape[2] == 3:
                # Check if it's BGR (OpenCV default) and convert to RGB
                # Simple heuristic: if image has been read by OpenCV, convert
                pass  # Assume it's already RGB from our decode function
        elif len(image.shape) == 2:  # Grayscale to RGB
            image = cv2.cvtColor(image, cv2.COLOR_GRAY2RGB)
        
        # Ensure uint8 format
        if image.dtype != np.uint8:
            if image.max() <= 1.0:
                image = (image * 255).astype(np.uint8)
            else:
                image = image.astype(np.uint8)
        
        # Ensure contiguous array
        if not image.flags['C_CONTIGUOUS']:
            image = np.ascontiguousarray(image)
        
        logger.debug(f"Normalized image: shape={image.shape}, dtype={image.dtype}, range=[{image.min()}, {image.max()}]")
        return image
        
    except Exception as e:
        logger.error(f"Error normalizing image: {e}")
        raise ValueError(f"Failed to normalize image: {e}")

def decode_base64_image(image_base64: str) -> np.ndarray:
    """
    Decode base64 image to numpy array in RGB format
    
    Args:
        image_base64: Base64 encoded image string
        
    Returns:
        RGB image as numpy array
    """
    try:
        logger.debug(f"Decoding base64 image, length: {len(image_base64)}")
        
        # Remove header if present
        if ',' in image_base64:
            header, image_base64 = image_base64.split(',', 1)
            logger.debug(f"Removed header: {header}")
        
        # Add padding if needed
        missing_padding = len(image_base64) % 4
        if missing_padding:
            image_base64 += '=' * (4 - missing_padding)
        
        # Decode base64
        img_data = base64.b64decode(image_base64)
        logger.debug(f"Decoded data length: {len(img_data)}")
        
        # Try OpenCV first
        np_arr = np.frombuffer(img_data, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        
        if img is not None:
            # Convert BGR to RGB
            img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            logger.debug(f"OpenCV decode success: {img_rgb.shape}")
        else:
            # Fallback to PIL
            img_pil = Image.open(io.BytesIO(img_data))
            if img_pil.mode != 'RGB':
                img_pil = img_pil.convert('RGB')
            img_rgb = np.array(img_pil, dtype=np.uint8)
            logger.debug(f"PIL decode success: {img_rgb.shape}")
        
        # Validate image
        if len(img_rgb.shape) != 3 or img_rgb.shape[2] != 3:
            raise ValueError(f"Invalid image format: {img_rgb.shape}")
        
        # Check size constraints
        height, width = img_rgb.shape[:2]
        if width < 50 or height < 50:
            raise ValueError(f"Image too small: {width}x{height}")
        
        # Resize if too large
        if width > 2048 or height > 2048:
            max_size = 2048
            ratio = max_size / max(width, height)
            new_width = int(width * ratio)
            new_height = int(height * ratio)
            img_pil = Image.fromarray(img_rgb)
            img_pil = img_pil.resize((new_width, new_height), Image.Resampling.LANCZOS)
            img_rgb = np.array(img_pil, dtype=np.uint8)
            logger.info(f"Resized image to {new_width}x{new_height}")
        
        return normalize_image_for_deepface(img_rgb)
        
    except Exception as e:
        logger.error(f"Error decoding base64 image: {e}")
        raise ValueError(f"Failed to decode image: {e}")

def encode_image_to_base64(image: np.ndarray, format: str = 'JPEG', quality: int = 95) -> str:
    """
    Encode numpy array image to base64 string
    
    Args:
        image: Image as numpy array (RGB)
        format: Image format ('JPEG' or 'PNG')
        quality: JPEG quality (1-100)
        
    Returns:
        Base64 encoded image string with header
    """
    try:
        # Convert RGB to BGR for OpenCV
        if len(image.shape) == 3 and image.shape[2] == 3:
            img_bgr = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)
        else:
            img_bgr = image
        
        # Encode image
        if format.upper() == 'JPEG':
            encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), quality]
            success, buffer = cv2.imencode('.jpg', img_bgr, encode_param)
            mime_type = 'image/jpeg'
        else:
            success, buffer = cv2.imencode('.png', img_bgr)
            mime_type = 'image/png'
        
        if not success:
            raise ValueError(f"Failed to encode image as {format}")
        
        # Convert to base64
        base64_image = base64.b64encode(buffer).decode('utf-8')
        return f"data:{mime_type};base64,{base64_image}"
        
    except Exception as e:
        logger.error(f"Error encoding image to base64: {e}")
        raise ValueError(f"Failed to encode image: {e}")

def resize_image(image: np.ndarray, max_size: int = 1024) -> np.ndarray:
    """
    Resize image while maintaining aspect ratio
    
    Args:
        image: Input image
        max_size: Maximum dimension size
        
    Returns:
        Resized image
    """
    try:
        height, width = image.shape[:2]
        
        if max(height, width) <= max_size:
            return image
        
        ratio = max_size / max(height, width)
        new_width = int(width * ratio)
        new_height = int(height * ratio)
        
        img_pil = Image.fromarray(image)
        img_pil = img_pil.resize((new_width, new_height), Image.Resampling.LANCZOS)
        
        return np.array(img_pil, dtype=np.uint8)
        
    except Exception as e:
        logger.error(f"Error resizing image: {e}")
        raise ValueError(f"Failed to resize image: {e}")