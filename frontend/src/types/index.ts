export interface CameraDevice {
    deviceId: string;
    label: string;
}

export interface DetectedFace {
    detection: any; // face-api.js detection type
    descriptor?: Float32Array;
}

export interface FaceRecognitionResult {
    recognized: boolean;
    name?: string;
    confidence?: number;
    distance?: number;
    threshold?: number;
    model_used?: string;
    message: string;
    // Thêm các field mới cho multiple embeddings
    best_variation?: string;
    total_comparisons?: number;
    recognition_details?: RecognitionDetail[];
}

export interface RecognitionDetail {
    name: string;
    variation: string;
    distance: number;
    within_threshold: boolean;
}

export interface FaceInfo {
    name: string;
    image_path?: string; // Optional vì có thể có nhiều images
    model: string;
    added_date: string;
    recognition_count?: number;
    // Thêm fields cho multiple variations
    total_variations?: number;
    last_updated?: string;
    variations?: FaceVariation[];
}

export interface FaceVariation {
    type: string;
    image_path: string;
    added_date: string;
}

export interface ApiResponse<T> {
    success: boolean;
    message: string;
    result?: T;
    faces?: T[];
    total?: number;
}

// Add face request với variation type
export interface AddFaceRequest {
    name: string;
    image: string;
    variation_type?: string;
}

// System info interface
export interface SystemInfo {
    camerasAvailable: number;
    facesDetected: number;
    modelsLoaded: boolean;
    totalFaces?: number;
}

export type DoorStatus = 'locked' | 'unlocked';
export type RecognitionStatus = 'idle' | 'scanning' | 'recognized' | 'unknown';

// Variation types constants
export const VARIATION_TYPES = [
    { value: "default", label: "Mặc định", description: "Ảnh thường, nhìn thẳng" },
    { value: "with_glasses", label: "Đeo kính", description: "Ảnh có đeo kính" },
    { value: "no_glasses", label: "Không kính", description: "Ảnh không đeo kính" },
    { value: "left_angle", label: "Góc trái", description: "Nghiêng đầu sang trái 15-30°" },
    { value: "right_angle", label: "Góc phải", description: "Nghiêng đầu sang phải 15-30°" },
    { value: "slight_smile", label: "Mỉm cười", description: "Ảnh có nụ cười nhẹ" },
    { value: "serious", label: "Nghiêm túc", description: "Ảnh biểu cảm nghiêm túc" },
] as const;

export type VariationType = typeof VARIATION_TYPES[number]['value'];

export interface AutoRecognitionState {
    isActive: boolean;
    attemptCount: number;
    maxAttempts: number;
    cooldownUntil: number | null;
    lastAttempt: number;
}