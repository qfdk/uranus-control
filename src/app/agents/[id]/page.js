// src/app/agents/[id]/page.js
import AgentDetailWrapper from './client-page';
import AppShell from '@/app/AppShell';

export default async function AgentDetailPage({params}) {
    const {id} = await params;

    return (
        <AppShell>
            <AgentDetailWrapper agentId={id}/>
        </AppShell>
    );
}
