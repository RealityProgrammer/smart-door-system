import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lock, Unlock } from "lucide-react";
import { DoorStatus as DoorStatusType } from "@/types";

interface DoorStatusProps {
  status: DoorStatusType;
}

export function DoorStatus({ status }: DoorStatusProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {status === "locked" ? (
            <Lock className="h-5 w-5 text-red-500" />
          ) : (
            <Unlock className="h-5 w-5 text-green-500" />
          )}
          Trạng thái cửa
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Badge
          variant={status === "locked" ? "destructive" : "default"}
          className="text-lg px-4 py-2"
        >
          {status === "locked" ? "Đã khóa" : "Đã mở"}
        </Badge>
      </CardContent>
    </Card>
  );
}
