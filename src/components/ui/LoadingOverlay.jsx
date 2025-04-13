'use client';

import { useLoading } from '@/app/contexts/LoadingContext';

export default function LoadingOverlay() {
    const { isLoading } = useLoading();
    if (!isLoading) return null;

    return (
        <div className="fixed inset-0 bg-white bg-opacity-80 z-50 flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
    );
}
