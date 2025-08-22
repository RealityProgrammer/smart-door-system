const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

export interface ChatResponse {
    success: boolean;
    user_message?: string;
    user_question?: string;
    ai_response?: string;
    health_analysis?: string;
    response_audio_base64: string;
    audio_mime_type?: string;
    audio_format?: string;
    message: string;
}

export interface TranscribeResponse {
    success: boolean;
    transcription: string;
    message: string;
}

class VoiceApiService {
    async transcribeAudio(audioBlob: Blob): Promise<TranscribeResponse> {
        const formData = new FormData();
        const audioFile = new File([audioBlob], 'voice.webm', {
            type: audioBlob.type || 'audio/webm'
        });
        formData.append('audio', audioFile);

        console.log('Transcribing audio:', {
            size: audioBlob.size,
            type: audioBlob.type
        });

        const response = await fetch(`${API_BASE_URL}/voice/transcribe`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to transcribe audio: ${response.status} - ${errorText}`);
        }

        return await response.json();
    }

    async chatWithAI(audioBlob: Blob, faceImage?: string): Promise<ChatResponse> {
        const formData = new FormData();

        // Convert to better supported format if needed
        const audioFile = new File([audioBlob], 'voice.webm', {
            type: audioBlob.type || 'audio/webm'
        });

        formData.append('audio', audioFile);

        if (faceImage) {
            formData.append('face_image', faceImage);
        }

        console.log('Sending voice chat to API:', {
            size: audioBlob.size,
            type: audioBlob.type,
            hasFaceImage: !!faceImage
        });

        const response = await fetch(`${API_BASE_URL}/voice/health-inquiry`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to chat with AI: ${response.status} - ${errorText}`);
        }

        return await response.json();
    }

    async sendTextMessage(text: string, faceImage?: string): Promise<ChatResponse> {
        const formData = new FormData();
        formData.append('message', text);

        if (faceImage) {
            formData.append('face_image', faceImage);
        }

        console.log('Sending text message to API:', {
            text,
            hasFaceImage: !!faceImage
        });

        const response = await fetch(`${API_BASE_URL}/voice/chat`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to send text message: ${response.status} - ${errorText}`);
        }

        return await response.json();
    }

    async textToSpeech(text: string, format: string = "mp3"): Promise<Blob> {
        const formData = new FormData();
        formData.append('text', text);
        formData.append('format', format);

        const response = await fetch(`${API_BASE_URL}/voice/text-to-speech`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('Failed to convert text to speech');
        }

        return await response.blob();
    }
}

export const voiceApiService = new VoiceApiService();