/**
 * 推荐建议面板
 */

import { Typography, Card as AntCard, Tag, Space, Alert } from 'antd';
import { CheckCircleOutlined, WarningOutlined, CloseCircleOutlined } from '@ant-design/icons';
import type { SimulationResult } from '@/types';

const { Title, Text } = Typography;

interface RecommendationPanelProps {
  result: SimulationResult | null;
}

export function RecommendationPanel({ result }: RecommendationPanelProps) {
  if (!result) {
    return (
      <AntCard title="推荐建议" bordered={false}>
        <Alert
          message="暂无推荐数据"
          description="请先运行概率测算"
          type="info"
          showIcon
        />
      </AntCard>
    );
  }

  const getIcon = (level: string) => {
    switch (level) {
      case '推荐':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case '可接受':
        return <WarningOutlined style={{ color: '#faad14' }} />;
      case '不推荐':
        return <CloseCircleOutlined style={{ color: '#f5222d' }} />;
      default:
        return null;
    }
  };

  const getColor = (level: string) => {
    switch (level) {
      case '推荐':
        return 'green';
      case '可接受':
        return 'orange';
      case '不推荐':
        return 'red';
      default:
        return 'default';
    }
  };

  return (
    <AntCard title="推荐建议" bordered={false}>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* 推荐等级 */}
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <Space align="center" size="large">
            {getIcon(result.recommendation)}
            <Title level={2} style={{ margin: 0 }}>
              <Tag color={getColor(result.recommendation)} style={{ fontSize: 24, padding: '8px 16px' }}>
                {result.recommendation}
              </Tag>
            </Title>
          </Space>
        </div>

        {/* 详细说明 */}
        <Alert
          message="评估说明"
          description={result.recommendationReason}
          type={getColor(result.recommendation) as any}
          showIcon
        />

        {/* 阈值说明 */}
        <div>
          <Title level={5}>推荐阈值</Title>
          <Space direction="vertical">
            <Text>
              <Tag color="green">≥ 95%</Tag> 推荐：集齐率理想
            </Text>
            <Text>
              <Tag color="orange">80% - 95%</Tag> 可接受：有优化空间
            </Text>
            <Text>
              <Tag color="red">&lt; 80%</Tag> 不推荐：集齐率过低
            </Text>
          </Space>
        </div>

        {/* 当前配置详情 */}
        <div>
          <Title level={5}>当前配置集齐率</Title>
          <Space direction="vertical">
            <Text>
              Week 1: <strong>{result.week1CompletionRate.toFixed(2)}%</strong>
              {result.week1CompletionRate >= 95 ? ' ✅' :
               result.week1CompletionRate >= 80 ? ' ⚠️' : ' ❌'}
            </Text>
            <Text>
              Week 2: <strong>{result.week2CompletionRate.toFixed(2)}%</strong>
              {result.week2CompletionRate >= 95 ? ' ✅' :
               result.week2CompletionRate >= 80 ? ' ⚠️' : ' ❌'}
            </Text>
          </Space>
        </div>
      </Space>
    </AntCard>
  );
}
