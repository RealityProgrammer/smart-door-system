import React, { useState, useRef, useCallback } from 'react';

export interface SpeechRecognitionResult {
    transcript: string;
    isListening: boolean;
    isSupported: boolean;
}

export const useSpeechRecognition = () => {
    const [transcript, setTranscript] = useState<string>('');
    const [isListening, setIsListening] = useState<boolean>(false);
    const [isSupported, setIsSupported] = useState<boolean>(false);
    const [finalTranscript, setFinalTranscript] = useState<string>('');
    const [error, setError] = useState<string>(''); // Thêm state này

    const recognition = useRef<SpeechRecognition | null>(null);
    const mediaRecorder = useRef<MediaRecorder | null>(null);
    const audioChunks = useRef<Blob[]>([]);
    const silenceTimer = useRef<NodeJS.Timeout | null>(null);
    const autoStopCallback = useRef<(() => void) | null>(null);
    const isAutoStopping = useRef<boolean>(false);

    // Check browser support
    React.useEffect(() => {
        const checkSupport = () => {
            // Check Speech Recognition
            if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
                setIsSupported(true);

                const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                recognition.current = new SpeechRecognition();

                if (recognition.current) {
                    recognition.current.continuous = true;
                    recognition.current.interimResults = true;
                    recognition.current.lang = 'vi-VN';

                    recognition.current.onresult = (event) => {
                        let currentFinalTranscript = '';
                        let interimTranscript = '';

                        for (let i = event.resultIndex; i < event.results.length; i++) {
                            const result = event.results[i];
                            if (result.isFinal) {
                                currentFinalTranscript += result[0].transcript;
                            } else {
                                interimTranscript += result[0].transcript;
                            }
                        }

                        // Update transcripts
                        if (currentFinalTranscript) {
                            setFinalTranscript(prev => prev + currentFinalTranscript);
                        }
                        setTranscript(finalTranscript + currentFinalTranscript + interimTranscript);

                        // Reset silence timer when there's speech
                        if (silenceTimer.current) {
                            clearTimeout(silenceTimer.current);
                        }

                        // Set auto-stop timer only if we have final results
                        if (currentFinalTranscript.trim() && autoStopCallback.current && !isAutoStopping.current) {
                            console.log('Setting auto-stop timer...');
                            silenceTimer.current = setTimeout(() => {
                                console.log('Auto-stop triggered!');
                                if (autoStopCallback.current && !isAutoStopping.current) {
                                    isAutoStopping.current = true;
                                    autoStopCallback.current();
                                }
                            }, 2000); // 2 seconds
                        }
                    };

                    recognition.current.onend = () => {
                        console.log('Speech recognition ended');
                        setIsListening(false);
                        if (silenceTimer.current) {
                            clearTimeout(silenceTimer.current);
                        }
                    };

                    recognition.current.onerror = (event) => {
                        console.error('Speech recognition error:', event.error);
                        setIsListening(false);
                        if (silenceTimer.current) {
                            clearTimeout(silenceTimer.current);
                        }
                    };
                }
            }

            // Check MediaRecorder
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                console.warn('MediaRecorder not supported');
            }
        };

        checkSupport();
    }, [finalTranscript]);

    const startListening = useCallback((onAutoStop?: () => void) => {
        if (recognition.current && !isListening) {
            setTranscript('');
            setFinalTranscript('');
            setIsListening(true);
            autoStopCallback.current = onAutoStop || null;
            isAutoStopping.current = false;
            recognition.current.start();
        }
    }, [isListening]);

    const stopListening = useCallback(() => {
        if (recognition.current && isListening) {
            recognition.current.stop();
        }
        if (silenceTimer.current) {
            clearTimeout(silenceTimer.current);
            silenceTimer.current = null;
        }
        autoStopCallback.current = null;
        isAutoStopping.current = false;
    }, [isListening]);

    // MediaRecorder for backend processing
    const startRecording = useCallback(async (onAutoStop?: () => void) => {
        try {
            if (!navigator.mediaDevices) {
                throw new Error('MediaDevices not supported');
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 44100
                }
            });

            // Check MediaRecorder support and choose best format
            let mimeType = 'audio/webm';
            if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
                mimeType = 'audio/webm;codecs=opus';
            } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
                mimeType = 'audio/mp4';
            } else if (MediaRecorder.isTypeSupported('audio/mpeg')) {
                mimeType = 'audio/mpeg';
            }

            console.log('Using mime type:', mimeType);

            mediaRecorder.current = new MediaRecorder(stream, { mimeType });
            audioChunks.current = [];
            autoStopCallback.current = onAutoStop || null;
            isAutoStopping.current = false;

            mediaRecorder.current.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunks.current.push(event.data);
                }
            };

            mediaRecorder.current.start(100); // Collect data every 100ms
            setIsListening(true);
            setError(''); // Clear any previous errors

            // Set maximum recording time (30 seconds)
            setTimeout(() => {
                if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
                    console.log('Max recording time reached, stopping...');
                    stopRecording();
                }
            }, 30000);

        } catch (error) {
            console.error('Error starting recording:', error);
            setError('Không thể bắt đầu ghi âm: ' + (error as Error).message);
        }
    }, []);

    const stopRecording = useCallback((): Promise<Blob> => {
        return new Promise((resolve, reject) => {
            if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
                mediaRecorder.current.onstop = () => {
                    try {
                        const mimeType = mediaRecorder.current?.mimeType || 'audio/webm';
                        const audioBlob = new Blob(audioChunks.current, { type: mimeType });
                        console.log('Recording stopped, blob size:', audioBlob.size);
                        resolve(audioBlob);
                        setIsListening(false);
                        autoStopCallback.current = null;
                        isAutoStopping.current = false;
                    } catch (error) {
                        reject(error);
                    }
                };

                mediaRecorder.current.onerror = (error) => {
                    reject(error);
                };

                mediaRecorder.current.stop();

                // Stop all tracks
                if (mediaRecorder.current.stream) {
                    mediaRecorder.current.stream.getTracks().forEach(track => track.stop());
                }
            } else {
                reject(new Error('MediaRecorder not recording'));
            }
        });
    }, []);

    // Cleanup
    React.useEffect(() => {
        return () => {
            if (silenceTimer.current) {
                clearTimeout(silenceTimer.current);
            }
            if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
                mediaRecorder.current.stop();
                mediaRecorder.current.stream?.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    // Return error state
    return {
        transcript,
        finalTranscript,
        isListening,
        isSupported,
        error, // Thêm error vào return
        startListening,
        stopListening,
        startRecording,
        stopRecording,
        resetTranscript: () => {
            setTranscript('');
            setFinalTranscript('');
            setError('');
        }
    };
};
