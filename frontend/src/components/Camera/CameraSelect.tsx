import { CameraDevice } from "@/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface CameraSelectProps {
  selected?: string;
  cameras: CameraDevice[];
  onSelect(selectedCamera: string) : void;
  disabled?: boolean;
}

export function CameraSelect({ selected, cameras, onSelect, disabled } : CameraSelectProps) {
  return <Select
    value={selected}
    onValueChange={onSelect}
    disabled={disabled}
  >
    <SelectTrigger className="w-full">
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
}