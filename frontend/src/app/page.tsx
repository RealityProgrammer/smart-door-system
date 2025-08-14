"use client";

import { useState, useRef, useEffect } from "react";
import * as faceapi from "face-api.js";
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
import {
  Camera,
  Lock,
  Unlock,
  UserPlus,
  Activity,
  Users,
  AlertCircle,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CameraDevice {
  deviceId: string;
  label: string;
}

interface DetectedFace {
  detection: faceapi.FaceDetection;
  descriptor?: Float32Array;
}

export default function SmartDoorSystem() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>("");
  const [doorStatus, setDoorStatus] = useState<"locked" | "unlocked">("locked");
  const [recognitionStatus, setRecognitionStatus] = useState<
    "idle" | "scanning" | "recognized" | "unknown"
  >("idle");
  const [cameraError, setCameraError] = useState<string>("");
  const [isClient, setIsClient] = useState(false);
  const [detectedFaces, setDetectedFaces] = useState<DetectedFace[]>([]);
  const [modelsLoaded, setModelsLoaded] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load face-api.js models
  useEffect(() => {
    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
          faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
          faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
          faceapi.nets.faceExpressionNet.loadFromUri("/models"),
        ]);
        setModelsLoaded(true);
        console.log("Face-api.js models loaded successfully");
      } catch (error) {
        console.error("Error loading face-api.js models:", error);
        setCameraError("Không thể tải models nhận diện khuôn mặt");
      }
    };

    if (isClient) {
      loadModels();
    }
  }, [isClient]);

  // Đảm bảo component chỉ render sau khi mount (client-side)
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Face detection function
  const detectFaces = async () => {
    if (
      !videoRef.current ||
      !canvasRef.current ||
      !modelsLoaded ||
      !isStreaming
    )
      return;

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
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw face boxes and landmarks
        faceapi.draw.drawDetections(canvas, resizedDetections);
        faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);

        // Draw custom face boxes with labels
        resizedDetections.forEach((detection, index) => {
          const box = detection.detection.box;
          ctx.strokeStyle = "#00ff00";
          ctx.lineWidth = 3;
          ctx.strokeRect(box.x, box.y, box.width, box.height);

          // Add label
          ctx.fillStyle = "#00ff00";
          ctx.font = "16px Arial";
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
      console.error("Error detecting faces:", error);
    }
  };

  // Start face detection interval
  useEffect(() => {
    if (isStreaming && modelsLoaded) {
      detectionIntervalRef.current = setInterval(detectFaces, 300);
    } else if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }

    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
    };
  }, [isStreaming, modelsLoaded]);

  // Kiểm tra support và quyền camera
  const checkCameraSupport = () => {
    if (
      !navigator ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
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
  };

  // Lấy danh sách camera
  useEffect(() => {
    if (!isClient) return;

    const getCameras = async () => {
      try {
        // Kiểm tra support trước
        if (!checkCameraSupport()) return;

        // Yêu cầu quyền truy cập camera trước khi enumerate
        try {
          const tempStream = await navigator.mediaDevices.getUserMedia({
            video: true,
          });
          tempStream.getTracks().forEach((track) => track.stop()); // Dừng stream tạm thời
        } catch (permissionError) {
          setCameraError(
            "Không có quyền truy cập camera. Vui lòng cấp quyền và làm mới trang."
          );
          return;
        }

        // Lấy danh sách thiết bị
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
        setSelectedCamera(videoDevices[0].deviceId);
        setCameraError(""); // Xóa lỗi nếu thành công
      } catch (error) {
        console.error("Error getting cameras:", error);
        setCameraError("Lỗi khi truy cập camera: " + (error as Error).message);
      }
    };

    getCameras();
  }, [isClient]);

  // Bắt đầu stream video
  const startStream = async () => {
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

        // Đợi metadata load trước khi play
        videoRef.current.onloadedmetadata = () => {
          videoRef.current
            ?.play()
            .then(() => {
              setIsStreaming(true);
              // Setup canvas size
              if (canvasRef.current && videoRef.current) {
                canvasRef.current.width = videoRef.current.videoWidth;
                canvasRef.current.height = videoRef.current.videoHeight;
              }
            })
            .catch((playError) => {
              console.error("Error playing video:", playError);
              setCameraError("Không thể phát video từ camera.");
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

      setCameraError(errorMessage);
    }
  };

  // Dừng stream video
  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    setIsStreaming(false);
    setRecognitionStatus("idle");
    setDetectedFaces([]);
  };

  // Chụp ảnh để nhận diện
  const captureAndRecognize = async () => {
    if (!videoRef.current || !isStreaming || detectedFaces.length === 0) {
      alert("Không phát hiện khuôn mặt nào để nhận diện!");
      return;
    }

    setRecognitionStatus("scanning");

    try {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext("2d");

      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const imageData = canvas.toDataURL("image/jpeg", 0.8);

        // Gửi ảnh đến backend để nhận diện
        const response = await fetch("/api/faces/recognize", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ image: imageData }),
        });

        const result = await response.json();

        if (response.ok && result.result.recognized) {
          setRecognitionStatus("recognized");
          setDoorStatus("unlocked");

          // Tự động khóa sau 3 giây
          setTimeout(() => {
            setDoorStatus("locked");
            setRecognitionStatus("idle");
          }, 3000);
        } else {
          setRecognitionStatus("unknown");
          setTimeout(() => setRecognitionStatus("idle"), 2000);
        }
      }
    } catch (error) {
      console.error("Error recognizing face:", error);
      setRecognitionStatus("unknown");
      setTimeout(() => setRecognitionStatus("idle"), 2000);
    }
  };

  // Thêm khuôn mặt mới
  const addNewFace = async () => {
    if (!videoRef.current || !isStreaming || detectedFaces.length === 0) {
      alert("Không phát hiện khuôn mặt nào để thêm!");
      return;
    }

    const name = prompt("Nhập tên cho khuôn mặt mới:");
    if (!name) return;

    try {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext("2d");

      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const imageData = canvas.toDataURL("image/jpeg", 0.8);

        const response = await fetch("/api/faces/add", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name, image: imageData }),
        });

        if (response.ok) {
          alert("Đã thêm khuôn mặt mới thành công!");
        } else {
          const error = await response.json();
          alert("Lỗi: " + error.detail);
        }
      }
    } catch (error) {
      console.error("Error adding new face:", error);
      alert("Lỗi khi thêm khuôn mặt mới.");
    }
  };

  // Cleanup khi component unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Không render gì nếu chưa mount (tránh hydration mismatch)
  if (!isClient) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            Smart Door System
          </h1>
          <p className="text-gray-600">
            Hệ thống cửa thông minh với nhận diện khuôn mặt AI
          </p>
        </header>

        {/* Error Alert */}
        {cameraError && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-700">
              {cameraError}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Video Stream */}
          <div className="lg:col-span-2">
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
                          <SelectItem
                            key={camera.deviceId}
                            value={camera.deviceId}
                          >
                            {camera.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={isStreaming ? stopStream : startStream}
                      variant={isStreaming ? "destructive" : "default"}
                      disabled={cameras.length === 0 && !cameraError}
                    >
                      {isStreaming ? "Dừng" : "Bắt đầu"}
                    </Button>
                  </div>

                  {/* Video Display with Face Detection Overlay */}
                  <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden">
                    <video
                      ref={videoRef}
                      className="w-full h-full object-cover"
                      playsInline
                      muted
                      style={{ transform: "scaleX(-1)" }} // Mirror effect
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
                          <p>
                            {cameras.length === 0 && !cameraError
                              ? "Đang tải camera..."
                              : "Camera chưa được bật"}
                          </p>
                        </div>
                      </div>
                    )}

                    {recognitionStatus === "scanning" && (
                      <div className="absolute inset-0 bg-blue-500 bg-opacity-20 flex items-center justify-center">
                        <div className="bg-white rounded-lg p-4 shadow-lg">
                          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                          <p className="text-blue-700 font-medium">
                            Đang nhận diện...
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Face Detection Status */}
                    {isStreaming && (
                      <div className="absolute top-4 left-4">
                        <Badge
                          variant={
                            detectedFaces.length > 0 ? "default" : "secondary"
                          }
                        >
                          Phát hiện: {detectedFaces.length} khuôn mặt
                        </Badge>
                      </div>
                    )}
                  </div>

                  {/* Control Buttons */}
                  <div className="flex gap-2">
                    <Button
                      onClick={captureAndRecognize}
                      disabled={
                        !isStreaming ||
                        recognitionStatus === "scanning" ||
                        detectedFaces.length === 0
                      }
                      className="flex-1"
                    >
                      {recognitionStatus === "scanning"
                        ? "Đang quét..."
                        : "Nhận diện khuôn mặt"}
                    </Button>
                    <Button
                      onClick={addNewFace}
                      disabled={!isStreaming || detectedFaces.length === 0}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <UserPlus className="h-4 w-4" />
                      Thêm khuôn mặt
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Status Panel */}
          <div className="space-y-6">
            {/* Door Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {doorStatus === "locked" ? (
                    <Lock className="h-5 w-5 text-red-500" />
                  ) : (
                    <Unlock className="h-5 w-5 text-green-500" />
                  )}
                  Trạng thái cửa
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Badge
                  variant={doorStatus === "locked" ? "destructive" : "default"}
                  className="text-lg px-4 py-2"
                >
                  {doorStatus === "locked" ? "Đã khóa" : "Đã mở"}
                </Badge>
              </CardContent>
            </Card>

            {/* Recognition Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Trạng thái nhận diện
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Badge
                  variant={
                    recognitionStatus === "recognized"
                      ? "default"
                      : recognitionStatus === "scanning"
                      ? "secondary"
                      : recognitionStatus === "unknown"
                      ? "destructive"
                      : "outline"
                  }
                  className="text-lg px-4 py-2"
                >
                  {recognitionStatus === "idle" && "Chờ"}
                  {recognitionStatus === "scanning" && "Đang quét..."}
                  {recognitionStatus === "recognized" && "Đã nhận diện"}
                  {recognitionStatus === "unknown" && "Không nhận diện được"}
                </Badge>
              </CardContent>
            </Card>

            {/* System Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Thông tin hệ thống
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span>Cameras khả dụng:</span>
                  <Badge variant="outline">{cameras.length}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Khuôn mặt phát hiện:</span>
                  <Badge variant="outline">{detectedFaces.length}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>AI Models:</span>
                  <Badge variant={modelsLoaded ? "default" : "secondary"}>
                    {modelsLoaded ? "Đã tải" : "Đang tải"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
