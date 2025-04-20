'use client';

export default function Button({
                                   children,
                                   type = 'button',
                                   variant = 'primary',
                                   size = 'md',
                                   onClick,
                                   className = '',
                                   disabled = false
                               }) {
    const variantClasses = {
        primary: 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500 dark:bg-blue-600 dark:hover:bg-blue-700',
        secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 focus:ring-gray-500 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200 dark:border-gray-600',
        danger: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500 dark:bg-red-600 dark:hover:bg-red-700',
        success: 'bg-green-600 hover:bg-green-700 text-white focus:ring-green-500 dark:bg-green-600 dark:hover:bg-green-700',
        warning: 'bg-amber-600 hover:bg-amber-700 text-white focus:ring-amber-500 dark:bg-amber-600 dark:hover:bg-amber-700',
    };

    const sizeClasses = {
        sm: 'px-2.5 py-1.5 text-xs',
        md: 'px-4 py-2 text-sm',
        lg: 'px-5 py-2.5 text-base',
    };

    const baseClasses = 'inline-flex justify-center items-center font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors';
    const disabledClasses = disabled ? 'opacity-50 cursor-not-allowed' : '';

    // 添加暗色模式支持
    const darkModeClasses = 'dark:focus:ring-offset-gray-900';

    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${disabledClasses} ${darkModeClasses} ${className}`}
        >
            {children}
        </button>
    );
}
