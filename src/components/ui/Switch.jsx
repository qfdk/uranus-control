'use client';

export default function Switch({
                                   checked,
                                   onChange,
                                   disabled = false,
                                   className = '',
                                   label
                               }) {
    return (
        <>
            {label && (
                <span className="mr-3 text-sm text-gray-700 dark:text-gray-300">
                    {label}
                </span>
            )}
            <div className="flex items-center">

                <label className="inline-flex relative items-center cursor-pointer">
                    <input
                        type="checkbox"
                        checked={checked}
                        onChange={onChange}
                        disabled={disabled}
                        className="sr-only peer"
                    />
                    <div className={`w-11 h-6 bg-gray-200 dark:bg-gray-700 rounded-full peer peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800
                    ${checked ? 'peer-checked:bg-blue-600 dark:peer-checked:bg-blue-600' : ''}
                    ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                    ${className}`}
                    >
                        <div className={`
                        absolute left-[2px] top-[2px] bg-white dark:bg-gray-200 border border-gray-300 dark:border-gray-600 rounded-full 
                        h-5 w-5 transition-transform duration-200 ease-in-out 
                        ${checked ? 'translate-x-full' : 'translate-x-0'}
                    `}></div>
                    </div>
                </label>
            </div>
        </>
    );
}
