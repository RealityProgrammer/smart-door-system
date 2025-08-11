from pydantic import BaseSettings

class Settings(BaseSettings):
    firebase_api_key: str
    firebase_auth_domain: str
    firebase_database_url: str
    firebase_project_id: str
    firebase_storage_bucket: str
    firebase_messaging_sender_id: str
    firebase_app_id: str
    face_recognition_model_path: str

    class Config:
        env_file = ".env"

settings = Settings()