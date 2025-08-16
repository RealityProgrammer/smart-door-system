import { useState, useRef, useEffect, useCallback } from 'react';
import { CameraDevice } from '@/types';

export const useCamera = () => {
    const [isStreaming, setIsStreaming] = useState(false);
    const [cameras, setCameras] = useState<CameraDevice[]>([]);
    const [selectedCamera, setSelectedCamera] = useState<string>('');
    const [error, setError] = useState<string>('');

    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const checkCameraSupport = useCallback(() => {
        if (!navigator?.mediaDevices?.getUserMedia) {
            setError('Trình duyệt không hỗ trợ camera API');
            return false;
        }

        if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
            setError('Camera API yêu cầu HTTPS hoặc localhost');
            return false;
        }

        return true;
    }, []);

    const getCameras = useCallback(async () => {
        if (!checkCameraSupport()) return;

        try {
            const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
            tempStream.getTracks().forEach(track => track.stop());

            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices
                .filter(device => device.kind === 'videoinput')
                .map((device, index) => ({
                    deviceId: device.deviceId,
                    label: device.label || `Camera ${index + 1}`,
                }));

            if (videoDevices.length === 0) {
                setError('Không tìm thấy camera nào');
                return;
            }

            setCameras(videoDevices);
            setSelectedCamera(videoDevices[0].deviceId);
            setError('');
        } catch (error) {
            console.error('Error getting cameras:', error);
            setError('Không thể truy cập camera');
        }
    }, [checkCameraSupport]);

    const startStream = useCallback(async () => {
        if (!checkCameraSupport()) return;

        try {
            setError('');

            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }

            const constraints = {
                video: {
                    deviceId: selectedCamera ? { exact: selectedCamera } : undefined,
                    width: { ideal: 1280, max: 1920 },
                    height: { ideal: 720, max: 1080 },
                    frameRate: { ideal: 30 },
                },
                audio: false,
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = stream;

            if (videoRef.current) {
                videoRef.current.srcObject = stream;

                await new Promise<void>((resolve, reject) => {
                    const video = videoRef.current!;
                    video.onloadedmetadata = () => {
                        video.play()
                            .then(() => {
                                setIsStreaming(true);
                                resolve();
                            })
                            .catch(reject);
                    };
                    video.onerror = reject;
                });
            }
        } catch (error) {
            console.error('Error starting stream:', error);
            setError('Không thể truy cập camera');
        }
    }, [selectedCamera, checkCameraSupport]);

    const stopStream = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setIsStreaming(false);
    }, []);

    const captureImage = useCallback((): string | null => {
        if (!videoRef.current || !isStreaming) return null;

        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth || 640;
        canvas.height = videoRef.current.videoHeight || 480;

        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        ctx.drawImage(videoRef.current, 0, 0);
        return canvas.toDataURL('image/jpeg', 0.8);
    }, [isStreaming]);

    useEffect(() => {
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    return {
        videoRef,
        isStreaming,
        cameras,
        selectedCamera,
        error,
        setSelectedCamera,
        getCameras,
        startStream,
        stopStream,
        captureImage,
    };
};