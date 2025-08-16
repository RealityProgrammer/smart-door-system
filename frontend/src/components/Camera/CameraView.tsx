"use client";

import { useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Camera } from "lucide-react";
import { useCamera } from "@/hooks/useCamera";
import { useFaceDetection } from "@/hooks/useFaceDetection";
import { FaceDetectionOverlay } from "./FaceDetectionOverlay";

interface CameraViewProps {
  onCapture: (imageBase64: string) => void;
  isScanning?: boolean;
}

export function CameraView({ onCapture, isScanning }: CameraViewProps) {
  const {
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
  } = useCamera();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { detectedFaces, modelsLoaded, startDetection, stopDetection } =
    useFaceDetection(videoRef, canvasRef);

  useEffect(() => {
    getCameras();
  }, [getCameras]);

  useEffect(() => {
    if (isStreaming && modelsLoaded) {
      startDetection();
    } else {
      stopDetection();
    }
  }, [isStreaming, modelsLoaded, startDetection, stopDetection]);

  const handleCapture = () => {
    const imageBase64 = captureImage();
    if (imageBase64) {
      onCapture(imageBase64);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-5 w-5" />
          Camera Feed
          {modelsLoaded && <Badge variant="outline">AI Ready</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Camera Selection */}
          <div className="flex gap-4 items-center">
            <Select
              value={selectedCamera}
              onValueChange={setSelectedCamera}
              disabled={isStreaming || cameras.length === 0}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Chọn camera" />
              </SelectTrigger>
              <SelectContent>
                {cameras.map((camera) => (
                  <SelectItem key={camera.deviceId} value={camera.deviceId}>
                    {camera.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={isStreaming ? stopStream : startStream}
              variant={isStreaming ? "destructive" : "default"}
              disabled={cameras.length === 0}
            >
              {isStreaming ? "Dừng" : "Bắt đầu"}
            </Button>
          </div>

          {/* Video Display */}
          <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
              style={{ transform: "scaleX(-1)" }}
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full"
              style={{ transform: "scaleX(-1)" }}
            />

            {!isStreaming && (
              <div className="absolute inset-0 flex items-center justify-center text-white">
                <div className="text-center">
                  <Camera className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>{error || "Camera chưa được bật"}</p>
                </div>
              </div>
            )}

            <FaceDetectionOverlay
              detectedFaces={detectedFaces}
              isScanning={isScanning}
              isStreaming={isStreaming}
            />
          </div>

          {/* Control Button */}
          <Button
            onClick={handleCapture}
            disabled={!isStreaming || detectedFaces.length === 0}
            className="w-full"
          >
            Chụp ảnh ({detectedFaces.length} khuôn mặt)
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
