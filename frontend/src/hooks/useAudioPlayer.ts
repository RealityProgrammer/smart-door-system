import React, { useState, useRef, useCallback } from 'react';

export const useAudioPlayer = () => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentAudio, setCurrentAudio] = useState<string>('');
    const [error, setError] = useState<string>('');
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const createAudioFromBase64 = useCallback((
        base64Data: string,
        mimeType: string = 'audio/mpeg'
    ): string => {
        try {
            // Remove data URL prefix if present
            const cleanBase64 = base64Data.replace(/^data:audio\/[^;]+;base64,/, '');

            // Convert base64 to binary
            const binaryString = atob(cleanBase64);
            const bytes = new Uint8Array(binaryString.length);

            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            // Create blob with correct MIME type
            const audioBlob = new Blob([bytes], { type: mimeType });

            // Create object URL
            const audioUrl = URL.createObjectURL(audioBlob);

            console.log('Created audio URL:', {
                blobSize: audioBlob.size,
                mimeType: audioBlob.type,
                url: audioUrl
            });

            return audioUrl;

        } catch (error) {
            console.error('Error creating audio from base64:', error);
            throw new Error(`Failed to create audio: ${error}`);
        }
    }, []);

    const playAudio = useCallback(async (audioSource: string, mimeType?: string) => {
        try {
            setError('');

            // Stop current audio if playing
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;

                // Revoke previous object URL to prevent memory leaks
                if (currentAudio.startsWith('blob:')) {
                    URL.revokeObjectURL(currentAudio);
                }
            }

            let audioUrl: string;

            // Check if it's base64 data
            if (audioSource.includes('base64') || (!audioSource.startsWith('http') && !audioSource.startsWith('blob:'))) {
                // It's base64 data
                const finalMimeType = mimeType || 'audio/mpeg';
                audioUrl = createAudioFromBase64(audioSource, finalMimeType);
            } else {
                // It's already a URL
                audioUrl = audioSource;
            }

            // Create new audio element
            const audio = new Audio();
            audioRef.current = audio;

            // Set up event listeners
            audio.onloadstart = () => {
                console.log('Audio loading started');
            };

            audio.oncanplay = () => {
                console.log('Audio can start playing');
            };

            audio.onloadeddata = () => {
                console.log('Audio data loaded');
            };

            audio.onended = () => {
                console.log('Audio playback ended');
                setIsPlaying(false);
                setCurrentAudio('');

                // Clean up object URL
                if (audioUrl.startsWith('blob:')) {
                    URL.revokeObjectURL(audioUrl);
                }
            };

            audio.onerror = (event) => {
                console.error('Audio error event:', event);
                console.error('Audio error details:', {
                    error: audio.error,
                    networkState: audio.networkState,
                    readyState: audio.readyState,
                    src: audio.src
                });

                setIsPlaying(false);
                setCurrentAudio('');
                setError('Không thể phát audio');

                // Clean up object URL on error
                if (audioUrl.startsWith('blob:')) {
                    URL.revokeObjectURL(audioUrl);
                }
            };

            // Set source and load
            audio.src = audioUrl;
            setCurrentAudio(audioUrl);

            console.log('Loading audio:', {
                src: audio.src,
                mimeType
            });

            // Load and play
            audio.load();

            // Wait for audio to be ready
            await new Promise<void>((resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    reject(new Error('Audio loading timeout'));
                }, 10000); // 10 second timeout

                audio.oncanplaythrough = () => {
                    clearTimeout(timeoutId);
                    resolve();
                };

                audio.onerror = () => {
                    clearTimeout(timeoutId);
                    reject(new Error('Audio loading failed'));
                };
            });

            // Start playing
            setIsPlaying(true);
            await audio.play();

            console.log('Audio playback started successfully');

        } catch (error) {
            console.error('Error playing audio:', error);
            setIsPlaying(false);
            setCurrentAudio('');
            setError(`Lỗi phát audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }, [currentAudio, createAudioFromBase64]);

    const stopAudio = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;

            // Clean up object URL
            if (currentAudio.startsWith('blob:')) {
                URL.revokeObjectURL(currentAudio);
            }
        }

        setIsPlaying(false);
        setCurrentAudio('');
        setError('');
    }, [currentAudio]);

    // Cleanup on unmount
    React.useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
            }
            if (currentAudio.startsWith('blob:')) {
                URL.revokeObjectURL(currentAudio);
            }
        };
    }, [currentAudio]);

    return {
        isPlaying,
        currentAudio,
        error,
        playAudio,
        stopAudio,
        createAudioFromBase64
    };
};