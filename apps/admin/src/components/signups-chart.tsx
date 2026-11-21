'use client';

import { useState } from 'react';

interface Point {
  day: string;
  count: number;
}

const fmtDay = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

/** Completa os 30 dias (dias sem cadastro = 0) para a série ser contínua. */
export function fillDays(data: Point[], days = 30, today = new Date()): Point[] {
  const by = new Map(data.map((d) => [d.day.slice(0, 10), d.count]));
  const out: Point[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i),
    );
    const key = d.toISOString().slice(0, 10);
    out.push({ day: key, count: by.get(key) ?? 0 });
  }
  return out;
}

function niceMax(v: number) {
  if (v <= 5) return 5;
  const exp = 10 ** Math.floor(Math.log10(v));
  const n = v / exp;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * exp;
}

/** Barras de série única (cor primária), um eixo, tooltip no hover/foco e tabela para leitores de tela. */
export function SignupsChart({ data: raw }: { data: Point[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const data = fillDays(raw);
  if (raw.length === 0)
    return <p className="text-sm text-muted-foreground">Sem cadastros no período.</p>;

  const W = 640;
  const H = 180;
  const left = 32;
  const bottom = 20;
  const plotW = W - left;
  const top = 12;
  const plotH = H - bottom - top;
  const max = niceMax(Math.max(...data.map((d) => d.count)));
  const slot = plotW / data.length;
  const barW = Math.max(2, Math.min(16, slot - 2));
  const h = hover !== null ? data[hover] : null;

  return (
    <div className="relative">
      <div aria-live="polite" className="mb-2 h-5 text-sm">
        {h ? (
          <span>
            <span className="font-semibold">{fmtDay(h.day)}</span> ·{' '}
            <span className="tabular">{h.count}</span> cadastro(s)
          </span>
        ) : (
          <span className="text-muted-foreground">Passe o mouse sobre as barras</span>
        )}
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Novos usuários por dia nos últimos 30 dias"
      >
        <g transform={`translate(0 ${top})`}>
          {[0, 0.5, 1].map((f) => (
            <g key={f}>
              <line
                x1={left}
                x2={W}
                y1={plotH - plotH * f}
                y2={plotH - plotH * f}
                stroke="var(--border)"
              />
              <text
                x={left - 6}
                y={plotH - plotH * f + 4}
                textAnchor="end"
                className="fill-muted-foreground text-[10px] tabular"
              >
                {Math.round(max * f)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const bh = (d.count / max) * plotH;
            const x = left + i * slot + (slot - barW) / 2;
            const r = Math.min(4, barW / 2, bh);
            const y = plotH - bh;
            const path =
              bh <= 0
                ? ''
                : `M${x},${plotH} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + barW - r},${y} Q${x + barW},${y} ${x + barW},${y + r} L${x + barW},${plotH} Z`;
            return (
              <g key={d.day}>
                <path
                  d={path}
                  fill="var(--chart-1)"
                  opacity={hover === null || hover === i ? 1 : 0.45}
                />
                {/* área de toque maior que a barra */}
                <rect
                  x={left + i * slot}
                  y={0}
                  width={slot}
                  height={plotH}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`${fmtDay(d.day)}: ${d.count}`}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                />
              </g>
            );
          })}
          {[0, Math.floor(data.length / 2), data.length - 1].map((i) => (
            <text
              key={i}
              x={left + i * slot + slot / 2}
              y={H - 4 - top}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px]"
            >
              {fmtDay(data[i]!.day)}
            </text>
          ))}
        </g>
      </svg>
      <table className="sr-only">
        <caption>Novos usuários por dia</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.day}>
              <th scope="row">{fmtDay(d.day)}</th>
              <td>{d.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
