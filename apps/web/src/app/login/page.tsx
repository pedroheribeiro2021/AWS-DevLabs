import Link from 'next/link';
import { AuthForm } from '@/components/auth-form';

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16">
      <h1 className="text-2xl font-bold">Log in to AWS DevLab</h1>
      <AuthForm mode="login" />
      <p className="text-sm text-slate-600">
        No account yet?{' '}
        <Link href="/register" className="font-medium text-orange-600 hover:underline">
          Create one
        </Link>
      </p>
    </main>
  );
}
