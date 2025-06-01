const isBrowser = typeof window !== 'undefined';
export function safelyFit(fitAddon, container) {
  if (!isBrowser || !fitAddon || !container) return false;
  
  try {
    if (container.offsetWidth <= 0 || container.offsetHeight <= 0) {
      console.warn('终端容器尺寸为0，跳过fit操作');
      return false;
    }
    
    requestAnimationFrame(() => {
      try {
        if (container.offsetWidth <= 0 || container.offsetHeight <= 0) {
          console.warn('终端容器尺寸为0，跳过fit操作');
          return false;
        }
        
        fitAddon.fit();
      } catch (e) {
        console.warn('终端调整大小失败:', e.message);
      }
    });
    return true;
  } catch (e) {
    console.warn('终端调整大小失败:', e.message);
    return false;
  }
}

export function createSafeResizeObserver(fitAddon, container, callback) {
  if (!isBrowser || !fitAddon || !container) return null;
  
  try {
    const debounce = (func, wait) => {
      let timeout;
      return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
      };
    };
    
    const observer = new ResizeObserver(debounce(() => {
      if (container.offsetWidth > 0 && container.offsetHeight > 0) {
        
        const success = safelyFit(fitAddon, container);
        if (success && typeof callback === 'function') {
          callback();
        }
      }
    }, 200));
    
    observer.observe(container);
    
    return observer;
  } catch (e) {
    console.error('创建ResizeObserver失败:', e.message);
    return null;
  }
}
