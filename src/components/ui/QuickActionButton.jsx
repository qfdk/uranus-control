// src/components/ui/QuickActionButton.jsx
export default function QuickActionButton({ text, color, onClick }) {
    const colorClasses = {
        blue: 'bg-blue-600 hover:bg-blue-700',
        green: 'bg-green-600 hover:bg-green-700',
        purple: 'bg-purple-600 hover:bg-purple-700',
        amber: 'bg-amber-600 hover:bg-amber-700',
    };

    return (
        <button
            onClick={onClick}
            className={`px-4 py-2 rounded text-white text-sm font-medium ${colorClasses[color]}`}
        >
            {text}
        </button>
    );
}
