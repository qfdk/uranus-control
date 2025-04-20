'use client';

import {useEffect, useState} from 'react';
import {Moon, Sun} from 'lucide-react';
import {initializeTheme, toggleTheme, watchSystemTheme} from '@/lib/theme-utils';

export default function DarkModeToggle() {
    const [darkMode, setDarkMode] = useState(false);
    const [mounted, setMounted] = useState(false);

    // 组件挂载时初始化
    useEffect(() => {
        const initialMode = initializeTheme();
        setDarkMode(initialMode);
        setMounted(true);

        // 监听系统主题变化，仅当用户没有手动设置时
        return watchSystemTheme((isDark) => {
            // 只有当本地没有保存设置时，才跟随系统变化
            if (localStorage.getItem('darkMode') === null) {
                setDarkMode(isDark);
                if (isDark) {
                    document.body.classList.add('dark-mode');
                } else {
                    document.body.classList.remove('dark-mode');
                }
            }
        });
    }, []);

    // 切换暗黑/明亮模式
    const handleToggle = () => {
        const newMode = toggleTheme(darkMode);
        setDarkMode(newMode);
    };

    // 如果组件尚未挂载，不渲染任何内容以避免水合错误
    if (!mounted) return null;

    return (
        <button
            onClick={handleToggle}
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
