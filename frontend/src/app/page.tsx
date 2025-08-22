"use client";

import { useState, useRef, useEffect, useCallback, JSX } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Camera,
  Lock,
  Unlock,
  UserPlus,
  Activity,
  Users,
  AlertCircle,
  Settings,
  Play,
  Pause,
  RotateCw,
  MessageSquare,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiService } from "@/services/api";
import { useFaceManagement } from "@/hooks/useFaceManagement";
import {
  DetectedFace,
  DoorStatus,
  RecognitionStatus,
  SystemInfo,
  AutoRecognitionState,
  VARIATION_TYPES,
} from "@/types";

// Import các components quản lý khuôn mặt
import { AddFaceDialog } from "@/components/FaceManagement/AddFaceDialog";
import { FaceList } from "@/components/FaceManagement/FaceList";
import { DoorStatus as DoorStatusComponent } from "@/components/Dashboard/DoorStatus";
import { RecognitionStatus as RecognitionStatusComponent } from "@/components/Dashboard/RecognotionStatus";
import { SystemInfo as SystemInfoComponent } from "@/components/Dashboard/SystemInfo";
import { VoiceInterface } from "@/components/VoiceChat/VoiceInterface";
import { CameraProvider, useCamera } from "@/contexts/CameraContext";

// Main component wrapped with camera context
function SmartDoorSystemContent(): JSX.Element | null {
  // Use shared camera context
  const {
    videoRef,
    canvasRef,
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
    setModelsLoaded,
  } = useCamera();

  // Recognition states
  const [doorStatus, setDoorStatus] = useState<DoorStatus>("locked");
  const [recognitionStatus, setRecognitionStatus] =
    useState<RecognitionStatus>("idle");
  const [detectedFaces, setDetectedFaces] = useState<DetectedFace[]>([]);
  const [autoStartCamera, setAutoStartCamera] = useState(true);

  // Auto recognition states
  const [autoRecognition, setAutoRecognition] = useState<AutoRecognitionState>({
    isActive: false,
    attemptCount: 0,
    maxAttempts: 10,
    cooldownUntil: null,
    lastAttempt: 0,
  });

  // UI states
  const [isClient, setIsClient] = useState(false);
  const [activeTab, setActiveTab] = useState("camera");

  // Multi-variation capture states
  const [isCapturingVariations, setIsCapturingVariations] = useState(false);
  const [currentVariationIndex, setCurrentVariationIndex] = useState(0);
  const [capturedVariations, setCapturedVariations] = useState<string[]>([]);
  const [personNameForVariations, setPersonNameForVariations] =
    useState<string>("");

  const { isLoading, addFaceVariation, faces, fetchFaces } =
    useFaceManagement();

  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const autoRecognitionIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load faces khi component mount
  useEffect(() => {
    fetchFaces();
  }, [fetchFaces]);

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
      }
    };

    if (isClient) {
      loadModels();
    }
  }, [isClient, setModelsLoaded]);

  // Đảm bảo component chỉ render sau khi mount (client-side)
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Auto-start camera when models loaded and cameras available
  useEffect(() => {
    if (
      isClient &&
      modelsLoaded &&
      cameras.length > 0 &&
      autoStartCamera &&
      !isStreaming
    ) {
      startStream();
    }
  }, [isClient, modelsLoaded, cameras.length, autoStartCamera, isStreaming, startStream]);

  // Face detection function
  const detectFaces = useCallback(async () => {
    if (
      !videoRef.current ||
      !canvasRef.current ||
      !modelsLoaded ||
      !isStreaming ||
      !videoRef.current.videoWidth ||
      !videoRef.current.videoHeight
    )
      return;

    try {
      // Đảm bảo video đã load metadata
      if (videoRef.current.readyState < 2) {
        return; // Video chưa sẵn sàng
      }

      const detections = await faceapi
        .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptors();

      const canvas = canvasRef.current;
      const displaySize = {
        width: videoRef.current.videoWidth || 640,
        height: videoRef.current.videoHeight || 480,
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
  }, [modelsLoaded, isStreaming, videoRef, canvasRef]);

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
  }, [isStreaming, modelsLoaded, detectFaces]);

  // Auto recognition logic
  const performAutoRecognition = async () => {
    console.log("🔍 Auto Recognition Check:", {
      isStreaming,
      detectedFacesCount: detectedFaces.length,
      recognitionStatus,
      autoRecognitionActive: autoRecognition.isActive,
      cooldownUntil: autoRecognition.cooldownUntil,
      attemptCount: autoRecognition.attemptCount,
      now: Date.now(),
    });

    if (
      !isStreaming ||
      detectedFaces.length === 0 ||
      recognitionStatus === "scanning"
    ) {
      console.log("❌ Early return:", {
        isStreaming,
        detectedFacesCount: detectedFaces.length,
        recognitionStatus,
      });
      return;
    }

    const now = Date.now();

    // Kiểm tra cooldown
    if (autoRecognition.cooldownUntil && now < autoRecognition.cooldownUntil) {
      console.log("❌ Still in cooldown:", {
        cooldownUntil: autoRecognition.cooldownUntil,
        remaining: (autoRecognition.cooldownUntil - now) / 1000,
      });
      return;
    }

    // Kiểm tra số lần thử
    if (autoRecognition.attemptCount >= autoRecognition.maxAttempts) {
      console.log("❌ Max attempts reached:", autoRecognition.attemptCount);
      setAutoRecognition((prev) => ({
        ...prev,
        cooldownUntil: now + 30000,
        attemptCount: 0,
      }));
      return;
    }

    // Kiểm tra interval giữa các lần thử (tối thiểu 2 giây)
    if (now - autoRecognition.lastAttempt < 2000) {
      console.log("❌ Too soon since last attempt:", {
        timeSince: now - autoRecognition.lastAttempt,
      });
      return;
    }

    console.log("✅ Starting recognition...");
    setRecognitionStatus("scanning");

    try {
      const imageBase64 = captureImage();
      if (!imageBase64) {
        throw new Error("Không thể chụp ảnh");
      }

      console.log("🔄 Calling API...");
      const result = await apiService.recognizeFace(imageBase64);
      console.log("📡 API Response:", result);

      setAutoRecognition((prev) => ({
        ...prev,
        attemptCount: prev.attemptCount + 1,
        lastAttempt: now,
      }));

      if (result.success && result.result) {
        const {
          recognized,
          name,
          confidence,
          distance,
          threshold,
          best_variation,
          message,
        } = result.result;

        if (recognized) {
          setRecognitionStatus("recognized");
          setDoorStatus("unlocked");

          // Hiển thị notification nhẹ nhàng
          const notification = document.createElement("div");
          notification.className =
            "fixed top-4 right-4 bg-green-500 text-white p-4 rounded-lg shadow-lg z-50";
          notification.innerHTML = `
            <div class="flex items-center gap-2">
              <div class="w-2 h-2 bg-white rounded-full"></div>
              <div>
                <div class="font-medium">Chào mừng ${name}!</div>
                <div class="text-sm opacity-90">Variation: ${
                  best_variation || "default"
                }</div>
              </div>
            </div>
          `;
          document.body.appendChild(notification);

          setTimeout(() => {
            if (notification && notification.parentNode) {
              notification.parentNode.removeChild(notification);
            }
          }, 3000);

          // Dừng auto recognition ngay khi nhận diện thành công
          stopAutoRecognition();

          setTimeout(() => {
            setDoorStatus("locked");
            setRecognitionStatus("idle");
          }, 5000);
          return; // Thoát luôn, không nhận diện nữa
        } else {
          setRecognitionStatus("unknown");

          // Hiển thị cảnh báo nhẹ chỉ khi hết attempts
          if (autoRecognition.attemptCount >= autoRecognition.maxAttempts - 1) {
            const notification = document.createElement("div");
            notification.className =
              "fixed top-4 right-4 bg-yellow-500 text-white p-4 rounded-lg shadow-lg z-50";
            notification.innerHTML = `
              <div class="flex items-center gap-2">
                <div class="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                <div>
                  <div class="font-medium">Không nhận diện được</div>
                  <div class="text-sm opacity-90">Thử lại sau 30 giây</div>
                </div>
              </div>
            `;
            document.body.appendChild(notification);

            setTimeout(() => {
              if (notification && notification.parentNode) {
                notification.parentNode.removeChild(notification);
              }
            }, 3000);
          }

          setTimeout(() => setRecognitionStatus("idle"), 1000);
        }
      }
    } catch (error) {
      console.error("Auto recognition error:", error);
      setRecognitionStatus("idle");
    }
  };

  // Start auto recognition
  const startAutoRecognition = () => {
    setAutoRecognition((prev) => ({
      ...prev,
      isActive: true,
      attemptCount: 0,
      cooldownUntil: null,
    }));
  };

  // Stop auto recognition
  const stopAutoRecognition = () => {
    setAutoRecognition((prev) => ({
      ...prev,
      isActive: false,
      attemptCount: 0,
      cooldownUntil: null,
    }));
    if (autoRecognitionIntervalRef.current) {
      clearInterval(autoRecognitionIntervalRef.current);
      autoRecognitionIntervalRef.current = null;
    }
  };

  // Auto recognition interval
  useEffect(() => {
    if (autoRecognition.isActive && isStreaming && modelsLoaded) {
      console.log("✅ Setting up auto recognition interval");
      const intervalId = setInterval(performAutoRecognition, 1000);
      autoRecognitionIntervalRef.current = intervalId;
    } else {
      if (autoRecognitionIntervalRef.current) {
        console.log("❌ Clearing auto recognition interval");
        clearInterval(autoRecognitionIntervalRef.current);
        autoRecognitionIntervalRef.current = null;
      }
    }

    return () => {
      if (autoRecognitionIntervalRef.current) {
        clearInterval(autoRecognitionIntervalRef.current);
        autoRecognitionIntervalRef.current = null;
      }
    };
  }, [autoRecognition.isActive, isStreaming, modelsLoaded]);

  // Multi-variation capture logic
  const startMultiVariationCapture = (personName: string) => {
    setPersonNameForVariations(personName);
    setIsCapturingVariations(true);
    setCurrentVariationIndex(0);
    setCapturedVariations([]);
  };

  const captureNextVariation = async () => {
    if (currentVariationIndex >= VARIATION_TYPES.length) {
      finishMultiVariationCapture();
      return;
    }

    const currentVariationType = VARIATION_TYPES[currentVariationIndex];
    const imageBase64 = captureImage();

    if (!imageBase64) {
      alert("Không thể chụp ảnh! Vui lòng kiểm tra camera.");
      return;
    }

    try {
      const success = await addFaceVariation(
        personNameForVariations,
        imageBase64,
        currentVariationType.value
      );

      if (success) {
        setCapturedVariations((prev) => [...prev, currentVariationType.value]);
        setCurrentVariationIndex((prev) => prev + 1);

        // Hiển thị hướng dẫn cho variation tiếp theo
        if (currentVariationIndex + 1 < VARIATION_TYPES.length) {
          const nextVariation = VARIATION_TYPES[currentVariationIndex + 1];
          const notification = document.createElement("div");
          notification.className =
            "fixed top-4 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white p-4 rounded-lg shadow-lg z-50 max-w-md";
          notification.innerHTML = `
            <div class="text-center">
              <div class="font-medium">✅ Đã chụp: ${currentVariationType.label}</div>
              <div class="text-sm mt-2">Tiếp theo: <strong>${nextVariation.label}</strong></div>
              <div class="text-xs opacity-90 mt-1">${nextVariation.description}</div>
            </div>
          `;
          document.body.appendChild(notification);

          setTimeout(() => {
            if (notification && notification.parentNode) {
              notification.parentNode.removeChild(notification);
            }
          }, 3000);
        }
      }
    } catch (error) {
      console.error("Error capturing variation:", error);
      alert("❌ Lỗi khi chụp variation: " + (error as Error).message);
    }
  };

  const finishMultiVariationCapture = async () => {
    setIsCapturingVariations(false);
    await fetchFaces();

    const notification = document.createElement("div");
    notification.className =
      "fixed top-4 left-1/2 transform -translate-x-1/2 bg-green-500 text-white p-4 rounded-lg shadow-lg z-50";
    notification.innerHTML = `
      <div class="text-center">
        <div class="font-medium">🎉 Hoàn thành!</div>
        <div class="text-sm">Đã chụp ${capturedVariations.length} variations cho ${personNameForVariations}</div>
      </div>
    `;
    document.body.appendChild(notification);

    setTimeout(() => {
      if (notification && notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 4000);

    // Reset states
    setPersonNameForVariations("");
    setCurrentVariationIndex(0);
    setCapturedVariations([]);
  };

  // Xử lý thêm khuôn mặt với variation
  const handleAddFaceVariation = async (
    name: string,
    variationType: string
  ): Promise<void> => {
    const imageBase64 = captureImage();
    if (!imageBase64) {
      alert("Không thể chụp ảnh! Vui lòng kiểm tra camera.");
      return;
    }

    try {
      const success = await addFaceVariation(name, imageBase64, variationType);
      if (success) {
        // Kiểm tra nếu là người mới và variation là default
        const isNewPerson = !faces.some((face) => face.name === name);
        const isDefaultVariation = variationType === "default";

        if (isNewPerson && isDefaultVariation) {
          // Hỏi có muốn chụp tất cả variations không
          const shouldCaptureAll = confirm(
            `✅ Đã thêm "${name}" thành công!\n\n` +
              `🎯 Để tăng độ chính xác nhận diện, hệ thống khuyến khích chụp thêm ${
                VARIATION_TYPES.length - 1
              } variations khác.\n\n` +
              `Bạn có muốn tiếp tục chụp tất cả variations ngay bây giờ không?\n\n` +
              `(Bạn có thể bỏ qua và thêm sau)`
          );

          if (shouldCaptureAll) {
            startMultiVariationCapture(name);
            return;
          }
        }

        alert(`✅ Đã thêm variation "${variationType}" cho ${name}!`);
        await fetchFaces();
      }
    } catch (error) {
      console.error("Add variation error:", error);
      alert("❌ Lỗi khi thêm variation: " + (error as Error).message);
    }
  };

  // Cleanup khi component unmount
  useEffect(() => {
    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
      if (autoRecognitionIntervalRef.current) {
        clearInterval(autoRecognitionIntervalRef.current);
      }
    };
  }, []);

  // Không render gì nếu chưa mount (tránh hydration mismatch)
  if (!isClient) {
    return null;
  }

  // Create systemInfo object
  const systemInfo: SystemInfo = {
    camerasAvailable: cameras.length,
    facesDetected: detectedFaces.length,
    modelsLoaded,
    totalFaces: faces.length,
  };

  // Tính toán trạng thái cooldown
  const cooldownRemaining = autoRecognition.cooldownUntil
    ? Math.max(
        0,
        Math.ceil((autoRecognition.cooldownUntil - Date.now()) / 1000)
      )
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto">
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

        {/* Multi-variation capture overlay */}
        {isCapturingVariations && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4">
              <CardHeader>
                <CardTitle className="text-center">
                  Chụp Variations cho {personNameForVariations}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {currentVariationIndex + 1} / {VARIATION_TYPES.length}
                  </div>
                  <div className="text-sm text-gray-600">
                    Progress:{" "}
                    {Math.round(
                      (currentVariationIndex / VARIATION_TYPES.length) * 100
                    )}
                    %
                  </div>
                </div>

                {currentVariationIndex < VARIATION_TYPES.length && (
                  <div className="text-center space-y-2">
                    <h3 className="text-lg font-medium">
                      {VARIATION_TYPES[currentVariationIndex].label}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {VARIATION_TYPES[currentVariationIndex].description}
                    </p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={captureNextVariation}
                    disabled={!isStreaming || detectedFaces.length === 0}
                    className="flex-1"
                  >
                    {currentVariationIndex >= VARIATION_TYPES.length
                      ? "Hoàn thành"
                      : "Chụp"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={finishMultiVariationCapture}
                  >
                    Bỏ qua
                  </Button>
                </div>

                {capturedVariations.length > 0 && (
                  <div className="text-xs text-gray-600">
                    Đã chụp: {capturedVariations.join(", ")}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="camera" className="flex items-center gap-2">
              <Camera className="h-4 w-4" />
              Camera & Nhận diện
            </TabsTrigger>
            <TabsTrigger value="management" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Quản lý khuôn mặt
            </TabsTrigger>
            <TabsTrigger value="voice" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Trợ lý giọng nói
            </TabsTrigger>
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
          </TabsList>

          {/* Camera Tab */}
          <TabsContent value="camera" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Video Stream */}
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Camera className="h-5 w-5" />
                      Camera Feed
                      {modelsLoaded && (
                        <Badge variant="outline">AI Ready</Badge>
                      )}
                      {autoRecognition.isActive && (
                        <Badge variant="secondary">
                          Auto Recognition {autoRecognition.attemptCount}/
                          {autoRecognition.maxAttempts}
                        </Badge>
                      )}
                      {cooldownRemaining > 0 && (
                        <Badge variant="destructive">
                          Cooldown: {cooldownRemaining}s
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Camera Controls */}
                      <div className="flex gap-2 items-center flex-wrap">
                        <Select
                          value={selectedCamera}
                          onValueChange={switchCamera}
                          disabled={cameras.length === 0}
                        >
                          <SelectTrigger className="w-full max-w-xs">
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
                          {isStreaming ? (
                            <>
                              <Pause className="h-4 w-4 mr-2" />
                              Dừng
                            </>
                          ) : (
                            <>
                              <Play className="h-4 w-4 mr-2" />
                              Bắt đầu
                            </>
                          )}
                        </Button>

                        <Button
                          onClick={getCameras}
                          variant="outline"
                          size="sm"
                        >
                          <RotateCw className="h-4 w-4 mr-1" />
                          Refresh
                        </Button>

                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="autoStart"
                            checked={autoStartCamera}
                            onChange={(e) =>
                              setAutoStartCamera(e.target.checked)
                            }
                          />
                          <label htmlFor="autoStart" className="text-sm">
                            Auto-start camera
                          </label>
                        </div>
                      </div>

                      {/* Video Display với Face Detection Overlay */}
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
                                {autoRecognition.isActive
                                  ? "Đang quét tự động..."
                                  : "Đang nhận diện..."}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Face Detection Status */}
                        {isStreaming && (
                          <div className="absolute top-4 left-4">
                            <Badge
                              variant={
                                detectedFaces.length > 0
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              Phát hiện: {detectedFaces.length} khuôn mặt
                            </Badge>
                          </div>
                        )}
                      </div>

                      {/* Control Buttons */}
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          onClick={() => {
                            console.log("🎯 Auto Recognition Button Clicked:", {
                              currentState: autoRecognition.isActive,
                              isStreaming,
                              modelsLoaded,
                            });

                            if (autoRecognition.isActive) {
                              stopAutoRecognition();
                            } else {
                              startAutoRecognition();
                            }
                          }}
                          disabled={!isStreaming || modelsLoaded === false}
                          variant={
                            autoRecognition.isActive ? "destructive" : "default"
                          }
                          className="flex-1 min-w-0"
                        >
                          {autoRecognition.isActive ? (
                            <>
                              <Pause className="h-4 w-4 mr-2" />
                              Dừng nhận diện tự động
                            </>
                          ) : (
                            <>
                              <Play className="h-4 w-4 mr-2" />
                              Bắt đầu nhận diện tự động
                            </>
                          )}
                        </Button>
                        {/* Nút Nhận diện lại */}
                        <Button
                          onClick={startAutoRecognition}
                          disabled={!isStreaming || autoRecognition.isActive}
                          variant="outline"
                          className="flex-1 min-w-0"
                        >
                          <Activity className="h-4 w-4 mr-2" />
                          Nhận diện lại
                        </Button>
                        <AddFaceDialog
                          onCapture={handleAddFaceVariation}
                          isLoading={isLoading}
                        />
                      </div>

                      {/* Auto Recognition Info */}
                      {isStreaming && (
                        <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              Status:{" "}
                              {autoRecognition.isActive
                                ? "🟢 Active"
                                : "🔴 Inactive"}
                            </div>
                            <div>
                              Attempts: {autoRecognition.attemptCount}/
                              {autoRecognition.maxAttempts}
                            </div>
                            <div>Faces: {detectedFaces.length}</div>
                            <div>
                              {cooldownRemaining > 0
                                ? `Cooldown: ${cooldownRemaining}s`
                                : "Ready"}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Status Panel */}
              <div className="space-y-6">
                <DoorStatusComponent status={doorStatus} />
                <RecognitionStatusComponent status={recognitionStatus} />
                <SystemInfoComponent systemInfo={systemInfo} />
              </div>
            </div>
          </TabsContent>

          {/* Face Management Tab */}
          <TabsContent value="management" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Add Face Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserPlus className="h-5 w-5" />
                    Thêm khuôn mặt mới
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                      Camera đang được chia sẻ với tất cả các tab. Bạn có thể thêm khuôn mặt từ bất kỳ tab nào.
                    </p>
                    <AddFaceDialog
                      onCapture={handleAddFaceVariation}
                      isLoading={isLoading}
                    />

                    {/* Hướng dẫn */}
                    <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded">
                      <h4 className="font-medium mb-2">💡 Hướng dẫn tối ưu:</h4>
                      <ul className="space-y-1 text-xs">
                        <li>
                          • <strong>Người mới:</strong> Hệ thống sẽ tự động
                          hướng dẫn chụp tất cả variations
                        </li>
                        <li>
                          • <strong>Variations có sẵn:</strong>{" "}
                          {VARIATION_TYPES.map((v) => v.label).join(", ")}
                        </li>
                        <li>
                          • <strong>Chất lượng ảnh:</strong> Rõ nét, đủ sáng,
                          khuôn mặt thẳng
                        </li>
                        <li>
                          • <strong>Nhận diện tự động:</strong> Hoạt động 24/7
                          với limit 10 lần/30s
                        </li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Face List */}
              <FaceList onDeleteSuccess={fetchFaces} />
            </div>
          </TabsContent>

          {/* Voice Assistant Tab - Now using shared camera */}
          <TabsContent value="voice" className="mt-6">
            <VoiceInterface />
          </TabsContent>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <DoorStatusComponent status={doorStatus} />
              <RecognitionStatusComponent status={recognitionStatus} />
              <SystemInfoComponent systemInfo={systemInfo} />

              {/* Statistics Card */}
              <Card>
                <CardHeader>
                  <CardTitle>Thống kê</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span>Tổng số người:</span>
                    <Badge variant="outline">{faces.length}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Tổng variations:</span>
                    <Badge variant="outline">
                      {faces.reduce(
                        (total, face) => total + (face.total_variations || 1),
                        0
                      )}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Lần nhận diện:</span>
                    <Badge variant="outline">
                      {faces.reduce(
                        (total, face) => total + (face.recognition_count || 0),
                        0
                      )}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Auto Recognition:</span>
                    <Badge
                      variant={
                        autoRecognition.isActive ? "default" : "secondary"
                      }
                    >
                      {autoRecognition.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// Main export với CameraProvider wrapper
export default function SmartDoorSystem() {
  return (
    <CameraProvider>
      <SmartDoorSystemContent />
    </CameraProvider>
  );
}