"use client";

import React, {
  createContext,
  useContext,
  useRef,
  useState,
  useCallback,
  useEffect,
} from "react";
import { CameraDevice } from "@/types";

interface CameraContextType {
  // Video refs
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  streamRef: React.RefObject<MediaStream | null>;

  // Camera states
  isStreaming: boolean;
  cameras: CameraDevice[];
  selectedCamera: string;
  cameraError: string;
  modelsLoaded: boolean;

  // Camera control functions
  startStream: () => Promise<void>;
  stopStream: () => void;
  switchCamera: (cameraId: string) => Promise<void>;
  getCameras: () => Promise<void>;
  captureImage: () => string | null;

  // Setters
  setIsStreaming: (streaming: boolean) => void;
  setCameraError: (error: string) => void;
  setModelsLoaded: (loaded: boolean) => void;

  // Debug info
  getVideoInfo: () => {
    hasVideo: boolean;
    videoWidth?: number;
    videoHeight?: number;
    isStreaming: boolean;
    readyState?: number;
    currentTime?: number;
    paused?: boolean;
    ended?: boolean;
    srcObject: boolean;
  };
}

const CameraContext = createContext<CameraContextType | null>(null);

export function CameraProvider({ children }: { children: React.ReactNode }) {
  // Persistent refs - không bao giờ thay đổi
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // States
  const [isStreaming, setIsStreaming] = useState(false);
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>("");
  const [cameraError, setCameraError] = useState<string>("");
  const [modelsLoaded, setModelsLoaded] = useState(false);

  // Check camera support
  const checkCameraSupport = useCallback(() => {
    if (!navigator?.mediaDevices?.getUserMedia) {
      setCameraError(
        "Trình duyệt không hỗ trợ camera API. Vui lòng sử dụng trình duyệt hiện đại khác."
      );
      return false;
    }

    if (
      window.location.protocol !== "https:" &&
      window.location.hostname !== "localhost"
    ) {
      setCameraError("Camera API yêu cầu HTTPS hoặc localhost để hoạt động.");
      return false;
    }

    return true;
  }, []);

  // Get available cameras
  const getCameras = useCallback(async () => {
    try {
      if (!checkCameraSupport()) return;

      // Request permission first
      try {
        const tempStream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        tempStream.getTracks().forEach((track) => track.stop());
      } catch (permissionError) {
        setCameraError(
          "Không có quyền truy cập camera. Vui lòng cấp quyền và làm mới trang."
        );
        return;
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices
        .filter((device) => device.kind === "videoinput")
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${index + 1}`,
        }));

      if (videoDevices.length === 0) {
        setCameraError(
          "Không tìm thấy camera nào. Vui lòng kiểm tra kết nối camera."
        );
        return;
      }

      setCameras(videoDevices);
      if (!selectedCamera) {
        setSelectedCamera(videoDevices[0].deviceId);
      }
      setCameraError("");
    } catch (error) {
      console.error("Error getting cameras:", error);
      setCameraError("Lỗi khi truy cập camera: " + (error as Error).message);
    }
  }, [checkCameraSupport, selectedCamera]);

  // Start camera stream
  const startStream = useCallback(async () => {
    try {
      if (!checkCameraSupport()) return;

      setCameraError("");

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      const constraints = {
        video: {
          deviceId: selectedCamera ? { exact: selectedCamera } : undefined,
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30, max: 60 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;

        // Ensure video loads completely before playing
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current
              .play()
              .then(() => {
                // Wait a bit for video to stabilize
                setTimeout(() => {
                  setIsStreaming(true);
                  if (canvasRef.current && videoRef.current) {
                    canvasRef.current.width =
                      videoRef.current.videoWidth || 640;
                    canvasRef.current.height =
                      videoRef.current.videoHeight || 480;
                  }
                }, 500);
              })
              .catch((playError) => {
                console.error("Error playing video:", playError);
                setCameraError("Không thể phát video từ camera.");
              });
          }
        };

        // Handle video errors
        videoRef.current.onerror = (error) => {
          console.error("Video error:", error);
          setCameraError("Lỗi video stream");
        };
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      let errorMessage = "Không thể truy cập camera.";

      if (error instanceof Error) {
        if (error.name === "NotAllowedError") {
          errorMessage =
            "Quyền truy cập camera bị từ chối. Vui lòng cấp quyền và thử lại.";
        } else if (error.name === "NotFoundError") {
          errorMessage =
            "Không tìm thấy camera. Vui lòng kiểm tra kết nối camera.";
        } else if (error.name === "NotReadableError") {
          errorMessage = "Camera đang được sử dụng bởi ứng dụng khác.";
        } else if (error.name === "OverconstrainedError") {
          errorMessage = "Camera không hỗ trợ các thiết lập được yêu cầu.";
        }
      }

      setCameraError(errorMessage);
    }
  }, [checkCameraSupport, selectedCamera]);

  // Stop camera stream
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
    setCameraError("");
  }, []);

  // Switch camera
  const switchCamera = useCallback(
    async (newCameraId: string) => {
      setSelectedCamera(newCameraId);
      if (isStreaming) {
        stopStream();
        // Delay to ensure old camera is released
        setTimeout(() => {
          startStream();
        }, 500);
      }
    },
    [isStreaming, stopStream, startStream]
  );

  // Enhanced capture function with better error handling
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

  // Get video info for debugging
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

  // Load cameras on mount
  useEffect(() => {
    getCameras();
  }, [getCameras]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const contextValue: CameraContextType = {
    videoRef,
    canvasRef,
    streamRef,
    isStreaming,
    cameras,
    selectedCamera,
    cameraError,
    modelsLoaded,
    startStream,
    stopStream,
    switchCamera,
    getCameras,
    captureImage,
    setIsStreaming,
    setCameraError,
    setModelsLoaded,
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