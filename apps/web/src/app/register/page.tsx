import Link from 'next/link';
import { AuthForm } from '@/components/auth-form';

export default function RegisterPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-10 sm:py-16">
      <h1 className="text-2xl font-bold">Criar sua conta no AWS DevLab</h1>
      <AuthForm mode="register" />
      <p className="text-sm text-slate-600">
        Já tem uma conta?{' '}
        <Link href="/login" className="font-medium text-orange-600 hover:underline">
          Entrar
        </Link>
      </p>
    </main>
  );
}
