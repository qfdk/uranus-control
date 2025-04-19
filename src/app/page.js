// src/app/page.js
import AppShell from './AppShell';
import DashboardClientPage from './client-page';


export default async function DashboardPage() {

    return (
        <AppShell>
            <DashboardClientPage/>
        </AppShell>
    );
}
