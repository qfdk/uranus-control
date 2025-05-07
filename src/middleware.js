// src/middleware.js
import {NextResponse} from 'next/server';

/**
 * 路由保护中间件配置
 */
const ROUTE_CONFIG = {
    // 公开路径 - 不需要登录即可访问
    publicPaths: ['/login', '/api/auth/login'],
    
    // API路径 - 应当返回JSON响应而不是重定向
    apiPaths: ['/api/auth', '/api/agents'],
    
    // 允许绕过认证的POST请求路径 - 主要用于代理自动注册
    allowPostPaths: ['/api/agents']
};

/**
 * 检查路径是否匹配给定的路径列表
 * @param {string} currentPath - 当前请求路径
 * @param {string[]} pathList - 要匹配的路径列表
 * @param {boolean} exactMatch - 是否只匹配完全相同的路径
 * @returns {boolean} 是否匹配
 */
function matchesPath(currentPath, pathList, exactMatch = false) {
    return pathList.some(path => 
        exactMatch 
            ? currentPath === path 
            : currentPath === path || currentPath.startsWith(`${path}/`)
    );
}

// 这个中间件用于服务端路由保护
export function middleware(request) {
    // 基本信息提取
    const path = request.nextUrl.pathname;
    const method = request.method;
    const isAuthenticated = request.cookies.get('isAuthenticated')?.value === 'true';
    
    // 路径类型检查
    const isApiPath = matchesPath(path, ROUTE_CONFIG.apiPaths);
    const isPublicPath = matchesPath(path, ROUTE_CONFIG.publicPaths);
    const isAllowedPostPath = matchesPath(path, ROUTE_CONFIG.allowPostPaths) && method === 'POST';
    
    // 认证流程决策树
    
    // 1. 已登录用户访问公开路径 => 重定向到首页（避免重复登录）
    if (isPublicPath && isAuthenticated && !isApiPath) {
        return NextResponse.redirect(new URL('/', request.url));
    }
    
    // 2. 未登录用户访问受保护路径 => 认证失败处理
    const requiresAuth = !isPublicPath && !isAuthenticated && !isAllowedPostPath;
    
    if (requiresAuth) {
        // API路径返回401 JSON响应
        if (isApiPath) {
            return NextResponse.json(
                {error: '认证失败', message: '请先登录'},
                {status: 401}
            );
        }
        
        // 页面路径重定向到登录页
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('callbackUrl', encodeURI(request.url));
        return NextResponse.redirect(loginUrl);
    }
    
    // 3. 默认：继续处理请求
    return NextResponse.next();
}

// 配置需要匹配中间件的路径
export const config = {
    matcher: [
        /*
         * 匹配所有路径，但排除以下路径:
         * - 静态文件 (例如 /static/...)
         * - _next 系统路径
         */
        '/((?!_next/static|_next/image|favicon.ico).*)'
    ]
};
