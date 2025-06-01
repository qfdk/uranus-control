/**
 * xterm.js 终端修复工具
 * 修复 TypeError: Cannot read properties of undefined (reading 'dimensions') 错误
 */

// 判断是否在浏览器环境
const isBrowser = typeof window !== 'undefined';

/**
 * 安全地调整终端大小
 * @param {object} fitAddon - xterm-addon-fit 的 FitAddon 实例
 * @param {HTMLElement} container - 终端容器元素
 * @returns {boolean} - 是否成功调整大小
 */
export function safelyFit(fitAddon, container) {
  if (!isBrowser || !fitAddon || !container) return false;
  
  try {
    // 检查容器是否可见
    if (container.offsetWidth <= 0 || container.offsetHeight <= 0) {
      console.warn('终端容器尺寸为0，跳过fit操作');
      return false;
    }
    
    // 直接应用 fit 操作，新版本xterm更稳定
    fitAddon.fit();
    return true;
  } catch (e) {
    console.warn('终端调整大小失败:', e.message);
    return false;
  }
}

/**
 * 创建安全的调整大小观察器
 * @param {object} fitAddon - FitAddon 实例
 * @param {HTMLElement} container - 终端容器
 * @param {function} callback - 调整大小后的回调函数
 * @returns {ResizeObserver|null} - ResizeObserver 实例
 */
export function createSafeResizeObserver(fitAddon, container, callback) {
  if (!isBrowser || !fitAddon || !container) return null;
  
  try {
    // 防抖函数
    const debounce = (func, wait) => {
      let timeout;
      return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
      };
    };
    
    // 创建 ResizeObserver
    const observer = new ResizeObserver(debounce(() => {
      if (container.offsetWidth > 0 && container.offsetHeight > 0) {
        const success = safelyFit(fitAddon, container);
        if (success && typeof callback === 'function') {
          callback();
        }
      }
    }, 200));
    
    // 开始观察
    observer.observe(container);
    
    return observer;
  } catch (e) {
    console.error('创建ResizeObserver失败:', e.message);
    return null;
  }
}
