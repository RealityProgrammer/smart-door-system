"""
Configuration for DeepFace models and settings
"""

# Available models in DeepFace
DEEPFACE_MODELS = {
    'VGG-Face': 'VGG-Face',
    'Facenet': 'Facenet',
    'Facenet512': 'Facenet512', 
    'OpenFace': 'OpenFace',
    'DeepFace': 'DeepFace',
    'DeepID': 'DeepID',
    'ArcFace': 'ArcFace',
    'Dlib': 'Dlib',
    'SFace': 'SFace'
}

# Available backends for face detection
DEEPFACE_BACKENDS = {
    'opencv': 'opencv',
    'ssd': 'ssd', 
    'dlib': 'dlib',
    'mtcnn': 'mtcnn',
    'retinaface': 'retinaface',
    'mediapipe': 'mediapipe'
}

# Default configuration với threshold chuẩn
DEFAULT_CONFIG = {
    'model_name': 'Facenet512',  # Thay đổi từ Facenet sang Facenet512 để accuracy cao hơn
    'detector_backend': 'opencv',
    'distance_metric': 'cosine',
    'threshold': {
        'VGG-Face': 0.68,
        'Facenet': 0.40,      # Threshold chuẩn cho Facenet
        'Facenet512': 0.30,   # Threshold chuẩn cho Facenet512
        'OpenFace': 0.10,
        'DeepFace': 0.23,
        'DeepID': 0.015,
        'ArcFace': 0.68,
        'Dlib': 0.07,
        'SFace': 0.593
    },
    'enforce_detection': True,
    'align': True,
    'normalization': 'base'
}

# Realtime configuration (nhanh hơn, ít chính xác hơn)
REALTIME_CONFIG = {
    'model_name': 'Facenet512',  # Dùng model tốt nhất
    'detector_backend': 'opencv',  # Nhanh nhất
    'distance_metric': 'cosine',
    'threshold': DEFAULT_CONFIG['threshold'],
    'enforce_detection': False,  # Cho phép xử lý ngay cả khi không chắc chắn có face
    'align': True,
    'normalization': 'base'
}

# Enrollment configuration (chính xác nhất cho việc đăng ký)
ENROLLMENT_CONFIG = {
    'model_name': 'Facenet512',  # Model tốt nhất
    'detector_backend': 'retinaface',  # Chính xác nhất
    'distance_metric': 'cosine',
    'threshold': DEFAULT_CONFIG['threshold'],
    'enforce_detection': True,  # Bắt buộc phải có face
    'align': True,
    'normalization': 'base'
}