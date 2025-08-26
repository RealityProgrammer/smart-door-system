import { useState, useRef, useEffect, useCallback } from 'react';
import * as faceapi from 'face-api.js';
import { DetectedFace } from '@/types';

export const useFaceDetection = (videoRef: React.RefObject<HTMLVideoElement | null>, canvasRef: React.RefObject<HTMLCanvasElement | null>) => {
    const [detectedFaces, setDetectedFaces] = useState<DetectedFace[]>([]);
    const [modelsLoaded, setModelsLoaded] = useState(false);
    const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Load face-api.js models
    const loadModels = useCallback(async () => {
        try {
            await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
                faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
                faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
                faceapi.nets.faceExpressionNet.loadFromUri('/models'),
            ]);
            setModelsLoaded(true);
            console.log('Face-api.js models loaded successfully');
        } catch (error) {
            console.error('Error loading face-api.js models:', error);
        }
    }, []);

    // Face detection function
    const detectFaces = useCallback(async () => {
        if (!videoRef.current || !canvasRef.current || !modelsLoaded) return;

        try {
            const detections = await faceapi
                .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks()
                .withFaceDescriptors();

            const canvas = canvasRef.current;
            const displaySize = {
                width: videoRef.current.videoWidth,
                height: videoRef.current.videoHeight,
            };

            faceapi.matchDimensions(canvas, displaySize);
            const resizedDetections = faceapi.resizeResults(detections, displaySize);

            // Clear canvas
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                // Draw face boxes and landmarks
                faceapi.draw.drawDetections(canvas, resizedDetections);
                faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);

                // Draw custom face boxes with labels
                resizedDetections.forEach((detection, index) => {
                    const box = detection.detection.box;
                    ctx.strokeStyle = '#00ff00';
                    ctx.lineWidth = 3;
                    ctx.strokeRect(box.x, box.y, box.width, box.height);

                    ctx.fillStyle = '#00ff00';
                    ctx.font = '16px Arial';
                    ctx.fillText(`Khuôn mặt ${index + 1}`, box.x, box.y - 5);
                });
            }

            setDetectedFaces(
                detections.map((d) => ({
                    detection: d.detection,
                    descriptor: d.descriptor,
                }))
            );
        } catch (error) {
            console.error('Error detecting faces:', error);
        }
    }, [videoRef, canvasRef, modelsLoaded]);

    // Start/stop detection
    const startDetection = useCallback(() => {
        if (modelsLoaded && !detectionIntervalRef.current) {
            detectionIntervalRef.current = setInterval(detectFaces, 300);
        }
    }, [detectFaces, modelsLoaded]);

    const stopDetection = useCallback(() => {
        if (detectionIntervalRef.current) {
            clearInterval(detectionIntervalRef.current);
            detectionIntervalRef.current = null;
        }
        setDetectedFaces([]);
    }, []);

    useEffect(() => {
        loadModels();
    }, [loadModels]);

    useEffect(() => {
        return () => {
            if (detectionIntervalRef.current) {
                clearInterval(detectionIntervalRef.current);
            }
        };
    }, []);

    return {
        detectedFaces,
        modelsLoaded,
        startDetection,
        stopDetection,
    };
};