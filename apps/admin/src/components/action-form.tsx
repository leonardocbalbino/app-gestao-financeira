'use client';

import { useTransition, type ReactNode } from 'react';
import { toast } from 'sonner';
import type { ActionResult } from '@/lib/action';

interface Props {
  action: (fd: FormData) => Promise<ActionResult>;
  children: ReactNode;
  className?: string;
  /** Pergunta de confirmação antes de enviar (ações destrutivas). */
  confirm?: string;
  successMessage?: string;
  onDone?: () => void;
}

/** <form> que chama uma Server Action e mostra o resultado em toast. */
export function ActionForm({
  action,
  children,
  className,
  confirm,
  successMessage,
  onDone,
}: Props) {
  const [pending, start] = useTransition();
  return (
    <form
      className={className}
      aria-busy={pending}
      onSubmit={(e) => {
        e.preventDefault();
        if (confirm && !window.confirm(confirm)) return;
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const res = await action(fd);
          if (res.ok) {
            toast.success(res.message ?? successMessage ?? 'Salvo');
            onDone?.();
          } else {
            toast.error(res.error);
          }
        });
      }}
    >
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
    </form>
  );
}
