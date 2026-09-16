import { redirect } from 'next/navigation';
import { LogoutButton } from '@/components/logout-button';
import { getCurrentUser } from '@/lib/auth-server';

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-16">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Welcome, {user.name}</h1>
        <LogoutButton />
      </div>
      <p className="text-slate-600">
        This is a placeholder dashboard. Learning tracks, labs, questions and progress will land
        here in the next phases.
      </p>
    </main>
  );
}
