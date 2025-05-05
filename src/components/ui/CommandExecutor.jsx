'use client';

import React from 'react';
import MqttTerminal from '@/components/mqtt-terminal';

export default function CommandExecutor({agentUuid, isActive = false}) {
    if (!isActive) return null;

    return (
        <div className="bg-[#1e1e1e] rounded-lg shadow dark:bg-gray-800 h-[500px] overflow-hidden p-2 terminal-container">
            <MqttTerminal agentUuid={agentUuid} isActive={isActive} />
        </div>
    );
}
