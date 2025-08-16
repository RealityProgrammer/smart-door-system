"use client";

import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Trash2, Eye } from "lucide-react";
import { useFaceManagement } from "@/hooks/useFaceManagement";

interface FaceListProps {
  onDeleteSuccess?: () => void;
}

export function FaceList({ onDeleteSuccess }: FaceListProps) {
  const { faces, isLoading, error, fetchFaces, deleteFace, getFaceVariations } =
    useFaceManagement();

  useEffect(() => {
    fetchFaces();
  }, [fetchFaces]);

  const handleDelete = async (name: string): Promise<void> => {
    if (confirm(`Bạn có chắc muốn xóa khuôn mặt "${name}"?`)) {
      const success = await deleteFace(name);
      if (success && onDeleteSuccess) {
        onDeleteSuccess();
      }
    }
  };

  const handleViewVariations = async (name: string): Promise<void> => {
    const variations = await getFaceVariations(name);
    alert(
      `Variations cho ${name}:\n${variations
        .map((v) => `- ${v.type} (${v.added_date})`)
        .join("\n")}`
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Danh sách khuôn mặt
          <Badge variant="outline">{faces.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <p>Đang tải...</p>}
        {error && <p className="text-red-500">{error}</p>}

        <div className="space-y-2">
          {faces.map((face) => (
            <div
              key={face.name}
              className="flex items-center justify-between p-2 border rounded"
            >
              <div>
                <h4 className="font-medium">{face.name}</h4>
                <p className="text-sm text-gray-500">
                  Đăng ký:{" "}
                  {new Date(face.added_date).toLocaleDateString("vi-VN")}
                </p>
                {face.total_variations && (
                  <Badge variant="secondary" className="text-xs">
                    {face.total_variations} variations
                  </Badge>
                )}
              </div>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleViewVariations(face.name)}
                  disabled={isLoading}
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(face.name)}
                  disabled={isLoading}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}

          {faces.length === 0 && !isLoading && (
            <p className="text-gray-500 text-center py-4">
              Chưa có khuôn mặt nào được đăng ký
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
