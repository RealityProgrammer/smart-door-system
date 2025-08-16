import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity } from "lucide-react";
import { RecognitionStatus as RecognitionStatusType } from "@/types";

interface RecognitionStatusProps {
  status: RecognitionStatusType;
}

export function RecognitionStatus({ status }: RecognitionStatusProps) {
  return (
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
            status === "recognized"
              ? "default"
              : status === "scanning"
              ? "secondary"
              : status === "unknown"
              ? "destructive"
              : "outline"
          }
          className="text-lg px-4 py-2"
        >
          {status === "idle" && "Chờ"}
          {status === "scanning" && "Đang quét..."}
          {status === "recognized" && "Đã nhận diện"}
          {status === "unknown" && "Không nhận diện được"}
        </Badge>
      </CardContent>
    </Card>
  );
}
