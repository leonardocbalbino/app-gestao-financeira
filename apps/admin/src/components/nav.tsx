'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Gauge,
  Layers,
  Grid3x3,
  Megaphone,
  Users,
  SlidersHorizontal,
  ScrollText,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { roleAtLeast, type AdminRole } from '@/lib/roles';

const ITEMS = [
  { href: '/', label: 'Dashboard', icon: Gauge, min: 'viewer' },
  { href: '/plans', label: 'Planos', icon: Layers, min: 'viewer' },
  { href: '/matrix', label: 'Funcionalidades', icon: Grid3x3, min: 'viewer' },
  { href: '/ads', label: 'Anúncios', icon: Megaphone, min: 'viewer' },
  { href: '/users', label: 'Usuários', icon: Users, min: 'viewer' },
  { href: '/config', label: 'Config remota', icon: SlidersHorizontal, min: 'viewer' },
  { href: '/audit', label: 'Auditoria', icon: ScrollText, min: 'viewer' },
  { href: '/admins', label: 'Administradores', icon: ShieldCheck, min: 'owner' },
] as const;

export function Nav({ role }: { role: AdminRole }) {
  const path = usePathname();
  return (
    <nav
      aria-label="Principal"
      className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:pb-0"
    >
      {ITEMS.filter((i) => roleAtLeast(role, i.min)).map(({ href, label, icon: Icon }) => {
        const active = href === '/' ? path === '/' : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex min-h-11 shrink-0 items-center gap-2 rounded-[12px] px-3 text-sm font-medium transition-colors',
              active
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
