// src/hooks/useClientMount.js
import { useState, useEffect } from 'react';
import { useLoading } from '@/app/contexts/LoadingContext';

export function useClientMount(delay = 300) {
    const [isMounted, setIsMounted] = useState(false);
    const { stopLoading } = useLoading();

    useEffect(() => {
        setIsMounted(true);
        const timer = setTimeout(() => {
            stopLoading();
        }, delay);
        return () => clearTimeout(timer);
    }, [stopLoading, delay]);

    return isMounted;
}
