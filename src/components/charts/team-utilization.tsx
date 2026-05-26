'use client';

import { Clock } from 'lucide-react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export type UtilizationRow = {
  team: string;
  utilization: number;
};

export function TeamUtilizationChart({ data }: { data: UtilizationRow[] }) {
  if (data.length === 0) {
    return (
      <div className="grid h-72 place-items-center px-6 text-center">
        <div className="max-w-xs">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Clock className="h-5 w-5" />
          </div>
          <h4 className="mt-3 text-sm font-medium">No time logged yet</h4>
          <p className="mt-1 text-xs text-muted-foreground">
            When your team starts logging hours on tasks, their utilization vs capacity
            shows here.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 24, bottom: 8, left: 12 }}
        >
          <XAxis
            type="number"
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            tickLine={false}
            axisLine={false}
            fontSize={11}
            stroke="currentColor"
            className="text-muted-foreground"
          />
          <YAxis
            dataKey="team"
            type="category"
            tickLine={false}
            axisLine={false}
            fontSize={12}
            stroke="currentColor"
            width={120}
            className="text-muted-foreground"
          />
          <Tooltip
            cursor={{ fill: 'hsl(var(--accent) / 0.4)' }}
            formatter={(v: number) => [`${v}%`, 'Utilization']}
            contentStyle={{
              borderRadius: 8,
              border: '1px solid hsl(var(--border))',
              background: 'hsl(var(--popover))',
              fontSize: 12,
            }}
          />
          <Bar dataKey="utilization" radius={[4, 4, 4, 4]}>
            {data.map((d, idx) => (
              <Cell
                key={idx}
                fill={
                  d.utilization > 90
                    ? 'hsl(0 84% 60%)'
                    : d.utilization > 75
                      ? 'hsl(217 91% 60%)'
                      : 'hsl(142 71% 45%)'
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
