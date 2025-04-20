'use client';

// src/components/ui/DarkModeToggle.jsx
import { useState, useEffect } from 'react';
import { Moon, Sun } from 'lucide-react';

export default function DarkModeToggle() {
    const [darkMode, setDarkMode] = useState(false);

    // 组件挂载时检查当前模式
    useEffect(() => {
        // 检查本地存储
        const savedMode = localStorage.getItem('darkMode');

        // 检查系统偏好
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

        // 如果有保存的设置，使用它，否则使用系统偏好
        const initialMode = savedMode !== null ? savedMode === 'true' : prefersDark;

        setDarkMode(initialMode);

        // 应用初始模式
        if (initialMode) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
    }, []);

    // 切换暗黑/明亮模式
    const toggleDarkMode = () => {
        const newMode = !darkMode;
        setDarkMode(newMode);

        // 保存到本地存储
        localStorage.setItem('darkMode', String(newMode));

        // 应用到body
        if (newMode) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
    };

    return (
        <button
            onClick={toggleDarkMode}
            className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            title={darkMode ? '切换到明亮模式' : '切换到夜间模式'}
            aria-label={darkMode ? '切换到明亮模式' : '切换到夜间模式'}
        >
            {darkMode ? (
                <Sun className="h-5 w-5 text-amber-500" />
            ) : (
                <Moon className="h-5 w-5 text-blue-700" />
            )}
        </button>
    );
}
