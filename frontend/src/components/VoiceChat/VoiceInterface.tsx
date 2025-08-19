"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Mic,
  MicOff,
  Camera,
  Volume2,
  VolumeX,
  MessageSquare,
  Loader2,
  Trash2,
  Send,
  AlertCircle,
  Play,
  Pause,
  RotateCw,
  Settings,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useVoiceChat } from "@/hooks/useVoiceChat";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { useFaceDetection } from "@/hooks/useFaceDetection";
import { CameraDevice } from "@/types";

interface VoiceInterfaceProps {
  onCaptureImage?: () => string | null; // Make optional since we'll have our own
  isStreaming?: boolean; // Make optional
}

export function VoiceInterface({
  onCaptureImage,
  isStreaming: externalStreaming,
}: VoiceInterfaceProps) {
  const [mode, setMode] = useState<"voice" | "text">("voice");
  const [textInput, setTextInput] = useState("");
  const [pendingAudioBlob, setPendingAudioBlob] = useState<Blob | null>(null);

  // Internal camera states
  const [internalStreaming, setInternalStreaming] = useState(false);
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>("");
  const [cameraError, setCameraError] = useState<string>("");
  const [showCameraSettings, setShowCameraSettings] = useState(false);

  // Refs for internal camera
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Ưu tiên sử dụng external streaming nếu có
  const isStreaming = externalStreaming ?? internalStreaming;
  const hasExternalCamera = typeof externalStreaming === "boolean";

  const {
    transcript,
    finalTranscript,
    isListening,
    isSupported,
    error: speechError,
    startListening,
    stopListening,
    startRecording,
    stopRecording,
    resetTranscript,
  } = useSpeechRecognition();

  const {
    messages,
    isProcessing,
    error: chatError,
    processVoiceHealthInquiry,
    sendTextMessage,
    clearChat,
  } = useVoiceChat();

  const {
    isPlaying,
    currentAudio,
    error: audioError,
    playAudio,
    stopAudio,
  } = useAudioPlayer();

  // Face detection for internal camera
  const { detectedFaces, modelsLoaded, startDetection, stopDetection } =
    useFaceDetection(videoRef, canvasRef);

  // Camera support check
  const checkCameraSupport = useCallback(() => {
    if (!navigator?.mediaDevices?.getUserMedia) {
      setCameraError(
        "Trình duyệt không hỗ trợ camera API. Vui lòng sử dụng Chrome hoặc Edge."
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
          "Không có quyền truy cập camera. Vui lòng cấp quyền trong trình duyệt."
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

  // Start internal camera stream
  const startInternalStream = useCallback(async () => {
    try {
      if (!checkCameraSupport()) return;

      setCameraError("");

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      const constraints = {
        video: {
          deviceId: selectedCamera ? { exact: selectedCamera } : undefined,
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;

        videoRef.current.onloadedmetadata = () => {
          videoRef.current
            ?.play()
            .then(() => {
              setInternalStreaming(true);
              if (canvasRef.current && videoRef.current) {
                canvasRef.current.width = videoRef.current.videoWidth || 640;
                canvasRef.current.height = videoRef.current.videoHeight || 480;
              }
            })
            .catch((playError) => {
              console.error("Error playing video:", playError);
              setCameraError("Không thể phát video từ camera.");
            });
        };

        videoRef.current.onerror = () => {
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
        }
      }

      setCameraError(errorMessage);
    }
  }, [checkCameraSupport, selectedCamera]);

  // Stop internal camera stream
  const stopInternalStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setInternalStreaming(false);
    stopDetection();
  }, [stopDetection]);

  // Switch camera
  const switchCamera = useCallback(
    async (newCameraId: string) => {
      setSelectedCamera(newCameraId);
      if (internalStreaming) {
        stopInternalStream();
        setTimeout(() => {
          startInternalStream();
        }, 500);
      }
    },
    [internalStreaming, stopInternalStream, startInternalStream]
  );

  // Capture image function
  const captureInternalImage = useCallback((): string | null => {
    const activeVideoRef = videoRef.current;
    const activeStreaming = isStreaming;

    if (!activeVideoRef || !activeStreaming) return null;

    const canvas = document.createElement("canvas");
    canvas.width = activeVideoRef.videoWidth || 640;
    canvas.height = activeVideoRef.videoHeight || 480;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(activeVideoRef, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.8);
  }, [isStreaming]);

  // Start face detection when streaming
  useEffect(() => {
    if (internalStreaming && modelsLoaded) {
      startDetection();
    } else {
      stopDetection();
    }
  }, [internalStreaming, modelsLoaded, startDetection, stopDetection]);

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

  const handleVoiceInquiry = async () => {
    // Use external capture function if available, otherwise use internal
    const captureFunction = onCaptureImage || captureInternalImage;

    if (!isStreaming) {
      alert("Vui lòng bật camera trước khi sử dụng chức năng này");
      return;
    }

    const faceImage = captureFunction();
    if (!faceImage) {
      alert("Không thể chụp ảnh khuôn mặt. Vui lòng đảm bảo camera hoạt động.");
      return;
    }

    if (mode === "voice") {
      if (!isListening) {
        setPendingAudioBlob(null);
        await startRecording();
      } else {
        try {
          const audioBlob = await stopRecording();
          setPendingAudioBlob(audioBlob);
          await processVoiceHealthInquiry(audioBlob, faceImage);
          setPendingAudioBlob(null);
        } catch (error) {
          console.error("Recording error:", error);
          alert("Lỗi khi ghi âm: " + (error as Error).message);
        }
      }
    } else {
      if (!textInput.trim()) {
        alert("Vui lòng nhập câu hỏi");
        return;
      }
      await sendTextMessage(textInput, faceImage);
      setTextInput("");
    }
  };

  const handlePlayAudio = async (message: any) => {
    if (!message.audioBase64) return;

    try {
      if (currentAudio === message.id && isPlaying) {
        stopAudio();
      } else {
        await playAudio(message.audioBase64, message.audioMimeType);
      }
    } catch (error) {
      console.error("Audio play error:", error);
    }
  };

  // Show error if speech recognition not supported in voice mode
  if (mode === "voice" && !isSupported) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Trình duyệt không hỗ trợ nhận diện giọng nói. Vui lòng chuyển sang chế
          độ text hoặc sử dụng Chrome/Edge.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Chỉ hiển thị Camera Section nếu KHÔNG có external camera */}
      {!hasExternalCamera && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Camera cho trợ lý AI
                {modelsLoaded && <Badge variant="outline">AI Ready</Badge>}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCameraSettings(!showCameraSettings)}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Camera Settings */}
            {showCameraSettings && (
              <div className="p-4 border rounded-lg bg-gray-50 space-y-4">
                <div className="flex gap-2 items-center">
                  <Select
                    value={selectedCamera}
                    onValueChange={switchCamera}
                    disabled={internalStreaming || cameras.length === 0}
                  >
                    <SelectTrigger className="flex-1">
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
                  <Button onClick={getCameras} variant="outline" size="sm">
                    <RotateCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Camera Error */}
            {cameraError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{cameraError}</AlertDescription>
              </Alert>
            )}

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
                    <p>
                      {cameras.length === 0 && !cameraError
                        ? "Đang tải camera..."
                        : "Camera chưa được bật"}
                    </p>
                  </div>
                </div>
              )}

              {/* Face Detection Status */}
              {isStreaming && (
                <div className="absolute top-4 left-4">
                  <Badge
                    variant={detectedFaces.length > 0 ? "default" : "secondary"}
                  >
                    Phát hiện: {detectedFaces.length} khuôn mặt
                  </Badge>
                </div>
              )}
            </div>

            {/* Camera Controls */}
            <div className="flex gap-2">
              <Button
                onClick={
                  internalStreaming ? stopInternalStream : startInternalStream
                }
                variant={internalStreaming ? "destructive" : "default"}
                disabled={cameras.length === 0 && !cameraError}
                className="flex-1"
              >
                {internalStreaming ? (
                  <>
                    <Pause className="h-4 w-4 mr-2" />
                    Dừng camera
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Bật camera
                  </>
                )}
              </Button>
            </div>

            {/* Camera Help */}
            {!isStreaming && (
              <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded">
                <h4 className="font-medium mb-1">💡 Hướng dẫn bật camera:</h4>
                <ul className="text-xs space-y-1">
                  <li>• Nhấn nút "Bật camera" ở trên</li>
                  <li>• Cho phép truy cập camera khi trình duyệt hỏi</li>
                  <li>• Đảm bảo khuôn mặt rõ ràng trong khung hình</li>
                  <li>• Camera cần thiết để AI phân tích sức khỏe khuôn mặt</li>
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Hiển thị thông báo khi sử dụng camera external */}
      {hasExternalCamera && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg">
              <Camera className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-green-800">
                  Đang sử dụng camera từ tab "Camera & Nhận diện"
                </p>
                <p className="text-xs text-green-600">
                  {isStreaming
                    ? `✅ Camera đang hoạt động - Có thể sử dụng trợ lý giọng nói`
                    : `❌ Vui lòng bật camera ở tab "Camera & Nhận diện" trước`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Voice Assistant Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Trợ lý sức khỏe AI
            {hasExternalCamera && isStreaming && (
              <Badge variant="default">Sẵn sàng</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mode Toggle */}
          <div className="flex gap-2">
            <Button
              variant={mode === "voice" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("voice")}
              disabled={!isSupported}
            >
              <Mic className="h-4 w-4 mr-1" />
              Giọng nói
            </Button>
            <Button
              variant={mode === "text" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("text")}
            >
              <MessageSquare className="h-4 w-4 mr-1" />
              Văn bản
            </Button>
          </div>

          {/* Voice Mode Controls */}
          {mode === "voice" && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Button
                  onClick={handleVoiceInquiry}
                  disabled={isProcessing || !isSupported || !isStreaming}
                  variant={isListening ? "destructive" : "default"}
                  className="flex items-center gap-2"
                >
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isListening ? (
                    <MicOff className="h-4 w-4" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                  {isProcessing
                    ? "Đang xử lý..."
                    : isListening
                    ? "Dừng & Phân tích"
                    : "Bắt đầu nói"}
                </Button>

                <Button
                  onClick={resetTranscript}
                  variant="outline"
                  size="sm"
                  disabled={isListening || isProcessing}
                >
                  Xóa
                </Button>
              </div>

              {/* Transcript Display */}
              {transcript && (
                <div className="p-3 bg-gray-50 rounded">
                  <p className="text-sm font-medium mb-1">Bạn đang nói:</p>
                  <p className="text-gray-700">{transcript}</p>
                  {finalTranscript && (
                    <p className="text-xs text-green-600 mt-1">
                      ✓ Đã hoàn thành
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Text Mode Controls */}
          {mode === "text" && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Nhập câu hỏi về sức khỏe khuôn mặt..."
                  onKeyPress={(e) => {
                    if (e.key === "Enter" && !isProcessing) {
                      handleVoiceInquiry();
                    }
                  }}
                  disabled={isProcessing || !isStreaming}
                />
                <Button
                  onClick={handleVoiceInquiry}
                  disabled={!textInput.trim() || isProcessing || !isStreaming}
                >
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Status */}
          <div className="flex gap-2 flex-wrap">
            {mode === "voice" && (
              <Badge variant={isListening ? "default" : "secondary"}>
                {isListening ? "Đang nghe..." : "Không hoạt động"}
              </Badge>
            )}
            {isProcessing && <Badge variant="outline">Đang xử lý AI...</Badge>}
            {isPlaying && <Badge variant="outline">Đang phát audio</Badge>}
            {pendingAudioBlob && (
              <Badge variant="outline">Có audio chờ xử lý</Badge>
            )}
            {!isStreaming && (
              <Badge variant="destructive">Cần bật camera</Badge>
            )}
          </div>

          {/* Errors */}
          {(speechError || chatError || audioError) && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {speechError || chatError || audioError}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Conversation History */}
      {messages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Lịch sử hội thoại</span>
              <Button variant="outline" size="sm" onClick={clearChat}>
                <Trash2 className="h-4 w-4 mr-1" />
                Xóa
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.type === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-3 py-2 rounded-lg ${
                      message.type === "user"
                        ? "bg-blue-500 text-white"
                        : message.type === "system"
                        ? "bg-red-500 text-white"
                        : "bg-gray-200 text-gray-800"
                    }`}
                  >
                    <p className="text-sm">{message.text}</p>

                    {/* Audio Play Button */}
                    {message.audioBase64 && (
                      <div className="flex items-center gap-2 mt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePlayAudio(message)}
                          className="h-6 px-2"
                        >
                          {currentAudio && isPlaying ? (
                            <VolumeX className="h-3 w-3" />
                          ) : (
                            <Volume2 className="h-3 w-3" />
                          )}
                        </Button>
                        <span className="text-xs opacity-70">
                          {message.audioFormat?.toUpperCase() || "MP3"}
                        </span>
                      </div>
                    )}

                    <p className="text-xs opacity-70 mt-1">
                      {message.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card>
        <CardContent className="pt-6">
          <div className="text-sm text-gray-600 space-y-2">
            <h4 className="font-medium">Hướng dẫn sử dụng:</h4>
            <ul className="text-xs space-y-1">
              <li>
                • <strong>Bước 1:</strong> Bật camera ở phần trên để AI có thể
                thấy khuôn mặt bạn
              </li>
              <li>
                • <strong>Bước 2:</strong> Chọn chế độ giọng nói hoặc văn bản
              </li>
              <li>
                • <strong>Chế độ giọng nói:</strong> Nhấn mic và nói câu hỏi
              </li>
              <li>
                • <strong>Chế độ văn bản:</strong> Gõ câu hỏi và nhấn Enter
              </li>
              <li>• AI sẽ phân tích khuôn mặt và trả lời bằng âm thanh</li>
              <li>• Ví dụ: "Khuôn mặt tôi có vẻ mệt mỏi không?"</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
