'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { loginAction } from '@/app/login/actions';
import { registerAction } from '@/app/register/actions';
import type { AuthFormState } from '@/lib/auth-server';

interface AuthFormProps {
  mode: 'login' | 'register';
}

const initialState: AuthFormState = { error: null };

// After this long, a pending submit is most likely waiting on the API waking up
// from Render's free-plan sleep (up to about a minute), not a real failure.
const SLOW_SUBMIT_HINT_MS = 5000;

function SubmitButton({ mode }: { mode: 'login' | 'register' }) {
  const { pending } = useFormStatus();
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => setSlow(true), SLOW_SUBMIT_HINT_MS);
    return () => {
      clearTimeout(timer);
      setSlow(false);
    };
  }, [pending]);

  return (
    <>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50"
      >
        {pending ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'}
      </button>
      {slow && (
        <p className="text-sm text-slate-600" role="status">
          O servidor está acordando depois de um tempo sem uso — isso pode levar até um minuto. Não
          precisa recarregar a página.
        </p>
      )}
    </>
  );
}

export function AuthForm({ mode }: AuthFormProps) {
  const action = mode === 'login' ? loginAction : registerAction;
  const [state, formAction] = useActionState(action, initialState);

  useEffect(() => {
    // Fire-and-forget: only the side effect of waking the API matters here.
    fetch('/api/wake').catch(() => {});
  }, []);

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
