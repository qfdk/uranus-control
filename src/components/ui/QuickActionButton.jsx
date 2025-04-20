// src/components/ui/QuickActionButton.jsx
export default function QuickActionButton({ text, color, onClick }) {
    const colorClasses = {
        blue: 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600',
        green: 'bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600',
        purple: 'bg-purple-600 hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-600',
        amber: 'bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600',
    };

    return (
        <button
            onClick={onClick}
            className={`px-4 py-2 rounded text-white text-sm font-medium transition-colors duration-300 ${colorClasses[color]}`}
        >
            {text}
        </button>
    );
}
