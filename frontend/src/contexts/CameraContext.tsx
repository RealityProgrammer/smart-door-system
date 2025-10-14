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
import Webcam from "react-webcam";

export class CameraError {
  constructor(public message: string) {}
}

export type CameraState = 'disabled' | 'streaming' | CameraError;

interface CameraContextType {
  // References
  webcamRef: React.RefObject<Webcam | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  streamRef: React.RefObject<MediaStream | null>;

  // Camera states
  cameras: CameraDevice[];
  selectedCamera: string;
  cameraState : CameraState;
  modelsLoaded: boolean;

  // Camera control functions
  startStream: () => Promise<void>;
  stopStream: () => void;
  switchCamera: (cameraId: string) => Promise<void>;
  getCameras: () => Promise<void>;
  captureImage: () => string | null;

  // Setters
  setCameraState: (state: CameraState) => void;
  setModelsLoaded: (loaded: boolean) => void;

  // Debug info
  getVideoInfo: () => {
    hasVideo: boolean;
    videoWidth?: number;
    videoHeight?: number;
    cameraState: CameraState;
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
  const webcamRef = useRef<Webcam | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // States
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>("");
  const [cameraState, setCameraState] = useState<CameraState>('disabled');
  const [modelsLoaded, setModelsLoaded] = useState(false);

  // Check camera support
  const checkCameraSupport = useCallback(() => {
    if (!navigator?.mediaDevices?.getUserMedia) {
      setCameraState({
        message: "Trình duyệt không hỗ trợ camera API. Vui lòng sử dụng trình duyệt hiện đại khác."
      });
      return false;
    }

    if (
      window.location.protocol !== "https:" &&
      window.location.hostname !== "localhost"
    ) {
      setCameraState({
        message: "Camera API yêu cầu HTTPS hoặc localhost để hoạt động.",
      });
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
        setCameraState({
          message: "Không có quyền truy cập camera. Vui lòng cấp quyền và làm mới trang.",
        });
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
        setCameraState({
          message: "Không tìm thấy camera nào. Vui lòng kiểm tra kết nối camera."
        });
        return;
      }

      setCameras(videoDevices);
      if (!selectedCamera) {
        setSelectedCamera(videoDevices[0].deviceId);
        console.log("Set to camera " + videoDevices[0].deviceId);
      }

      setCameraState('disabled');
    } catch (error) {
      console.error("Error getting cameras:", error);

      setCameraState({
        message: "Lỗi khi truy cập camera: " + (error as Error).message,
      })
    }
  }, [checkCameraSupport, selectedCamera]);

  // Start camera stream
  const startStream = useCallback(async () => {
    try {
      if (!checkCameraSupport() || cameraState == 'streaming') return;

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      const constraints: MediaStreamConstraints = {
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
      setCameraState('streaming');

      if (canvasRef.current) {
        canvasRef.current.width = webcamRef.current?.video?.videoWidth || 640;
        canvasRef.current.height = webcamRef.current?.video?.videoHeight || 480;
      }

      if (webcamRef.current?.video) {
        webcamRef.current.video.onerror = (error) => {
          console.error("Video error:", error);
          setCameraState({
            message: "Lỗi video stream"
          });
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

      setCameraState({
        message: errorMessage,
      });
    }
  }, [checkCameraSupport, selectedCamera]);

  // Stop camera stream
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setCameraState('disabled');
  }, []);

  // Switch camera
  const switchCamera = useCallback(
    async (newCameraId: string) => {
      setSelectedCamera(newCameraId);

      if (cameraState == 'streaming') {
        stopStream();
        // Delay to ensure old camera is released
        setTimeout(() => {
          startStream();
          console.log('Start streaming via switch camera')
        }, 500);
      }
    },
    [cameraState, stopStream, startStream]
  );

  // Enhanced capture function with better error handling
  const captureImage = useCallback((): string | null => {
    const video = webcamRef.current?.video;

    // console.log("CameraContext captureImage called:", {
    //   hasVideo: !!videoRef.current,
    //   isStreaming,
    //   videoWidth: videoRef.current?.videoWidth,
    //   videoHeight: videoRef.current?.videoHeight,
    //   readyState: videoRef.current?.readyState,
    //   currentTime: videoRef.current?.currentTime,
    //   srcObject: !!videoRef.current?.srcObject,
    // });

    if (!video || cameraState != 'streaming') {
      console.log("Cannot capture: no video or not streaming");
      return null;
    }

    // Check if video is actually playing
    if (video.paused || video.ended) {
      console.log("Video is paused or ended");
      return null;
    }

    // Additional checks
    if (video.readyState < 2) {
      console.log("Video not ready, readyState:", video.readyState);
      return null;
    }

    if (!video.videoWidth || !video.videoHeight) {
      console.log("Video dimensions not available");
      return null;
    }

    try {
      // Create temporary canvas for capture
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        console.log("Cannot get canvas context");
        return null;
      }

      // Draw current video frame
      ctx.drawImage(video, 0, 0);
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
  }, [cameraState]);

  // Get video info for debugging
  const getVideoInfo = useCallback(() => {
    const video = webcamRef.current?.video;

    return {
      hasVideo: !!video,
      videoWidth: video?.videoWidth,
      videoHeight: video?.videoHeight,
      cameraState,
      readyState: video?.readyState,
      currentTime: video?.currentTime,
      paused: video?.paused,
      ended: video?.ended,
      srcObject: !!video?.srcObject,
    };
  }, [cameraState]);

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
    // videoRef,
    webcamRef,
    canvasRef,
    streamRef,
    cameraState,
    cameras,
    selectedCamera,
    modelsLoaded,
    startStream,
    stopStream,
    switchCamera,
    getCameras,
    captureImage,
    setCameraState,
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