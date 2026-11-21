import type { ReactNode } from 'react';

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}

export function ReadOnlyNotice() {
  return (
    <p className="mb-4 rounded-[12px] bg-muted px-3 py-2 text-sm text-muted-foreground">
      Você tem acesso somente de leitura.
    </p>
  );
}
