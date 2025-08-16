import { Badge } from "@/components/ui/badge";
import { DetectedFace } from "@/types";

interface FaceDetectionOverlayProps {
  detectedFaces: DetectedFace[];
  isScanning?: boolean;
  isStreaming: boolean;
}

export function FaceDetectionOverlay({
  detectedFaces,
  isScanning,
  isStreaming,
}: FaceDetectionOverlayProps) {
  return (
    <>
      {/* Scanning Overlay */}
      {isScanning && (
        <div className="absolute inset-0 bg-blue-500 bg-opacity-20 flex items-center justify-center">
          <div className="bg-white rounded-lg p-4 shadow-lg">
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
            <p className="text-blue-700 font-medium">Đang nhận diện...</p>
          </div>
        </div>
      )}

      {/* Face Detection Status */}
      {isStreaming && (
        <div className="absolute top-4 left-4">
          <Badge variant={detectedFaces.length > 0 ? "default" : "secondary"}>
            Phát hiện: {detectedFaces.length} khuôn mặt
          </Badge>
        </div>
      )}
    </>
  );
}
