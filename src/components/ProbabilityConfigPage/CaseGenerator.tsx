/**
 * 案例生成器组件
 */

import { useState, useCallback, useEffect } from 'react';
import {
  Card as AntCard,
  Select,
  Typography,
  Space,
  Button,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Divider,
  Steps,
} from 'antd';
import { CalculatorOutlined } from '@ant-design/icons';
import type { DayState, ProbabilityCase, ProbabilityCalculationResult } from '@/types';
import { BACKPACK_PRESETS, DAY_STATE_PRESETS, DEFAULT_BASE_PROB_TABLE, DEFAULT_COEFFICIENT_TABLE } from '@/constants';
import { calculateFinalProbability } from '@/services';

const { Title, Text } = Typography;
const { Option } = Select;

interface CaseGeneratorProps {
  baseProbTable?: Record<string, number>;
  coefficientTable?: Record<string, number[]>;
}

export function CaseGenerator({
  baseProbTable = DEFAULT_BASE_PROB_TABLE,
  coefficientTable = DEFAULT_COEFFICIENT_TABLE,
}: CaseGeneratorProps) {
  // 状态
  const [backpackPreset, setBackpackPreset] = useState<string>('newbie');
  const [dayStatePreset, setDayStatePreset] = useState<string>('common_F');
  const [customBackpack, setCustomBackpack] = useState<Record<string, number>>({});
  const [calculationResult, setCalculationResult] = useState<ProbabilityCalculationResult | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(0);

  // 获取当前背包状态
  const getCurrentBackpack = useCallback((): Record<string, number> => {
    const preset = BACKPACK_PRESETS.find(p => p.key === backpackPreset);
    if (preset) {
      return { ...preset.backpack };
    }
    return customBackpack;
  }, [backpackPreset, customBackpack]);

  // 获取当前日期状态
  const getCurrentDayState = useCallback((): DayState => {
    const preset = DAY_STATE_PRESETS.find(p => p.key === dayStatePreset);
    if (preset) {
      return {
        dayIndex: 1,
        dayType: preset.dayType,
        luckyCard: preset.luckyCard,
      };
    }
    return {
      dayIndex: 1,
      dayType: 'COMMON',
      luckyCard: 'F',
    };
  }, [dayStatePreset]);

  // 运行计算
  const handleCalculate = useCallback(() => {
    const caseData: ProbabilityCase = {
      backpack: getCurrentBackpack(),
      dayState: getCurrentDayState(),
      baseProbTable: { ...baseProbTable },
      coefficientTable: { ...coefficientTable },
    };

    const result = calculateFinalProbability(caseData);
    setCalculationResult(result);
    setCurrentStep(result.steps.length - 1);
  }, [getCurrentBackpack, getCurrentDayState, baseProbTable, coefficientTable]);

  // 自动计算一次
  useEffect(() => {
    handleCalculate();
  }, []);

  // 概率分布表格列
  const probColumns = [
    {
      title: '卡片',
      dataIndex: 'card',
      key: 'card',
      render: (card: string) => <Text strong>{card}</Text>,
    },
    {
      title: '原始概率',
      dataIndex: 'original',
      key: 'original',
      render: (val: number) => <Text>{val.toFixed(2)}%</Text>,
    },
    {
      title: '最终概率',
      dataIndex: 'final',
      key: 'final',
      render: (val: number) => (
        <Text strong style={{ color: val > val * 2 ? '#52c41a' : val < val / 2 ? '#f5222d' : undefined }}>
          {val.toFixed(2)}%
        </Text>
      ),
    },
    {
      title: '变化',
      key: 'change',
      render: (record: { original: number; final: number }) => {
        const change = record.final - record.original;
        const changePercent = record.original > 0 ? (change / record.original) * 100 : 0;

        if (Math.abs(change) < 0.001) {
          return <Text type="secondary">-</Text>;
        }

        return (
          <Tag color={change > 0 ? 'green' : change < 0 ? 'red' : 'default'}>
            {change > 0 ? '+' : ''}{change.toFixed(2)}% ({changePercent > 0 ? '+' : ''}{changePercent.toFixed(0)}%)
          </Tag>
        );
      },
    },
  ];

  // 概率分布表格数据
  const probDataSource = calculationResult
    ? Object.entries(calculationResult.finalProbs).map(([card, finalProb]) => ({
        key: card,
        card,
        original: calculationResult.originalProbs[card] || 0,
        final: finalProb,
      }))
    : [];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      {/* 选择器 */}
      <Row gutter={[24, 24]}>
        <Col xs={24} md={12}>
          <AntCard title="背包状态" size="small">
            <Select
              style={{ width: '100%' }}
              value={backpackPreset}
              onChange={setBackpackPreset}
            >
              {BACKPACK_PRESETS.map(preset => (
                <Option key={preset.key} value={preset.key}>
                  <Space direction="vertical" size={0} style={{ width: '100%' }}>
                    <Text strong>{preset.label}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>{preset.description}</Text>
                  </Space>
                </Option>
              ))}
            </Select>

            {/* 显示当前背包 */}
            <div style={{ marginTop: 16 }}>
              <Text type="secondary">当前背包:</Text>
              <div style={{ marginTop: 8 }}>
                {Object.entries(getCurrentBackpack())
                  .filter(([, count]) => count > 0)
                  .map(([card, count]) => (
                    <Tag key={card} color="blue" style={{ margin: '0 8px 8px 0' }}>
                      {card}: {count}张
                    </Tag>
                  ))}
                {Object.values(getCurrentBackpack()).every(c => c === 0) && (
                  <Text type="secondary">空背包</Text>
                )}
              </div>
            </div>
          </AntCard>
        </Col>

        <Col xs={24} md={12}>
          <AntCard title="今日状态" size="small">
            <Select
              style={{ width: '100%' }}
              value={dayStatePreset}
              onChange={setDayStatePreset}
            >
              {DAY_STATE_PRESETS.map(preset => (
                <Option key={preset.key} value={preset.key}>
                  {preset.label}
                </Option>
              ))}
            </Select>

            {/* 显示当前日期状态 */}
            <div style={{ marginTop: 16 }}>
              <Text type="secondary">今日配置:</Text>
              <div style={{ marginTop: 8 }}>
                <Space>
                  <Tag color={getCurrentDayState().dayType === 'MAGIC' ? 'gold' : getCurrentDayState().dayType === 'RARE' ? 'purple' : 'default'}>
                    {getCurrentDayState().dayType === 'MAGIC' ? '神奇日' : getCurrentDayState().dayType === 'RARE' ? '稀有日' : '普通日'}
                  </Tag>
                  <Tag color="blue">幸运卡: {getCurrentDayState().luckyCard}</Tag>
                </Space>
              </div>
            </div>
          </AntCard>
        </Col>
      </Row>

      {/* 计算按钮 */}
      <Button
        type="primary"
        icon={<CalculatorOutlined />}
        onClick={handleCalculate}
        size="large"
        block
      >
        计算概率分布
      </Button>

      {/* 计算结果 */}
      {calculationResult && (
        <>
          <Divider />

          {/* 步骤展示 */}
          <AntCard title="计算步骤" size="small">
            <Steps
              direction="vertical"
              current={currentStep}
              onChange={setCurrentStep}
              items={calculationResult.steps.map(step => ({
                title: step.title,
                description: step.description,
              }))}
            />
          </AntCard>

          {/* 概率分布表 */}
          <AntCard title="概率分布" size="small">
            <Table
              dataSource={probDataSource}
              columns={probColumns}
              pagination={false}
              size="small"
              summary={() => (
                <Table.Summary fixed>
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0}><Text strong>合计</Text></Table.Summary.Cell>
                    <Table.Summary.Cell index={1}>
                      {Object.values(calculationResult.originalProbs).reduce((a, b) => a + b, 0).toFixed(2)}%
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={2}>
                      <Text strong style={{ color: calculationResult.validation.isValid ? '#52c41a' : '#f5222d' }}>
                        {calculationResult.validation.total.toFixed(2)}%
                      </Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={3}>
                      {calculationResult.validation.isValid ? (
                        <Tag color="success">✓ 验证通过</Tag>
                      ) : (
                        <Tag color="error">✗ 验证失败</Tag>
                      )}
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                </Table.Summary>
              )}
            />
          </AntCard>
        </>
      )}
    </Space>
  );
}
