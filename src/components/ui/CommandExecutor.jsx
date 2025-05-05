'use client';

import React from 'react';
import MqttTerminal from '@/components/mqtt-terminal';

export default function CommandExecutor({agentUuid, isActive = false}) {
    if (!isActive) return null;

    return (
        <div className="bg-white rounded-lg shadow dark:bg-gray-800 p-4 h-[500px]">
            <MqttTerminal agentUuid={agentUuid} isActive={isActive} />
        </div>
    );
}
