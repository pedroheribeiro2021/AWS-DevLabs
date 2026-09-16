import Link from 'next/link';
import { AuthForm } from '@/components/auth-form';

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16">
      <h1 className="text-2xl font-bold">Entrar no AWS DevLab</h1>
      <AuthForm mode="login" />
      <p className="text-sm text-slate-600">
        Ainda não tem conta?{' '}
        <Link href="/register" className="font-medium text-orange-600 hover:underline">
          Criar conta
        </Link>
      </p>
    </main>
  );
}
