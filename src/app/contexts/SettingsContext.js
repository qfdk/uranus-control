'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

const SettingsContext = createContext({});

export function SettingsProvider({ children }) {
    const [settings, setSettings] = useState({
        siteName: 'Οὐρανός 控制台',
        siteUrl: 'http://localhost:3000',
        language: 'zh-CN'
    });
    const [loading, setLoading] = useState(true);

    // 加载设置
    const loadSettings = async () => {
        try {
            // 先尝试从localStorage获取
            const localSettings = localStorage.getItem('generalSettings');
            if (localSettings) {
                setSettings(JSON.parse(localSettings));
            }

            // 然后从API获取最新设置
            const response = await fetch('/api/settings?key=generalSettings');
            if (response.ok) {
                const data = await response.json();
                if (data) {
                    setSettings(data);
                    // 同步到localStorage
                    localStorage.setItem('generalSettings', JSON.stringify(data));
                }
            }
        } catch (error) {
            console.error('加载设置失败:', error);
        } finally {
            setLoading(false);
        }
    };

    // 更新设置
    const updateSettings = (newSettings) => {
        setSettings(newSettings);
        localStorage.setItem('generalSettings', JSON.stringify(newSettings));
    };

    useEffect(() => {
        loadSettings();
    }, []);

    // 监听localStorage变化（用于多标签页同步）
    useEffect(() => {
        const handleStorageChange = (e) => {
            if (e.key === 'generalSettings' && e.newValue) {
                try {
                    setSettings(JSON.parse(e.newValue));
                } catch (error) {
                    console.error('解析设置失败:', error);
                }
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    return (
        <SettingsContext.Provider value={{ settings, loading, updateSettings, loadSettings }}>
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings() {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
}