import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { ROLE_LABEL, type AdminRole } from '@/lib/roles';
import { apiFetch } from '@/lib/api';
import { friendlyError, type ActionResult } from '@/lib/action';
import { PageHeader } from '@/components/page-header';
import { ActionForm } from '@/components/action-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export const metadata = { title: 'Administradores' };

async function setRole(fd: FormData): Promise<ActionResult> {
  'use server';
  await requireAdmin('owner');
  const role = String(fd.get('role') ?? '');
  const password = String(fd.get('password') ?? '').trim();
  try {
    await apiFetch('PUT', '/admin/admins', {
      email: String(fd.get('email') ?? ''),
      role,
      ...(password ? { password } : {}),
    });
  } catch (error) {
    return { ok: false, error: friendlyError(error) };
  }
  revalidatePath('/admins');
  return { ok: true, message: role ? 'Papel atualizado' : 'Acesso removido' };
}

export default async function AdminsPage() {
  const session = await requireAdmin('owner');
  const data = await apiFetch<unknown[]>('GET', '/admin/admins');
  const admins = (data ?? []) as {
    user_id: string;
    email: string;
    role: AdminRole;
    created_at: string;
  }[];

  return (
    <>
      <PageHeader
        title="Administradores"
        description="Informe uma senha para criar a conta de acesso ao painel (ou redefinir a senha de um administrador)."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-[20px]">
          <CardHeader>
            <CardTitle>Equipe</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border text-sm">
              {admins.map((a) => (
                <li
                  key={a.user_id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3"
                >
                  <span>
                    {a.email}
                    {a.user_id === session.userId ? (
                      <span className="text-muted-foreground"> (você)</span>
                    ) : null}
                  </span>
                  <span className="font-semibold">{ROLE_LABEL[a.role]}</span>
                  {a.user_id !== session.userId ? (
                    <ActionForm action={setRole} confirm={`Remover o acesso de ${a.email}?`}>
                      <input type="hidden" name="email" value={a.email} />
                      <input type="hidden" name="role" value="" />
                      <Button type="submit" variant="destructive" size="sm">
                        Remover
                      </Button>
                    </ActionForm>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card className="h-fit rounded-[20px]">
          <CardHeader>
            <CardTitle>Adicionar ou alterar papel</CardTitle>
          </CardHeader>
          <CardContent>
            <ActionForm action={setRole} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" name="email" type="email" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Senha (para criar a conta ou redefinir)</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  minLength={10}
                  autoComplete="new-password"
                  placeholder="opcional, 10+ caracteres"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="role">Papel</Label>
                <select
                  id="role"
                  name="role"
                  defaultValue="viewer"
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                >
                  <option value="viewer">{ROLE_LABEL.viewer} — vê tudo, não altera</option>
                  <option value="editor">
                    {ROLE_LABEL.editor} — altera planos, matriz, anúncios e usuários
                  </option>
                  <option value="owner">
                    {ROLE_LABEL.owner} — tudo, inclusive administradores
                  </option>
                </select>
              </div>
              <Button type="submit">Salvar</Button>
            </ActionForm>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
