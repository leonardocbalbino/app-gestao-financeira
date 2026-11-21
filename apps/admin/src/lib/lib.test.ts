import { describe, expect, it } from 'vitest';
import { csvCell, toCsv } from './csv';
import { describeDiff, formatCell, parseCellInput } from './matrix';
import { parseAdConfigForm, parseAppConfigForm } from './forms';
import { roleAtLeast } from './roles';

describe('csv', () => {
  it('escapa separador, aspas e quebra de linha', () => {
    expect(csvCell('a;b')).toBe('"a;b"');
    expect(csvCell('diz "oi"')).toBe('"diz ""oi"""');
    expect(csvCell(null)).toBe('');
  });
  it('neutraliza injeção de fórmula', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('+5511')).toBe("'+5511");
  });
  it('gera BOM e CRLF', () => {
    expect(toCsv(['a', 'b'], [[1, 'x']])).toBe('﻿a;b\r\n1;x\r\n');
  });
});

describe('matriz', () => {
  it('interpreta limites e booleanos', () => {
    expect(parseCellInput('budgets.max', '5')).toEqual({ ok: true, value: 5 });
    expect(parseCellInput('budgets.max', '')).toEqual({ ok: true, value: null });
    expect(parseCellInput('budgets.max', 'ilimitado')).toEqual({ ok: true, value: null });
    expect(parseCellInput('budgets.max', '-1').ok).toBe(false);
    expect(parseCellInput('export.pdf', 'sim')).toEqual({ ok: true, value: true });
    expect(parseCellInput('export.pdf', 'talvez').ok).toBe(false);
    expect(parseCellInput('nao.existe', '1').ok).toBe(false);
  });
  it('formata e descreve diferenças', () => {
    expect(formatCell('ads.show', false)).toBe('Sem anúncios');
    expect(formatCell('goals.max', null)).toBe('Ilimitado');
    expect(
      describeDiff(
        { plan_id: 'free', feature_key: 'budgets.max', live: 3, draft: 5 },
        () => 'Free',
      ),
    ).toBe('Free · Orçamentos: 3 → 5');
  });
});

describe('formulários', () => {
  it('anúncios', () => {
    const fd = new FormData();
    fd.set('enabled', 'on');
    fd.set('placement.banner_home', 'on');
    fd.set('native_every_n', '10');
    fd.set('interstitial_min_interval_sec', '600');
    fd.set('unit.ios.banner_home', ' ca-app-pub-1/2 ');
    const c = parseAdConfigForm(fd);
    expect(c.enabled).toBe(true);
    expect(c.placements.banner_home).toBe(true);
    expect(c.placements.interstitial).toBe(false);
    expect(c.native_every_n).toBe(10);
    expect(c.ad_unit_ids.ios).toEqual({ banner_home: 'ca-app-pub-1/2' });
  });
  it('anúncios: intervalo mínimo inválido é rejeitado', () => {
    const fd = new FormData();
    fd.set('native_every_n', '2');
    fd.set('interstitial_min_interval_sec', '600');
    expect(() => parseAdConfigForm(fd)).toThrow();
  });
  it('config remota', () => {
    const fd = new FormData();
    fd.set('min_app_version', '1.2.0');
    fd.set('feature_flags', '{"x": true}');
    expect(parseAppConfigForm(fd)).toMatchObject({
      min_app_version: '1.2.0',
      feature_flags: { x: true },
    });
    fd.set('feature_flags', '{quebrado');
    expect(() => parseAppConfigForm(fd)).toThrow(/JSON/);
    fd.set('feature_flags', '{}');
    fd.set('min_app_version', '1.2');
    expect(() => parseAppConfigForm(fd)).toThrow(/Versão/);
  });
});

describe('papéis', () => {
  it('hierarquia', () => {
    expect(roleAtLeast('owner', 'editor')).toBe(true);
    expect(roleAtLeast('viewer', 'editor')).toBe(false);
  });
});

import { fillDays } from '../components/signups-chart';

describe('fillDays', () => {
  it('completa 30 dias com zeros', () => {
    const out = fillDays([{ day: '2026-11-21', count: 2 }], 30, new Date('2026-11-21T15:00:00Z'));
    expect(out).toHaveLength(30);
    expect(out[0]).toEqual({ day: '2026-10-23', count: 0 });
    expect(out[29]).toEqual({ day: '2026-11-21', count: 2 });
  });
});
