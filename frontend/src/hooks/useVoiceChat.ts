import { useState, useCallback } from 'react';
import { voiceApiService } from '@/services/voiceApi';

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
            console.log('Processing voice health inquiry...');

            // Call voice API service
            const data = await voiceApiService.chatWithAI(audioBlob, faceImageBase64);

            if (!data.success) {
                throw new Error(data.message || 'Server returned unsuccessful response');
            }

            console.log('Voice health inquiry response:', data);

            // Add user message
            addMessage({
                type: 'user',
                text: data.user_question || 'Voice message processed'
            });

            // Add AI response with audio
            addMessage({
                type: 'ai',
                text: data.health_analysis || data.ai_response || 'AI response received',
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
            console.log('Sending text message...');

            // Call voice API service
            const data = await voiceApiService.sendTextMessage(text, faceImageBase64);

            if (!data.success) {
                throw new Error(data.message || 'Server error');
            }

            console.log('Text message response:', data);

            // Add user message
            addMessage({
                type: 'user',
                text: data.user_message || text
            });

            // Add AI response
            addMessage({
                type: 'ai',
                text: data.ai_response || data.health_analysis || 'AI response received',
                audioBase64: data.response_audio_base64,
                audioFormat: data.audio_format || 'mp3',
                audioMimeType: data.audio_mime_type || 'audio/mpeg'
            });

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
            setError(errorMessage);
            console.error('Text chat error:', err);

            // Add error message
            addMessage({
                type: 'system',
                text: `Lỗi: ${errorMessage}`
            });
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