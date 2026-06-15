/**
 * 概率配置页 - 主页面
 */

import { useState } from 'react';
import { Tabs, Card as AntCard, Typography, Space, Button, Alert, Row, Col } from 'antd';
import { SettingOutlined, CalculatorOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { BaseProbTable } from './BaseProbTable';
import { CoefficientTable } from './CoefficientTable';
import { CaseGenerator } from './CaseGenerator';
import { DEFAULT_BASE_PROB_TABLE, DEFAULT_COEFFICIENT_TABLE } from '@/constants';

const { Title, Text } = Typography;

interface ProbabilityConfigPageProps {
  onNavigateToSelection?: () => void;
}

export function ProbabilityConfigPage({ onNavigateToSelection }: ProbabilityConfigPageProps) {
  const [baseProbTable, setBaseProbTable] = useState<Record<string, number>>({ ...DEFAULT_BASE_PROB_TABLE });
  const [coefficientTable, setCoefficientTable] = useState<Record<string, number[]>>(
    JSON.parse(JSON.stringify(DEFAULT_COEFFICIENT_TABLE))
  );

  // 检查概率总和
  const probTotal = Object.values(baseProbTable).reduce((sum, prob) => sum + prob, 0);
  const isProbValid = Math.abs(probTotal - 100) < 0.01;

  const tabItems = [
    {
      key: 'base',
      label: (
        <Space>
          <SettingOutlined />
          基础概率表
        </Space>
      ),
      children: (
        <BaseProbTable
          value={baseProbTable}
          onChange={setBaseProbTable}
        />
      ),
    },
    {
      key: 'coefficient',
      label: (
        <Space>
          <SettingOutlined />
          降权系数表
        </Space>
      ),
      children: (
        <CoefficientTable
          value={coefficientTable}
          onChange={setCoefficientTable}
        />
      ),
    },
    {
      key: 'case',
      label: (
        <Space>
          <CalculatorOutlined />
          案例生成器
        </Space>
      ),
      children: (
        <CaseGenerator
          baseProbTable={baseProbTable}
          coefficientTable={coefficientTable}
        />
      ),
    },
  ];

  return (
    <div style={{ padding: '24px', maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>⚙️ 概率配置页</Title>
        <Text type="secondary">
          配置基础概率表和降权系数表，生成概率计算案例
        </Text>
      </div>

      {/* 全局警告 */}
      {!isProbValid && (
        <Alert
          message="基础概率总和异常"
          description={`当前概率总和为 ${probTotal.toFixed(1)}%，必须为 100% 才能正确计算`}
          type="error"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      {/* 配置说明 */}
      <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
        <Col xs={24} md={8}>
          <AntCard title="📊 基础概率表" size="small">
            <Text type="secondary">
              配置卡池中 10 张卡的基础掉落概率。神奇卡默认 2%，稀有卡默认 7%，普通卡默认 14%。
            </Text>
          </AntCard>
        </Col>
        <Col xs={24} md={8}>
          <AntCard title="🔽 降权系数表" size="small">
            <Text type="secondary">
              配置当用户背包中已持有某卡时的概率降权系数。持有越多，掉落概率越低。
            </Text>
          </AntCard>
        </Col>
        <Col xs={24} md={8}>
          <AntCard title="🧮 案例生成器" size="small">
            <Text type="secondary">
              选择背包状态和今日日期类型，系统将展示完整的概率计算流程和最终结果。
            </Text>
          </AntCard>
        </Col>
      </Row>

      {/* 主内容区 */}
      <AntCard>
        <Tabs
          defaultActiveKey="base"
          items={tabItems}
          type="card"
        />
      </AntCard>

      {/* 底部导航 */}
      <div style={{ marginTop: 24, textAlign: 'center' }}>
        <Button
          type="default"
          size="large"
          icon={<ArrowLeftOutlined />}
          onClick={onNavigateToSelection}
        >
          返回卡面选择页
        </Button>
      </div>
    </div>
  );
}
