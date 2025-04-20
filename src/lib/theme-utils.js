'use client';

/**
 * 初始化暗色模式
 * 根据本地存储或系统偏好设置初始暗色模式状态
 */
export function initializeTheme() {
    if (typeof window === 'undefined') return false;

    // 检查本地存储
    const savedMode = localStorage.getItem('darkMode');

    // 检查系统偏好
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    // 如果有保存的设置，使用它，否则使用系统偏好
    const initialMode = savedMode !== null ? savedMode === 'true' : prefersDark;

    // 应用初始模式
    if (initialMode) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }

    return initialMode;
}

/**
 * 切换暗色模式
 * @param {boolean} currentMode 当前的模式状态
 * @returns {boolean} 切换后的模式状态
 */
export function toggleTheme(currentMode) {
    const newMode = !currentMode;

    // 保存到本地存储
    localStorage.setItem('darkMode', String(newMode));

    // 应用到body
    if (newMode) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }

    return newMode;
}

/**
 * 监听系统主题变化
 * @param {function} callback 当系统主题变化时调用的回调函数
 */
export function watchSystemTheme(callback) {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e) => {
        callback(e.matches);
    };

    // 使用 addEventListener 而不是 addListener (已废弃)
    try {
        // 现代浏览器的 API
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    } catch (err) {
        // 旧浏览器的 API (Safari < 14)
        mediaQuery.addListener(handleChange);
        return () => mediaQuery.removeListener(handleChange);
    }
}
