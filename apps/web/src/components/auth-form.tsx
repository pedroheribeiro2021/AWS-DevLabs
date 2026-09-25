'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { loginAction } from '@/app/login/actions';
import { registerAction } from '@/app/register/actions';
import type { AuthFormState } from '@/lib/auth-server';

interface AuthFormProps {
  mode: 'login' | 'register';
}

const initialState: AuthFormState = { error: null };

function SubmitButton({ mode }: { mode: 'login' | 'register' }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50"
    >
      {pending ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'}
    </button>
  );
}

export function AuthForm({ mode }: AuthFormProps) {
  const action = mode === 'login' ? loginAction : registerAction;
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4">
      {mode === 'register' && (
        <label className="flex flex-col gap-1 text-sm font-medium">
          Nome
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
        E-mail
        <input
          name="email"
          type="email"
          required
          className="rounded-md border border-slate-300 px-3 py-2 text-base outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Senha
        <input
          name="password"
          type="password"
          required
          minLength={8}
          className="rounded-md border border-slate-300 px-3 py-2 text-base outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
        />
      </label>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <SubmitButton mode={mode} />
    </form>
  );
}
