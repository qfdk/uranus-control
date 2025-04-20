// src/components/ui/StatusCard.jsx
export default function StatusCard({ title, value, description, icon, color }) {
    // 定义普通模式的颜色类
    const lightModeClasses = {
        blue: 'bg-blue-50 border-blue-200',
        green: 'bg-green-50 border-green-200',
        purple: 'bg-purple-50 border-purple-200',
        amber: 'bg-amber-50 border-amber-200',
    };

    // 定义暗黑模式的颜色类
    const darkModeClasses = {
        blue: 'dark-mode:bg-blue-900/30 dark-mode:border-blue-800/50',
        green: 'dark-mode:bg-green-900/30 dark-mode:border-green-800/50',
        purple: 'dark-mode:bg-purple-900/30 dark-mode:border-purple-800/50',
        amber: 'dark-mode:bg-amber-900/30 dark-mode:border-amber-800/50',
    };

    // 定义暗黑模式下图标容器的颜色
    const darkModeIconClasses = {
        blue: 'dark-mode:bg-blue-800/30',
        green: 'dark-mode:bg-green-800/30',
        purple: 'dark-mode:bg-purple-800/30',
        amber: 'dark-mode:bg-amber-800/30',
    };

    return (
        <div className={`rounded-lg border p-4 status-card ${lightModeClasses[color]} ${darkModeClasses[color]}`}>
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-gray-500 dark-mode:text-gray-300 mb-1 font-medium">{title}</p>
                    <p className="text-2xl font-bold text-gray-800 dark-mode:text-white">{value}</p>
                    <p className="text-xs text-gray-500 dark-mode:text-gray-300 mt-1">{description}</p>
                </div>
                <div className={`bg-white dark-mode:bg-gray-800 p-3 rounded-full shadow-sm ${darkModeIconClasses[color]}`}>
                    {icon}
                </div>
            </div>
        </div>
    );
}
