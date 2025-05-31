/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
        './src/components/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/**/*.{js,ts,jsx,tsx,mdx}'
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {},
            animation: {
                fadeIn: 'fadeIn 0.2s ease-in-out',
                slideIn: 'slideIn 0.3s ease-out',
                fadeSlideIn: 'fadeSlideIn 0.4s ease-out'
            },
            keyframes: {
                fadeIn: {
                    '0%': {opacity: 0},
                    '100%': {opacity: 1}
                },
                slideIn: {
                    '0%': {transform: 'translateX(10px)', opacity: 0},
                    '100%': {transform: 'translateX(0)', opacity: 1}
                },
                fadeSlideIn: {
                    '0%': {transform: 'translateY(10px)', opacity: 0},
                    '100%': {transform: 'translateY(0)', opacity: 1}
                }
            }
        }
    },
    plugins: []
}
