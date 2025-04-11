// src/app/agents/[id]/client-page.js
'use client';

import AgentDetail from './client-component';

export default function AgentDetailWrapper({ agent }) {
    return <AgentDetail agent={agent} />;
}
