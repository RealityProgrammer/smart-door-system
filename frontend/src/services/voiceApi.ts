const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

export interface ChatResponse {
    success: boolean;
    user_question: string;
    ai_response: string;
    response_audio_base64: string;
    audio_format?: string;
    requires_face_image?: boolean;
    message: string;
}

export interface StartConversationResponse {
    success: boolean;
    message: string;
    response_audio_base64: string;
    audio_format?: string;
    conversation_started: boolean;
}

class VoiceApiService {
    async startConversation(): Promise<StartConversationResponse> {
        const response = await fetch(`${API_BASE_URL}/voice/start-conversation`, {
            method: 'POST',
        });

        if (!response.ok) {
            throw new Error('Failed to start conversation');
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

        console.log('Sending audio to API:', {
            size: audioBlob.size,
            type: audioBlob.type
        });

        const response = await fetch(`${API_BASE_URL}/voice/chat`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to chat with AI: ${response.status} - ${errorText}`);
        }

        return await response.json();
    }

    async transcribeAudio(audioBlob: Blob) {
        const formData = new FormData();
        const audioFile = new File([audioBlob], 'voice.webm', {
            type: audioBlob.type || 'audio/webm'
        });
        formData.append('audio', audioFile);

        const response = await fetch(`${API_BASE_URL}/voice/transcribe`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('Failed to transcribe audio');
        }

        return await response.json();
    }

    async textToSpeech(text: string): Promise<Blob> {
        const response = await fetch(`${API_BASE_URL}/voice/text-to-speech`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ text })
        });

        if (!response.ok) {
            throw new Error('Failed to convert text to speech');
        }

        return await response.blob();
    }
}

export const voiceApiService = new VoiceApiService();