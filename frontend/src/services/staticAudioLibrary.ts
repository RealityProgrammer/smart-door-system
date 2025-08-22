const API_BASE_URL = 'http://192.168.1.135:8000'

export class StaticAudioLibrary {
    private static instance: StaticAudioLibrary;
    private audioCache: Map<string, string> = new Map();
    private preloadPromise: Promise<void> | null = null;

    static getInstance(): StaticAudioLibrary {
        if (!StaticAudioLibrary.instance) {
            StaticAudioLibrary.instance = new StaticAudioLibrary();
        }
        return StaticAudioLibrary.instance;
    }

    // Danh sách các file audio có sẵn
    private readonly audioFiles = {
        welcome: 'welcome.mp3',
        processing: 'processing.mp3',
        listening: 'listening.mp3',
        analyzing: 'analyzing.mp3',
        noCamera: 'noCamera.mp3',
        error: 'error.mp3',
        noAudio: 'noAudio.mp3'
    };

    /**
     * Fetch audio file từ static folder và convert to base64
     * SỬA LẠI: Bỏ /api khỏi đường dẫn
     */
    private async fetchAudioAsBase64(filename: string): Promise<string> {
        try {
            // SỬA LẠI: /static/audio/ thay vì /api/static/audio/
            const response = await fetch(`${API_BASE_URL}/static/audio/${filename}`);

            if (!response.ok) {
                throw new Error(`Failed to fetch ${filename}: ${response.status}`);
            }

            const audioBlob = await response.blob();
            return await this.blobToBase64(audioBlob);
        } catch (error) {
            console.error(`Error fetching audio file ${filename}:`, error);
            throw error;
        }
    }

    /**
     * Convert blob to base64
     */
    private blobToBase64(blob: Blob): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result as string;
                const base64 = result.split(',')[1]; // Remove data:audio/mpeg;base64, prefix
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    /**
     * Get audio base64 for a specific key
     */
    async getAudio(key: keyof typeof this.audioFiles): Promise<string> {
        // Return from cache if available
        if (this.audioCache.has(key)) {
            console.log(`🎵 Using cached audio: ${key}`);
            return this.audioCache.get(key)!;
        }

        const filename = this.audioFiles[key];
        if (!filename) {
            console.error(`Audio file not found for key: ${key}`);
            return '';
        }

        try {
            console.log(`🎵 Loading audio: ${key} from ${API_BASE_URL}/static/audio/${filename}`);
            const base64Audio = await this.fetchAudioAsBase64(filename);
            this.audioCache.set(key, base64Audio);
            console.log(`✅ Cached audio: ${key}`);
            return base64Audio;
        } catch (error) {
            console.error(`Failed to load audio for key ${key}:`, error);
            return '';
        }
    }

    /**
     * Preload all audio files
     */
    async preloadAllAudio(): Promise<void> {
        if (this.preloadPromise) {
            return this.preloadPromise;
        }

        this.preloadPromise = this._preloadAllAudioInternal();
        return this.preloadPromise;
    }

    private async _preloadAllAudioInternal(): Promise<void> {
        console.log('🎵 Preloading static audio library...');

        // Test server connectivity first
        try {
            const testResponse = await fetch(`${API_BASE_URL}/audio-status`);
            if (testResponse.ok) {
                const data = await testResponse.json();
                console.log('🎵 Available audio files:', data.available_files);
            }
        } catch (error) {
            console.warn('⚠️ Could not check audio status:', error);
        }

        const promises = Object.keys(this.audioFiles).map(async (key) => {
            try {
                await this.getAudio(key as keyof typeof this.audioFiles);
                console.log(`✅ Loaded: ${key}`);
            } catch (error) {
                console.error(`❌ Failed to load: ${key}`, error);
            }
        });

        await Promise.allSettled(promises);
        console.log('🎵 Static audio library preload completed!');
    }

    /**
     * Check if audio is cached
     */
    isAudioCached(key: keyof typeof this.audioFiles): boolean {
        return this.audioCache.has(key);
    }

    /**
     * Get cache status
     */
    getCacheStatus(): Record<string, boolean> {
        const status: Record<string, boolean> = {};
        Object.keys(this.audioFiles).forEach(key => {
            status[key] = this.audioCache.has(key);
        });
        return status;
    }

    /**
     * Clear cache
     */
    clearCache(): void {
        this.audioCache.clear();
        this.preloadPromise = null;
        console.log('🗑️ Audio cache cleared');
    }

    /**
     * Test connectivity to audio files
     */
    async testConnectivity(): Promise<boolean> {
        try {
            const response = await fetch(`${API_BASE_URL}/static/audio/welcome.mp3`, {
                method: 'HEAD' // Just check if file exists
            });
            return response.ok;
        } catch (error) {
            console.error('Audio connectivity test failed:', error);
            return false;
        }
    }
}

export const staticAudioLibrary = StaticAudioLibrary.getInstance();