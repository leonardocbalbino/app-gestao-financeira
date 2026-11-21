export type AdminRole = 'owner' | 'editor' | 'viewer';

const RANK: Record<AdminRole, number> = { viewer: 0, editor: 1, owner: 2 };

export function roleAtLeast(role: AdminRole, min: AdminRole): boolean {
  return RANK[role] >= RANK[min];
}

export const ROLE_LABEL: Record<AdminRole, string> = {
  owner: 'Proprietário',
  editor: 'Editor',
  viewer: 'Leitura',
};
