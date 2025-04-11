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
        primary: 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500',
        secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 focus:ring-gray-500',
        danger: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500',
        success: 'bg-green-600 hover:bg-green-700 text-white focus:ring-green-500',
        warning: 'bg-amber-600 hover:bg-amber-700 text-white focus:ring-amber-500',
    };

    const sizeClasses = {
        sm: 'px-2.5 py-1.5 text-xs',
        md: 'px-4 py-2 text-sm',
        lg: 'px-5 py-2.5 text-base',
    };

    const baseClasses = 'inline-flex justify-center items-center font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors';
    const disabledClasses = disabled ? 'opacity-50 cursor-not-allowed' : '';

    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${disabledClasses} ${className}`}
        >
            {children}
        </button>
    );
}
