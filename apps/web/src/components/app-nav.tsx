import Link from 'next/link';
import { LogoutButton } from './logout-button';

interface AppNavProps {
  title: string;
}

export function AppNav({ title }: AppNavProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-6">
        <h1 className="text-2xl font-bold">{title}</h1>
        <nav className="flex gap-4 text-sm font-medium text-slate-600">
          <Link href="/dashboard" className="hover:text-slate-900">
            Painel
          </Link>
          <Link href="/labs" className="hover:text-slate-900">
            Laboratórios
          </Link>
        </nav>
      </div>
      <LogoutButton />
    </div>
  );
}
