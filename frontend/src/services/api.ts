import { FaceRecognitionResult, FaceInfo, ApiResponse, AddFaceRequest } from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

class ApiService {
    private async makeRequest<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<ApiResponse<T>> {
        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers,
                },
                ...options,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`API Error [${endpoint}]:`, error);
            throw error instanceof Error ? error : new Error('Unknown API error');
        }
    }

    async addFace(name: string, imageBase64: string, variationType = 'default'): Promise<ApiResponse<any>> {
        const requestBody: AddFaceRequest = {
            name,
            image: imageBase64,
            variation_type: variationType
        };

        return this.makeRequest('/faces/add', {
            method: 'POST',
            body: JSON.stringify(requestBody),
        });
    }

    async recognizeFace(imageBase64: string): Promise<ApiResponse<FaceRecognitionResult>> {
        return this.makeRequest('/faces/recognize', {
            method: 'POST',
            body: JSON.stringify({ image: imageBase64 }),
        });
    }

    async getFaces(): Promise<ApiResponse<FaceInfo>> {
        return this.makeRequest('/faces/info');
    }

    async deleteFace(name: string): Promise<ApiResponse<any>> {
        return this.makeRequest(`/faces/${encodeURIComponent(name)}`, {
            method: 'DELETE',
        });
    }

    async getFaceVariations(name: string): Promise<ApiResponse<any>> {
        return this.makeRequest(`/faces/${encodeURIComponent(name)}/variations`);
    }

    async deleteFaceVariation(name: string, variationType: string): Promise<ApiResponse<any>> {
        return this.makeRequest(`/faces/${encodeURIComponent(name)}/variations/${encodeURIComponent(variationType)}`, {
            method: 'DELETE',
        });
    }

    async healthCheck(): Promise<ApiResponse<any>> {
        return this.makeRequest('/health');
    }
}

export const apiService = new ApiService();