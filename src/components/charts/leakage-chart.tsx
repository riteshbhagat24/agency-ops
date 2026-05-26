'use client';

import { TrendingDown } from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatCurrency } from '@/lib/utils';

export type LeakageRow = {
  period: string;
  goodwill: number;
  unbilled: number;
};

export function LeakageChart({ data }: { data: LeakageRow[] }) {
  const hasAnyData = data.some((d) => d.goodwill > 0 || d.unbilled > 0);
  if (!hasAnyData) {
    return (
      <div className="grid h-72 place-items-center px-6 text-center">
        <div className="max-w-xs">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <TrendingDown className="h-5 w-5" />
          </div>
          <h4 className="mt-3 text-sm font-medium">No scope leakage detected</h4>
          <p className="mt-1 text-xs text-muted-foreground">
            Goodwill and out-of-scope work tracked over the last 6 months will appear here.
            A flat zero line is a healthy sign.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 8, left: -8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/60" />
          <XAxis
            dataKey="period"
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
            width={56}
            stroke="currentColor"
            className="text-muted-foreground"
          />
          <Tooltip
            formatter={(v: number, key) => [
              formatCurrency(v),
              key === 'goodwill' ? 'Goodwill ₹' : 'Unbilled out-of-scope ₹',
            ]}
            contentStyle={{
              borderRadius: 8,
              border: '1px solid hsl(var(--border))',
              background: 'hsl(var(--popover))',
              fontSize: 12,
            }}
          />
          <Line
            type="monotone"
            dataKey="goodwill"
            stroke="hsl(271 81% 56%)"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="unbilled"
            stroke="hsl(0 84% 60%)"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
