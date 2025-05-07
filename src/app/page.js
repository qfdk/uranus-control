// src/app/page.js
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
    // Redirect to the agents page
    redirect('/agents');
}
