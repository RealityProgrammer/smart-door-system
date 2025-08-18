import { useState, useCallback } from 'react';

export interface VoiceChatMessage {
    id: string;
    type: 'user' | 'ai' | 'system';
    text: string;
    timestamp: Date;
    audioUrl?: string;
    audioBase64?: string;
    audioFormat?: string;
    audioMimeType?: string;
    requiresFaceImage?: boolean;
}

export const useVoiceChat = () => {
    const [messages, setMessages] = useState<VoiceChatMessage[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string>('');

    const addMessage = useCallback((message: Omit<VoiceChatMessage, 'id' | 'timestamp'>) => {
        const newMessage: VoiceChatMessage = {
            ...message,
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            timestamp: new Date()
        };
        setMessages(prev => [...prev, newMessage]);
        return newMessage;
    }, []);

    const processVoiceHealthInquiry = useCallback(async (
        audioBlob: Blob,
        faceImageBase64: string
    ): Promise<void> => {
        setIsProcessing(true);
        setError('');

        try {
            // Create form data
            const formData = new FormData();
            formData.append('audio', audioBlob, 'voice.webm');
            formData.append('face_image', faceImageBase64);

            // Call API
            const response = await fetch('/api/voice/health-inquiry', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
                throw new Error(errorData.detail || 'Failed to process voice inquiry');
            }

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.message || 'Server returned unsuccessful response');
            }

            // Add user message
            addMessage({
                type: 'user',
                text: data.user_question
            });

            // Add AI response with audio
            addMessage({
                type: 'ai',
                text: data.health_analysis,
                audioBase64: data.response_audio_base64,
                audioFormat: data.audio_format || 'mp3',
                audioMimeType: data.audio_mime_type || 'audio/mpeg'
            });

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
            setError(errorMessage);
            console.error('Voice chat error:', err);

            // Add error message
            addMessage({
                type: 'system',
                text: `Lỗi: ${errorMessage}`
            });
        } finally {
            setIsProcessing(false);
        }
    }, [addMessage]);

    const sendTextMessage = useCallback(async (
        text: string,
        faceImageBase64?: string
    ): Promise<void> => {
        setIsProcessing(true);
        setError('');

        try {
            const formData = new FormData();
            formData.append('message', text);
            if (faceImageBase64) {
                formData.append('face_image', faceImageBase64);
            }

            const response = await fetch('/api/voice/chat', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error('Failed to send message');
            }

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.message || 'Server error');
            }

            // Add user message
            addMessage({
                type: 'user',
                text: data.user_message
            });

            // Add AI response
            addMessage({
                type: 'ai',
                text: data.ai_response,
                audioBase64: data.response_audio_base64,
                audioFormat: data.audio_format || 'mp3',
                audioMimeType: data.audio_mime_type || 'audio/mpeg'
            });

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
            setError(errorMessage);
            console.error('Text chat error:', err);
        } finally {
            setIsProcessing(false);
        }
    }, [addMessage]);

    const clearChat = useCallback(() => {
        setMessages([]);
        setError('');
    }, []);

    return {
        messages,
        isProcessing,
        error,
        processVoiceHealthInquiry,
        sendTextMessage,
        clearChat,
        addMessage
    };
};