// src/components/ui/StatusCard.jsx
export default function StatusCard({ title, value, description, icon, color }) {
    const colorClasses = {
        blue: 'bg-blue-50 border-blue-200',
        green: 'bg-green-50 border-green-200',
        purple: 'bg-purple-50 border-purple-200',
        amber: 'bg-amber-50 border-amber-200',
    };

    return (
        <div className={`rounded-lg border p-4 ${colorClasses[color]}`}>
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-gray-500 mb-1">{title}</p>
                    <p className="text-2xl font-bold">{value}</p>
                    <p className="text-xs text-gray-500 mt-1">{description}</p>
                </div>
                <div className="bg-white p-3 rounded-full shadow-sm">
                    {icon}
                </div>
            </div>
        </div>
    );
}
