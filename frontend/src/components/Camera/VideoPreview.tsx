"use client";

import { useCamera } from "@/contexts/CameraContext";
import { Badge } from "@/components/ui/badge";

export function VideoPreview({ className = "" }: { className?: string }) {
  const { videoRef, canvasRef, isStreaming, getVideoInfo } = useCamera();

  if (!isStreaming) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-800 text-white ${className}`}
      >
        <div className="text-center">
          <p className="text-sm">Camera chưa hoạt động</p>
        </div>
      </div>
    );
  }

  // Debug info
  const videoInfo = getVideoInfo();
  console.log("VideoPreview render info:", videoInfo);

  return (
    <div className={`relative w-full h-full ${className}`}>
      {/* Video element - reference từ context */}
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        playsInline
        muted
        style={{ transform: "scaleX(-1)" }}
      />

      {/* Canvas overlay - reference từ context */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ transform: "scaleX(-1)" }}
      />

      {/* Debug info overlay - có thể xóa sau */}
      {process.env.NODE_ENV === "development" && (
        <div className="absolute bottom-2 right-2 bg-black bg-opacity-50 text-white text-xs p-1 rounded">
          {videoInfo.videoWidth}x{videoInfo.videoHeight}
        </div>
      )}
    </div>
  );
}
