// src/lib/loading-helper.js
// 加载状态的辅助函数

// 显示加载覆盖
export function showLoading() {
    document.body.classList.add('loading-transition');
}

// 隐藏加载覆盖
export function hideLoading() {
    document.body.classList.remove('loading-transition');
}

// 带有延迟的导航
export function navigateWithLoading(url, delay = 50) {
    showLoading();

    setTimeout(() => {
        window.location.href = url;
    }, delay);
}
