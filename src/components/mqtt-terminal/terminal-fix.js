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
    
    // 应用 fit 操作
    fitAddon.fit();
    return true;
  } catch (e) {
    console.warn('终端调整大小失败:', e.message);
    return false;
  }
}

/**
 * 安全初始化终端
 * @param {object} terminal - xterm Terminal 实例
 * @param {HTMLElement} container - 终端容器
 * @param {object} fitAddon - FitAddon 实例
 * @returns {boolean} - 初始化是否成功
 */
export function safelyInitialize(terminal, container, fitAddon) {
  if (!isBrowser || !terminal || !container || !fitAddon) return false;
  
  try {
    // 确保容器有合理尺寸
    if (container.offsetWidth <= 0 || container.offsetHeight <= 0) {
      console.warn('终端容器尺寸为0，可能导致错误');
    }
    
    // 打开终端
    terminal.open(container);
    
    // 延迟 fit 操作
    setTimeout(() => {
      safelyFit(fitAddon, container);
    }, 100);
    
    return true;
  } catch (e) {
    console.error('终端初始化失败:', e.message);
    return false;
  }
}

/**
 * 创建终端实例和相关插件的工厂函数
 * @param {object} options - 终端配置选项
 * @returns {object} - 包含终端实例和插件的对象
 */
export function createTerminal(options = {}) {
  if (!isBrowser) return { terminal: null, fitAddon: null };
  
  // 动态导入模块
  if (typeof Terminal === 'undefined' || 
      typeof FitAddon === 'undefined' || 
      typeof SearchAddon === 'undefined' || 
      typeof WebLinksAddon === 'undefined') {
    console.error('终端依赖模块未加载');
    return { terminal: null, fitAddon: null };
  }
  
  try {
    // 默认选项
    const defaultOptions = {
      cursorBlink: true,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 14,
      lineHeight: 1.5,
      convertEol: true,
      scrollback: 5000,
      theme: {
        background: '#1e1e1e',
        foreground: '#f0f0f0'
      }
    };
    
    // 合并选项
    const mergedOptions = { ...defaultOptions, ...options };
    
    // 创建终端
    const terminal = new Terminal(mergedOptions);
    
    // 创建插件
    const fitAddon = new FitAddon.FitAddon();
    const searchAddon = new SearchAddon.SearchAddon();
    const webLinksAddon = new WebLinksAddon.WebLinksAddon();
    
    // 加载插件
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(searchAddon);
    terminal.loadAddon(webLinksAddon);
    
    return { 
      terminal, 
      fitAddon, 
      searchAddon, 
      webLinksAddon 
    };
  } catch (e) {
    console.error('创建终端失败:', e.message);
    return { terminal: null, fitAddon: null };
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
