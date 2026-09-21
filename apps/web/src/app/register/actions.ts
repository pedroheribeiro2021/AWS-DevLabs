'use server';

import { redirect } from 'next/navigation';
import { ApiError } from '@/lib/api';
import { type AuthFormState, extractApiErrorMessage, loginOrRegister } from '@/lib/auth-server';

export async function registerAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const payload = {
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
  };

  try {
    await loginOrRegister('/auth/register', payload);
  } catch (error) {
    if (error instanceof ApiError) {
      return { error: extractApiErrorMessage(error) };
    }
    throw error;
  }

  redirect('/dashboard');
}
