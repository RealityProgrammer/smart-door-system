"use client";

import { useCamera } from "@/contexts/CameraContext";

export function VideoPreview({ className = "" }: { className?: string }) {
  const { videoRef, canvasRef, isStreaming } = useCamera();

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

  return (
    <div className={`relative ${className}`}>
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        playsInline
        muted
        style={{ transform: "scaleX(-1)" }}
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ transform: "scaleX(-1)" }}
      />
    </div>
  );
}
