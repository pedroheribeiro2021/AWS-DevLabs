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
            <Link href="/questions" className="hover:text-slate-900">
              Questões
            </Link>
            <Link href="/flashcards" className="hover:text-slate-900">
              Flashcards
            </Link>
          </nav>
        </div>
        <LogoutButton />
      </div>
    </div>
  );
}
