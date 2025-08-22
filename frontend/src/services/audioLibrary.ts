const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
export class AudioLibrary {
    private static instance: AudioLibrary;
    private audioCache: Map<string, string> = new Map();

    static getInstance(): AudioLibrary {
        if (!AudioLibrary.instance) {
            AudioLibrary.instance = new AudioLibrary();
        }
        return AudioLibrary.instance;
    }

    // Pre-recorded base64 audio strings (bạn có thể generate từ TTS)
    private readonly audioLibrary = {
        welcome: "Xin chào! Tôi là chuyên gia sức khỏe khuôn mặt AI của bạn. Bạn có câu hỏi gì về sức khỏe từ khuôn mặt không?",
        processing: "Hmm, để tôi quan sát và phân tích khuôn mặt của bạn kỹ càng một chút nhé...",
        listening: "Tôi đang lắng nghe bạn. Hãy nói về tình trạng sức khỏe bạn muốn tôi phân tích.",
        analyzing: "Đang phân tích khuôn mặt và câu hỏi của bạn. Vui lòng chờ một chút...",
        error: "Xin lỗi, có lỗi xảy ra. Hãy thử lại nhé!",
        noCamera: "Tôi cần thấy khuôn mặt của bạn để phân tích. Vui lòng bật camera trước.",
        noAudio: "Tôi không nghe thấy gì. Vui lòng thử nói lại."
    };

    async generateAndCacheAudio(key: string, text: string): Promise<string> {
        if (this.audioCache.has(key)) {
            return this.audioCache.get(key)!;
        }

        try {
            const formData = new FormData();
            formData.append('text', text);
            formData.append('format', 'mp3');

            const response = await fetch(`${API_BASE_URL}/voice/text-to-speech`, {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                const audioBlob = await response.blob();
                const audioBase64 = await this.blobToBase64(audioBlob);
                this.audioCache.set(key, audioBase64);
                return audioBase64;
            }
        } catch (error) {
            console.error('Failed to generate audio:', error);
        }

        return '';
    }

    private blobToBase64(blob: Blob): Promise<string> {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result as string;
                const base64 = result.split(',')[1];
                resolve(base64);
            };
            reader.readAsDataURL(blob);
        });
    }

    async getAudio(key: keyof typeof this.audioLibrary): Promise<string> {
        const text = this.audioLibrary[key];
        return await this.generateAndCacheAudio(key, text);
    }

    async preloadAllAudio(): Promise<void> {
        const promises = Object.keys(this.audioLibrary).map(key =>
            this.getAudio(key as keyof typeof this.audioLibrary)
        );
        await Promise.allSettled(promises);
        console.log('AI audio library preloaded');
    }
}

export const audioLibrary = AudioLibrary.getInstance();