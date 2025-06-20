'use client';

export default function FormSelect({
                                       label,
                                       id,
                                       name,
                                       options = [],
                                       value,
                                       defaultValue,
                                       required = false,
                                       className = '',
                                       error = '',
                                       onChange,
                                       onBlur,
                                       disabled = false
                                   }) {
    return (
        <div className="mb-4">
            <label
                htmlFor={id}
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
                {label}
                {required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <div className="relative">
                <select
                    id={id}
                    name={name || id}
                    value={value}
                    defaultValue={defaultValue}
                    required={required}
                    onChange={onChange}
                    onBlur={onBlur}
                    disabled={disabled}
                    className={`appearance-none w-full rounded-md border border-gray-300 shadow-sm px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white disabled:bg-gray-100 disabled:text-gray-500 pr-8 
                    dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:border-blue-500 dark:focus:ring-blue-500 dark:disabled:bg-gray-800 dark:disabled:text-gray-400
                    ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500 dark:border-red-500 dark:focus:border-red-500 dark:focus:ring-red-500' : ''} ${className}`}
                >
                    {options.map((option) => (
                        <option
                            key={option.value}
                            value={option.value}
                        >
                            {option.label}
                        </option>
                    ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-300">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                        <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                    </svg>
                </div>
            </div>
            {error && <p className="mt-1 text-sm text-red-500 dark:text-red-400">{error}</p>}
        </div>
    );
}
