import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import { SystemInfo as SystemInfoType } from "@/types";

interface SystemInfoProps {
  systemInfo: SystemInfoType;
}

export function SystemInfo({ systemInfo }: SystemInfoProps) {
  return (
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
          <Badge variant="outline">{systemInfo.camerasAvailable}</Badge>
        </div>
        <div className="flex justify-between">
          <span>Khuôn mặt phát hiện:</span>
          <Badge variant="outline">{systemInfo.facesDetected}</Badge>
        </div>
        <div className="flex justify-between">
          <span>AI Models:</span>
          <Badge variant={systemInfo.modelsLoaded ? "default" : "secondary"}>
            {systemInfo.modelsLoaded ? "Đã tải" : "Đang tải"}
          </Badge>
        </div>
        {systemInfo.totalFaces !== undefined && (
          <div className="flex justify-between">
            <span>Tổng khuôn mặt:</span>
            <Badge variant="outline">{systemInfo.totalFaces}</Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
