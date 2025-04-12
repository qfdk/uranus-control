'use client';

export default function FormSelect({
                                       label,
                                       id,
                                       options = [],
                                       value,
                                       defaultValue,
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
            <select
                id={id}
                name={id}
                value={value}
                defaultValue={defaultValue}
                required={required}
                onChange={onChange}
                onBlur={onBlur}
                className={`w-full rounded-md border border-gray-300 shadow-sm px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white disabled:bg-gray-100 disabled:text-gray-500 ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''} ${className}`}
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
            {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
        </div>
    );
}
