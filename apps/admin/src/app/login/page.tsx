import { brand } from '@app/shared/brand';
import { LoginForm } from './login-form';

export const metadata = { title: 'Entrar' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="grid min-h-dvh place-items-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-[20px] bg-primary text-xl font-extrabold text-primary-foreground">
            {brand.name.replace(/[^A-Za-z]/g, '').slice(0, 1) || 'A'}
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{brand.name}</h1>
          <p className="text-sm text-muted-foreground">Painel administrativo</p>
        </div>
        <LoginForm
          initialError={error === 'forbidden' ? 'Acesso restrito a administradores.' : undefined}
        />
      </div>
    </main>
  );
}
