'use client';

export default function FormInput({
                                      label,
                                      id,
                                      type = 'text',
                                      placeholder,
                                      defaultValue,
                                      min,
                                      required = false,
                                      className = ''
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
                defaultValue={defaultValue}
                min={min}
                required={required}
                className={`w-full rounded-md border border-gray-300 shadow-sm px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${className}`}
            />
        </div>
    );
}
