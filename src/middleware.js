// src/middleware.js
import {NextResponse} from 'next/server';

// 这个中间件用于服务端路由保护
export function middleware(request) {
    // 获取请求路径
    const path = request.nextUrl.pathname;

    // 定义公开路径（不需要登录即可访问）
    const publicPaths = ['/login', '/api/auth/login','/api/agents'];

    // 定义API路径，这些路径应当返回JSON响应而不是重定向
    const apiPaths = ['/api/auth'];

    // 检查当前路径是否是API路径
    const isApiPath = apiPaths.some(
        (apiPath) => path.startsWith(apiPath)
    );

    // 检查当前路径是否是公开路径
    const isPublicPath = publicPaths.some(
        (publicPath) => path === publicPath || path.startsWith(`${publicPath}/`)
    );

    // 获取session token
    const isAuthenticated = request.cookies.get('isAuthenticated')?.value === 'true';

    // 如果是公开路径但已经登录，重定向到首页
    if (isPublicPath && isAuthenticated && !isApiPath) {
        return NextResponse.redirect(new URL('/', request.url));
    }

    // 如果不是公开路径且未登录
    if (!isPublicPath && !isAuthenticated) {
        // 如果是API请求，返回401错误而不是重定向
        if (isApiPath) {
            return NextResponse.json(
                {error: '认证失败', message: '请先登录'},
                {status: 401}
            );
        }

        // 否则重定向到登录页
        const url = new URL('/login', request.url);
        url.searchParams.set('callbackUrl', encodeURI(request.url));
        return NextResponse.redirect(url);
    }

    // 继续处理请求
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
