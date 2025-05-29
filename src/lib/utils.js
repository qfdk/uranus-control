import { clsx } from "clsx"

/**
 * 合并和处理 className 的工具函数
 * @param {...any} inputs - 要合并的 className
 * @returns {string} 合并后的 className
 */
export function cn(...inputs) {
  return clsx(inputs)
}