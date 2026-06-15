/**
 * 概率可视化图表组件
 * 使用 Recharts 展示集齐率对比和累计曲线
 */

import { useMemo } from 'react';
import { Card as AntCard, Typography, Empty } from 'antd';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  LineChart,
  Line,
} from 'recharts';
import type { SimulationResult } from '@/types';

const { Title, Text } = Typography;

interface ProbabilityChartProps {
  result: SimulationResult | null;
}

export function ProbabilityChart({ result }: ProbabilityChartProps) {
  // 集齐率对比数据
  const comparisonData = useMemo(() => {
    if (!result) return [];
    return [
      {
        name: 'Week 1',
        实际集齐率: result.week1CompletionRate,
        目标值: result.week1TargetRate,
      },
      {
        name: 'Week 2',
        实际集齐率: result.week2CompletionRate,
        目标值: result.week2TargetRate,
      },
    ];
  }, [result]);

  if (!result) {
    return (
      <AntCard title="概率可视化" bordered={false}>
        <Empty description="请先运行概率测算" />
      </AntCard>
    );
  }

  return (
    <AntCard title="概率可视化" bordered={false}>
      <div style={{ marginBottom: 32 }}>
        <Title level={5}>集齐率对比</Title>
        <div style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={comparisonData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis domain={[0, 100]} tickFormatter={(val) => `${val}%`} />
              <Tooltip formatter={(val) => typeof val === 'number' ? `${val.toFixed(2)}%` : val} />
              <Legend />
              <ReferenceLine y={95} stroke="#52c41a" strokeDasharray="3 3" label="推荐线 (95%)" />
              <ReferenceLine y={80} stroke="#faad14" strokeDasharray="3 3" label="可接受线 (80%)" />
              <Bar dataKey="实际集齐率" fill="#1890ff" />
              <Bar dataKey="目标值" fill="#52c41a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 说明 */}
      <div>
        <Title level={5}>图表说明</Title>
        <Text type="secondary">
          • 蓝色柱：实际测算集齐率<br />
          • 绿色柱：目标中奖率（4%）<br />
          • 虚线：推荐阈值（80%/95%）
        </Text>
      </div>
    </AntCard>
  );
}
