import Link from 'next/link';
import { AuthForm } from '@/components/auth-form';

export default function RegisterPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16">
      <h1 className="text-2xl font-bold">Create your AWS DevLab account</h1>
      <AuthForm mode="register" />
      <p className="text-sm text-slate-600">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-orange-600 hover:underline">
          Log in
        </Link>
      </p>
    </main>
  );
}
