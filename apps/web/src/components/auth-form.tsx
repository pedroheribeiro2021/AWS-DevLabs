'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

interface AuthFormProps {
  mode: 'login' | 'register';
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const payload =
      mode === 'register'
        ? {
            name: formData.get('name'),
            email: formData.get('email'),
            password: formData.get('password'),
          }
        : {
            email: formData.get('email'),
            password: formData.get('password'),
          };

    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.message ?? 'Something went wrong. Please try again.');
        return;
      }

      router.push('/dashboard');
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
      {mode === 'register' && (
        <label className="flex flex-col gap-1 text-sm font-medium">
          Name
          <input
            name="name"
            type="text"
            required
            minLength={2}
            className="rounded-md border border-slate-300 px-3 py-2 text-base outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
          />
        </label>
      )}

      <label className="flex flex-col gap-1 text-sm font-medium">
        Email
        <input
          name="email"
          type="email"
          required
          className="rounded-md border border-slate-300 px-3 py-2 text-base outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Password
        <input
          name="password"
          type="password"
          required
          minLength={8}
          className="rounded-md border border-slate-300 px-3 py-2 text-base outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50"
      >
        {isSubmitting ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
      </button>
    </form>
  );
}
