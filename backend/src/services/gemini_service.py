import os
import base64
import tempfile
import wave
import io
import logging
from typing import Dict, Optional, Tuple
from google import genai
from google.genai import types
from pydub import AudioSegment

logger = logging.getLogger(__name__)

class GeminiService:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY must be set in environment variables")
        
        self.client = genai.Client(api_key=self.api_key)
        
        # Voice configurations
        self.voice_config = types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(
                    voice_name='Kore'  # Vietnamese voice
                )
            )
        )
        
    def _create_wav_from_pcm(self, pcm_data: bytes, sample_rate: int = 24000, 
                           channels: int = 1, sample_width: int = 2) -> bytes:
        """Convert PCM data to WAV format"""
        try:
            # Create WAV file in memory
            wav_io = io.BytesIO()
            
            with wave.open(wav_io, 'wb') as wav_file:
                wav_file.setnchannels(channels)
                wav_file.setsampwidth(sample_width)
                wav_file.setframerate(sample_rate)
                wav_file.writeframes(pcm_data)
            
            wav_io.seek(0)
            return wav_io.getvalue()
            
        except Exception as e:
            logger.error(f"Error creating WAV from PCM: {e}")
            raise ValueError(f"Failed to create WAV file: {e}")
    
    def _convert_to_mp3(self, pcm_data: bytes, sample_rate: int = 24000) -> bytes:
        """Convert PCM data to MP3 format using pydub"""
        try:
            # Create WAV first
            wav_data = self._create_wav_from_pcm(pcm_data, sample_rate)
            
            # Convert WAV to MP3 using pydub
            audio_segment = AudioSegment.from_wav(io.BytesIO(wav_data))
            
            # Export as MP3
            mp3_io = io.BytesIO()
            audio_segment.export(mp3_io, format="mp3", bitrate="128k")
            mp3_io.seek(0)
            
            return mp3_io.getvalue()
            
        except Exception as e:
            logger.error(f"Error converting to MP3: {e}")
            # Fallback to WAV
            return self._create_wav_from_pcm(pcm_data, sample_rate)

    def transcribe_audio(self, audio_bytes: bytes, mime_type: str = "audio/webm") -> str:
        """Convert speech to text using Gemini"""
        try:
            response = self.client.models.generate_content(
                model="gemini-2.5-flash",
                contents=[
                    "Transcribe this audio to Vietnamese text. Only return the transcribed text:",
                    types.Part.from_bytes(data=audio_bytes, mime_type=mime_type)
                ]
            )
            return response.text.strip()
            
        except Exception as e:
            logger.error(f"Error transcribing audio: {e}")
            raise ValueError(f"Failed to transcribe audio: {e}")
    
    def analyze_face_health(self, face_image_base64: str, user_question: str) -> str:
        """Analyze face health using Gemini Vision"""
        try:
            # Remove data URL prefix
            if ',' in face_image_base64:
                face_image_base64 = face_image_base64.split(',')[1]
            
            image_bytes = base64.b64decode(face_image_base64)
            
            health_prompt = f"""
            Bạn là một chuyên gia sức khỏe AI. Hãy phân tích khuôn mặt trong ảnh này và trả lời câu hỏi của người dùng.
            
            Câu hỏi của người dùng: "{user_question}"
            
            Hãy phân tích các yếu tố sau:
            1. Màu da và độ ẩm
            2. Tình trạng mắt (bọng mắt, thâm quầng)
            3. Tình trạng môi
            4. Dấu hiệu căng thẳng hoặc mệt mỏi
            5. Tổng thể sức khỏe nhìn từ khuôn mặt
            
            Trả lời bằng tiếng Việt, ngắn gọn, dễ hiểu và thân thiện.
            Lưu ý: Đây chỉ là phân tích sơ bộ, không thay thế lời khuyên y tế chuyên nghiệp.
            """
            
            response = self.client.models.generate_content(
                model="gemini-2.5-flash",
                contents=[
                    health_prompt,
                    types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg")
                ]
            )
            
            return response.text.strip()
            
        except Exception as e:
            logger.error(f"Error analyzing face health: {e}")
            raise ValueError(f"Failed to analyze face health: {e}")
    
    def text_to_speech(self, text: str, format: str = "mp3") -> tuple[bytes, str]:
        """Convert text to speech using Gemini TTS"""
        try:
            response = self.client.models.generate_content(
                model="gemini-2.5-flash-preview-tts",
                contents=f"Nói một cách thân thiện và tự nhiên: {text}",
                config=types.GenerateContentConfig(
                    response_modalities=["AUDIO"],
                    speech_config=self.voice_config
                )
            )
            
            # Get raw PCM data from Gemini
            pcm_data = response.candidates[0].content.parts[0].inline_data.data
            
            # Convert to requested format
            if format.lower() == "mp3":
                audio_data = self._convert_to_mp3(pcm_data)
                mime_type = "audio/mpeg"
            else:  # Default to WAV
                audio_data = self._create_wav_from_pcm(pcm_data)
                mime_type = "audio/wav"
            
            logger.info(f"Generated {format.upper()} audio: {len(audio_data)} bytes")
            return audio_data, mime_type
            
        except Exception as e:
            logger.error(f"Error converting text to speech: {e}")
            raise ValueError(f"Failed to convert text to speech: {e}")
    
    def process_voice_health_inquiry(self, audio_bytes: bytes, face_image_base64: str, 
                                   mime_type: str = "audio/webm") -> Tuple[str, str, bytes, str]:
        """Complete voice health inquiry pipeline"""
        try:
            # 1. Speech to text
            user_question = self.transcribe_audio(audio_bytes, mime_type)
            logger.info(f"Transcribed question: {user_question}")
            
            # 2. Analyze face health
            health_analysis = self.analyze_face_health(face_image_base64, user_question)
            logger.info(f"Health analysis completed")
            
            # 3. Text to speech (MP3 format)
            response_audio, audio_mime_type = self.text_to_speech(health_analysis, "mp3")
            logger.info(f"Audio response generated")
            
            return user_question, health_analysis, response_audio, audio_mime_type
            
        except Exception as e:
            logger.error(f"Error in voice health inquiry pipeline: {e}")
            raise ValueError(f"Voice health inquiry failed: {e}")

# Global instance
gemini_service = GeminiService()