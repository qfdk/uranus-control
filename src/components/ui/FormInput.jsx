'use client';

export default function FormInput({
                                      label,
                                      id,
                                      type = 'text',
                                      placeholder,
                                      value,
                                      defaultValue,
                                      min,
                                      required = false,
                                      className = '',
                                      error = '',
                                      onChange,
                                      onBlur
                                  }) {
    return (
        <div className="mb-4">
            <label
                htmlFor={id}
                className="block text-sm font-medium text-gray-700 mb-1"
            >
                {label}
                {required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
                type={type}
                id={id}
                name={id}
                placeholder={placeholder}
                value={value}
                defaultValue={defaultValue}
                min={min}
                required={required}
                onChange={onChange}
                onBlur={onBlur}
                className={`w-full rounded-md border border-gray-300 shadow-sm px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500 ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''} ${className}`}
            />
            {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
        </div>
    );
}
