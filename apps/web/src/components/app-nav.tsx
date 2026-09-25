import Link from 'next/link';
import { Logo } from './logo';
import { LogoutButton } from './logout-button';

interface AppNavProps {
  title: string;
}

export function AppNav({ title }: AppNavProps) {
  return (
    <div className="flex flex-col gap-4">
      <Link href="/dashboard" className="w-fit">
        <Logo />
      </Link>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
          <h1 className="text-xl font-bold sm:text-2xl">{title}</h1>
          <nav className="flex flex-wrap gap-x-4 gap-y-2 text-sm font-medium text-slate-600">
            <Link href="/dashboard" className="hover:text-slate-900">
              Painel
            </Link>
            <Link href="/labs" className="hover:text-slate-900">
              Laboratórios
            </Link>
            <Link href="/questions" className="hover:text-slate-900">
              Questões
            </Link>
            <Link href="/flashcards" className="hover:text-slate-900">
              Flashcards
            </Link>
            <Link href="/simulations" className="hover:text-slate-900">
              Simulados
            </Link>
          </nav>
        </div>
        <LogoutButton />
      </div>
    </div>
  );
}
