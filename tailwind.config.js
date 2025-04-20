/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
        './src/components/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/**/*.{js,ts,jsx,tsx,mdx}'
    ],
    darkMode: 'class', // 使用 class 策略进行暗色模式控制
    theme: {
        extend: {
            colors: {
                // 可以在这里扩展颜色
            },
            animation: {
                fadeIn: 'fadeIn 0.2s ease-in-out'
            },
            keyframes: {
                fadeIn: {
                    '0%': {opacity: 0},
                    '100%': {opacity: 1}
                }
            }
        }
    },
    plugins: []
};
