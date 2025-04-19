// src/app/agents/page.js
import AgentsClientPage from './client-page';
import AppShell from '@/app/AppShell';

export default async function AgentsPage() {
    // 将数据传递给客户端组件，并包装在AppShell中
    return (
        <AppShell>
            <AgentsClientPage/>
        </AppShell>
    );
}
