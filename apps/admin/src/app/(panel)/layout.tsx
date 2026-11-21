import { brand } from '@app/shared/brand';
import { requireAdmin } from '@/lib/auth';
import { ROLE_LABEL } from '@/lib/roles';
import { Nav } from '@/components/nav';
import { Button } from '@/components/ui/button';
import { logout } from '../login/actions';

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin('viewer');
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <aside className="border-b border-border bg-sidebar md:w-60 md:border-r md:border-b-0">
        <div className="flex items-center gap-2 px-4 py-4">
          <div className="grid size-8 place-items-center rounded-[10px] bg-primary text-sm font-extrabold text-primary-foreground">
            A
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{brand.name}</p>
            <p className="text-xs text-muted-foreground">Admin</p>
          </div>
        </div>
        <Nav role={session.role} />
        <div className="hidden space-y-2 px-4 py-4 md:block">
          <p className="truncate text-xs text-muted-foreground">{session.email}</p>
          <p className="text-xs font-semibold">{ROLE_LABEL[session.role]}</p>
          <form action={logout}>
            <Button type="submit" variant="outline" size="sm" className="w-full">
              Sair
            </Button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 bg-background p-4 md:p-8">{children}</main>
    </div>
  );
}
