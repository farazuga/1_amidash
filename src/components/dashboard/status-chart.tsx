'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface StatusChartProps {
  data: { name: string; count: number; color: string }[];
}

const COLORS = [
  '#023A2D', // Primary
  '#035544',
  '#047857',
  '#059669',
  '#10B981',
  '#34D399',
  '#6EE7B7',
  '#A7F3D0',
];

export function StatusChart({ data }: StatusChartProps) {
  const filteredData = data.filter(d => d.count > 0);

  if (filteredData.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-muted-foreground">
        No project data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={filteredData}
          cx="50%"
          cy="50%"
          labelLine={false}
          outerRadius={100}
          fill="#8884d8"
          dataKey="count"
          nameKey="name"
          label={({ name, value }) => `${name}: ${value}`}
        >
          {filteredData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number) => [`${value} projects`, 'Count']}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
