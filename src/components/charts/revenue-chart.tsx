'use client';

import { BarChart3 } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts';
import { formatCurrency } from '@/lib/utils';

export type RevenueRow = {
  client: string;
  retainer: number;
  extra: number;
};

export function RevenueChart({ data }: { data: RevenueRow[] }) {
  if (data.length === 0 || data.every((d) => d.retainer === 0 && d.extra === 0)) {
    return (
      <div className="grid h-72 place-items-center px-6 text-center">
        <div className="max-w-xs">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <BarChart3 className="h-5 w-5" />
          </div>
          <h4 className="mt-3 text-sm font-medium">No revenue data yet</h4>
          <p className="mt-1 text-xs text-muted-foreground">
            Add active clients with a retainer amount, or approve extra-billable tickets,
            and they'll appear here.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: -8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/60" />
          <XAxis
            dataKey="client"
            tickLine={false}
            axisLine={false}
            fontSize={11}
            stroke="currentColor"
            className="text-muted-foreground"
          />
          <YAxis
            tickFormatter={(v) => formatCurrency(v, true)}
            tickLine={false}
            axisLine={false}
            fontSize={11}
            stroke="currentColor"
            className="text-muted-foreground"
            width={56}
          />
          <Tooltip
            cursor={{ fill: 'hsl(var(--accent) / 0.4)' }}
            formatter={(v: number, key) => [formatCurrency(v), key === 'retainer' ? 'Retainer' : 'Extra Billable']}
            contentStyle={{
              borderRadius: 8,
              border: '1px solid hsl(var(--border))',
              background: 'hsl(var(--popover))',
              fontSize: 12,
            }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            formatter={(v) => (v === 'retainer' ? 'Retainer' : 'Extra Billable')}
          />
          <Bar dataKey="retainer" stackId="rev" radius={[0, 0, 4, 4]} fill="hsl(217 91% 60%)" />
          <Bar dataKey="extra" stackId="rev" radius={[4, 4, 0, 0]} fill="hsl(25 95% 53%)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
