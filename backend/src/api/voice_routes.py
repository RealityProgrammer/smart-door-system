from fastapi import APIRouter, File, UploadFile, Form, HTTPException
from fastapi.responses import Response
import logging
import base64
from src.services.gemini_service import gemini_service

logger = logging.getLogger(__name__)
voice_router = APIRouter(prefix="/voice", tags=["voice"])

@voice_router.post("/transcribe")
async def transcribe_audio(audio: UploadFile = File(...)):
    """Transcribe audio to text"""
    try:
        audio_bytes = await audio.read()
        mime_type = audio.content_type or "audio/webm"
        
        transcription = gemini_service.transcribe_audio(audio_bytes, mime_type)
        
        return {
            "success": True,
            "transcription": transcription,
            "message": "Audio transcribed successfully"
        }
        
    except Exception as e:
        logger.error(f"Transcription error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@voice_router.post("/text-to-speech")
async def text_to_speech(
    text: str = Form(...),
    format: str = Form(default="mp3")
):
    """Convert text to speech"""
    try:
        audio_data, mime_type = gemini_service.text_to_speech(text, format)
        
        # Determine file extension
        extension = "mp3" if format.lower() == "mp3" else "wav"
        
        return Response(
            content=audio_data,
            media_type=mime_type,
            headers={
                "Content-Disposition": f"attachment; filename=response.{extension}",
                "Content-Type": mime_type
            }
        )
        
    except Exception as e:
        logger.error(f"TTS error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@voice_router.post("/health-inquiry")
async def voice_health_inquiry(
    audio: UploadFile = File(...),
    face_image: str = Form(...)
):
    """Complete voice health inquiry pipeline"""
    try:
        audio_bytes = await audio.read()
        mime_type = audio.content_type or "audio/webm"
        
        user_question, health_analysis, response_audio, audio_mime_type = gemini_service.process_voice_health_inquiry(
            audio_bytes, face_image, mime_type
        )
        
        # Return JSON response with audio as base64
        audio_base64 = base64.b64encode(response_audio).decode('utf-8')
        
        return {
            "success": True,
            "user_question": user_question,
            "health_analysis": health_analysis,
            "response_audio_base64": audio_base64,
            "audio_mime_type": audio_mime_type,
            "audio_format": "mp3" if "mpeg" in audio_mime_type else "wav",
            "message": "Health inquiry completed successfully"
        }
        
    except Exception as e:
        logger.error(f"Health inquiry error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@voice_router.post("/analyze-face-health")
async def analyze_face_health(
    face_image: str = Form(...),
    question: str = Form(...)
):
    """Analyze face health with text question"""
    try:
        health_analysis = gemini_service.analyze_face_health(face_image, question)
        
        return {
            "success": True,
            "question": question,
            "health_analysis": health_analysis,
            "message": "Face health analysis completed"
        }
        
    except Exception as e:
        logger.error(f"Face health analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@voice_router.post("/chat")
async def voice_chat(
    message: str = Form(...),
    face_image: str = Form(None)
):
    """General voice chat with optional face analysis"""
    try:
        if face_image:
            response_text = gemini_service.analyze_face_health(face_image, message)
        else:
            # Simple chat without face analysis
            response_text = f"Tôi hiểu bạn đang nói: {message}. Tôi là trợ lý AI sức khỏe."
        
        # Convert to speech
        response_audio, audio_mime_type = gemini_service.text_to_speech(response_text, "mp3")
        audio_base64 = base64.b64encode(response_audio).decode('utf-8')
        
        return {
            "success": True,
            "user_message": message,
            "ai_response": response_text,
            "response_audio_base64": audio_base64,
            "audio_mime_type": audio_mime_type,
            "audio_format": "mp3"
        }
        
    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))