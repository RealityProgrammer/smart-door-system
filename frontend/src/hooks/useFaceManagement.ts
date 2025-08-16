import { useState, useCallback } from 'react';
import { apiService } from '@/services/api';
import { FaceInfo, FaceRecognitionResult, FaceVariation } from '@/types';

// Define API_BASE_URL (replace with your actual base URL if needed)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

export const useFaceManagement = () => {
    const [faces, setFaces] = useState<FaceInfo[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string>('');

    const fetchFaces = useCallback(async (): Promise<void> => {
        setIsLoading(true);
        setError('');

        try {
            const response = await apiService.getFaces();
            if (response.success && response.faces) {
                setFaces(response.faces);
            }
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Lỗi khi lấy danh sách khuôn mặt');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const addFace = useCallback(async (name: string, imageBase64: string): Promise<boolean> => {
        setIsLoading(true);
        setError('');

        try {
            const response = await apiService.addFace(name, imageBase64);
            if (response.success) {
                await fetchFaces();
                return true;
            }
            throw new Error(response.message || 'Không thể thêm khuôn mặt');
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Lỗi khi thêm khuôn mặt');
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [fetchFaces]);

    const addFaceVariation = useCallback(async (
        name: string,
        imageBase64: string,
        variationType = 'default'
    ): Promise<boolean> => {
        setIsLoading(true);
        setError('');

        try {
            const response = await apiService.addFace(name, imageBase64, variationType);
            if (response.success) {
                await fetchFaces();
                return true;
            }
            throw new Error(response.message || 'Không thể thêm variation');
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Lỗi khi thêm variation');
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [fetchFaces]);

    const recognizeFace = useCallback(async (imageBase64: string): Promise<FaceRecognitionResult | null> => {
        setIsLoading(true);
        setError('');

        try {
            const response = await apiService.recognizeFace(imageBase64);
            if (response.success && response.result) {
                return response.result;
            }
            throw new Error(response.message || 'Không thể nhận diện khuôn mặt');
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Lỗi khi nhận diện khuôn mặt');
            return null;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const deleteFace = useCallback(async (name: string): Promise<boolean> => {
        setIsLoading(true);
        setError('');

        try {
            const response = await apiService.deleteFace(name);
            if (response.success) {
                await fetchFaces();
                return true;
            }
            throw new Error(response.message || 'Không thể xóa khuôn mặt');
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Lỗi khi xóa khuôn mặt');
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [fetchFaces]);

    const getFaceVariations = useCallback(async (name: string): Promise<FaceVariation[]> => {
        try {
            const response = await apiService.getFaceVariations(name);
            return response.success ? response.result?.variations || [] : [];
        } catch (error) {
            console.error('Error getting variations:', error);
            return [];
        }
    }, []);

    return {
        faces,
        isLoading,
        error,
        fetchFaces,
        addFace,
        recognizeFace,
        deleteFace,
        addFaceVariation,
        getFaceVariations,
    };
};