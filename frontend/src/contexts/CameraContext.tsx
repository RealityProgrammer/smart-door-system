"use client";

import React, {
  createContext,
  useContext,
  useRef,
  useState,
  useCallback,
  useEffect,
} from "react";

interface CameraContextType {
  // Video ref và stream
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  streamRef: React.RefObject<MediaStream | null>;

  // States
  isStreaming: boolean;
  setIsStreaming: (streaming: boolean) => void;

  // Functions
  captureImage: () => string | null;

  // For debugging
  getVideoInfo: () => {
    hasVideo: boolean;
    videoWidth?: number;
    videoHeight?: number;
    isStreaming: boolean;
  };
}

const CameraContext = createContext<CameraContextType | null>(null);

export function CameraProvider({ children }: { children: React.ReactNode }) {
  // Persistent refs - không bao giờ thay đổi
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  // Enhanced capture function với better error handling
  const captureImage = useCallback((): string | null => {
    console.log("CameraContext captureImage called:", {
      hasVideo: !!videoRef.current,
      isStreaming,
      videoWidth: videoRef.current?.videoWidth,
      videoHeight: videoRef.current?.videoHeight,
      readyState: videoRef.current?.readyState,
      currentTime: videoRef.current?.currentTime,
      srcObject: !!videoRef.current?.srcObject,
    });

    if (!videoRef.current || !isStreaming) {
      console.log("Cannot capture: no video or not streaming");
      return null;
    }

    // Check if video is actually playing
    if (videoRef.current.paused || videoRef.current.ended) {
      console.log("Video is paused or ended");
      return null;
    }

    // Additional checks
    if (videoRef.current.readyState < 2) {
      console.log("Video not ready, readyState:", videoRef.current.readyState);
      return null;
    }

    if (!videoRef.current.videoWidth || !videoRef.current.videoHeight) {
      console.log("Video dimensions not available");
      return null;
    }

    try {
      // Create temporary canvas for capture
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        console.log("Cannot get canvas context");
        return null;
      }

      // Draw current video frame
      ctx.drawImage(videoRef.current, 0, 0);
      const dataURL = canvas.toDataURL("image/jpeg", 0.8);

      console.log("Image captured successfully:", {
        dataURLLength: dataURL.length,
        canvasSize: `${canvas.width}x${canvas.height}`,
        preview: dataURL.substring(0, 50) + "...",
      });

      return dataURL;
    } catch (error) {
      console.error("Error capturing image:", error);
      return null;
    }
  }, [isStreaming]);

  const getVideoInfo = useCallback(() => {
    return {
      hasVideo: !!videoRef.current,
      videoWidth: videoRef.current?.videoWidth,
      videoHeight: videoRef.current?.videoHeight,
      isStreaming,
      readyState: videoRef.current?.readyState,
      currentTime: videoRef.current?.currentTime,
      paused: videoRef.current?.paused,
      ended: videoRef.current?.ended,
      srcObject: !!videoRef.current?.srcObject,
    };
  }, [isStreaming]);

  const contextValue: CameraContextType = {
    videoRef,
    canvasRef,
    streamRef,
    isStreaming,
    setIsStreaming,
    captureImage,
    getVideoInfo,
  };

  return (
    <CameraContext.Provider value={contextValue}>
      {children}
    </CameraContext.Provider>
  );
}

export function useCamera() {
  const context = useContext(CameraContext);
  if (!context) {
    throw new Error("useCamera must be used within a CameraProvider");
  }
  return context;
}
