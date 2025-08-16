"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Camera, AlertCircle } from "lucide-react";
import { useFaceManagement } from "@/hooks/useFaceManagement";
import { VARIATION_TYPES, VariationType } from "@/types";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface AddFaceDialogProps {
  onCapture: (name: string, variationType: string) => Promise<void>;
  isLoading: boolean;
}

export function AddFaceDialog({ onCapture, isLoading }: AddFaceDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [variationType, setVariationType] = useState<VariationType>("default");
  const [existingPersonMode, setExistingPersonMode] = useState(false);
  const [nameError, setNameError] = useState("");

  const { faces, fetchFaces } = useFaceManagement();

  useEffect(() => {
    if (open) {
      fetchFaces();
    }
  }, [open, fetchFaces]);

  const validateName = (inputName: string): boolean => {
    const trimmedName = inputName.trim();

    if (!trimmedName) {
      setNameError("Tên không được để trống");
      return false;
    }

    if (trimmedName.length < 2) {
      setNameError("Tên phải có ít nhất 2 ký tự");
      return false;
    }

    if (trimmedName.length > 50) {
      setNameError("Tên không được quá 50 ký tự");
      return false;
    }

    // Regex hỗ trợ tiếng Việt
    const nameRegex = /^[\w\s\u00C0-\u024F\u1E00-\u1EFF]+$/;
    if (!nameRegex.test(trimmedName)) {
      setNameError("Tên chỉ được chứa chữ cái, số, dấu cách và dấu gạch dưới");
      return false;
    }

    setNameError("");
    return true;
  };

  const handleNameChange = (value: string) => {
    setName(value);
    if (value) {
      validateName(value);
    } else {
      setNameError("");
    }
  };

  const handleSubmit = async () => {
    if (!validateName(name)) {
      return;
    }

    try {
      await onCapture(name.trim(), variationType);
      setOpen(false);
      setName("");
      setVariationType("default");
      setExistingPersonMode(false);
      setNameError("");
    } catch (error) {
      console.error("Error adding face:", error);
    }
  };

  const handleNameSelect = (selectedName: string) => {
    setName(selectedName);
    setExistingPersonMode(true);
    setNameError("");
  };

  const getRecommendedVariations = (personName: string): VariationType[] => {
    const person = faces.find((f) => f.name === personName);
    if (!person || !person.variations) return [];

    const existingVariations = person.variations.map((v) => v.type);
    return VARIATION_TYPES.map((v) => v.value).filter(
      (v) => !existingVariations.includes(v)
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2">
          <UserPlus className="h-4 w-4" />
          Thêm khuôn mặt
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Thêm khuôn mặt mới</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Chọn chế độ */}
          <div>
            <Label>Chế độ</Label>
            <div className="flex gap-2 mt-2">
              <Button
                variant={!existingPersonMode ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setExistingPersonMode(false);
                  setName("");
                  setNameError("");
                }}
              >
                Người mới
              </Button>
              <Button
                variant={existingPersonMode ? "default" : "outline"}
                size="sm"
                onClick={() => setExistingPersonMode(true)}
                disabled={faces.length === 0}
              >
                Thêm variation
              </Button>
            </div>
          </div>

          {/* Tên người */}
          <div>
            <Label htmlFor="name">Tên</Label>
            {existingPersonMode ? (
              <Select value={name} onValueChange={handleNameSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn người có sẵn" />
                </SelectTrigger>
                <SelectContent>
                  {faces.map((face) => (
                    <SelectItem key={face.name} value={face.name}>
                      <div className="flex items-center gap-2">
                        {face.name}
                        <Badge variant="outline" className="text-xs">
                          {face.total_variations || 1} variations
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Nhập tên (hỗ trợ tiếng Việt)..."
                  className={`mt-1 ${nameError ? "border-red-500" : ""}`}
                />
                {nameError && (
                  <p className="text-sm text-red-500 mt-1">{nameError}</p>
                )}
              </div>
            )}
          </div>

          {/* Loại variation */}
          <div>
            <Label htmlFor="variation">Loại ảnh</Label>
            <Select value={variationType} onValueChange={setVariationType}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VARIATION_TYPES.map((type) => {
                  const isRecommended =
                    existingPersonMode &&
                    getRecommendedVariations(name).includes(type.value);

                  return (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        {type.label}
                        {isRecommended && (
                          <Badge variant="secondary" className="text-xs">
                            Đề xuất
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Cảnh báo variation đã tồn tại */}
          {existingPersonMode && name && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {(() => {
                  const person = faces.find((f) => f.name === name);
                  const existingVariations =
                    person?.variations?.map((v) => v.type) || [];

                  if (existingVariations.includes(variationType)) {
                    return `⚠️ Variation "${
                      VARIATION_TYPES.find((v) => v.value === variationType)
                        ?.label
                    }" đã tồn tại cho ${name}`;
                  } else {
                    return `✅ Variation "${
                      VARIATION_TYPES.find((v) => v.value === variationType)
                        ?.label
                    }" sẽ được thêm cho ${name}`;
                  }
                })()}
              </AlertDescription>
            </Alert>
          )}

          {/* Hướng dẫn */}
          <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded">
            <h4 className="font-medium mb-1">Hướng dẫn chụp ảnh:</h4>
            <ul className="text-xs space-y-1">
              <li>• Đảm bảo khuôn mặt rõ ràng và đủ sáng</li>
              <li>• Nhìn thẳng vào camera</li>
              <li>• Nên chụp nhiều variation khác nhau để tăng độ chính xác</li>
              <li>• Mỗi variation nên chụp 2-3 lần</li>
            </ul>
          </div>

          {/* Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={handleSubmit}
              disabled={isLoading || !name.trim() || !!nameError}
              className="flex-1"
            >
              <Camera className="h-4 w-4 mr-2" />
              {isLoading ? "Đang xử lý..." : "Chụp ảnh"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading}
            >
              Hủy
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
