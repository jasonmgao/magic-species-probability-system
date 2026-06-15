/**
 * 卡面选择页（完全自由组合版）
 */

import { useState, useCallback } from 'react';
import { Row, Col, Card as AntCard, Button, Space, Typography, message, Progress, Table, Tag, InputNumber, Select } from 'antd';
import { CalculatorOutlined, SettingOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import type { Combination, SingleStateResult } from '@/types';
import { runFullSimulation, BACKPACK_STATES } from '@/services/simulationEngine';

const { Title, Text } = Typography;
const { Option } = Select;

const ALL_CARDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

interface CardSelectionPageProps {
  onNavigateToConfig?: () => void;
}

export function CardSelectionPage({ onNavigateToConfig }: CardSelectionPageProps) {
  // 组合配置（完全自由）
  const [combinations, setCombinations] = useState<Combination[]>([
    {
      name: '第一套',
      requirements: [
        { cardId: 'A', count: 2 },
        { cardId: 'B', count: 1 },
        { cardId: 'C', count: 1 },
      ],
      deadline: 7,
    },
    {
      name: '第二套',
      requirements: [
        { cardId: 'C', count: 2 },
        { cardId: 'D', count: 1 },
        { cardId: 'E', count: 1 },
      ],
      deadline: 14,
    },
  ]);

  // 模拟状态
  const [isCalculating, setIsCalculating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<SingleStateResult[]>([]);
  const [bestState, setBestState] = useState<SingleStateResult | null>(null);

  // 添加组合
  const addCombination = useCallback(() => {
    setCombinations(prev => [
      ...prev,
      {
        name: `组合${prev.length + 1}`,
        requirements: [],
        deadline: 14,
      },
    ]);
  }, []);

  // 删除组合
  const removeCombination = useCallback((index: number) => {
    setCombinations(prev => prev.filter((_, i) => i !== index));
  }, []);

  // 更新组合
  const updateCombination = useCallback((index: number, updates: Partial<Combination>) => {
    setCombinations(prev => prev.map((combo, i) =>
      i === index ? { ...combo, ...updates } : combo
    ));
  }, []);

  // 添加卡片需求
  const addRequirement = useCallback((comboIndex: number) => {
    setCombinations(prev => prev.map((combo, i) => {
      if (i !== comboIndex) return combo;
      // 找一张未使用的卡
      const usedCards = new Set(combo.requirements.map(r => r.cardId));
      const availableCard = ALL_CARDS.find(c => !usedCards.has(c)) || 'A';
      return {
        ...combo,
        requirements: [...combo.requirements, { cardId: availableCard, count: 1 }],
      };
    }));
  }, []);

  // 更新卡片需求
  const updateRequirement = useCallback((
    comboIndex: number,
    reqIndex: number,
    updates: { cardId?: string; count?: number }
  ) => {
    setCombinations(prev => prev.map((combo, i) => {
      if (i !== comboIndex) return combo;
      return {
        ...combo,
        requirements: combo.requirements.map((req, j) =>
          j === reqIndex ? { ...req, ...updates } : req
        ),
      };
    }));
  }, []);

  // 删除卡片需求
  const removeRequirement = useCallback((comboIndex: number, reqIndex: number) => {
    setCombinations(prev => prev.map((combo, i) => {
      if (i !== comboIndex) return combo;
      return {
        ...combo,
        requirements: combo.requirements.filter((_, j) => j !== reqIndex),
      };
    }));
  }, []);

  // 运行模拟
  const runSimulation = useCallback(() => {
    if (combinations.length === 0) {
      message.error('请至少配置一个组合');
      return;
    }

    // 验证每个组合
    for (const combo of combinations) {
      if (combo.requirements.length === 0) {
        message.error(`组合"${combo.name}"没有配置卡片`);
        return;
      }
    }

    setIsCalculating(true);
    setProgress(0);
    setResults([]);
    setBestState(null);

    // 模拟进度更新
    const updateProgress = () => {
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(interval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);
      return interval;
    };

    const interval = updateProgress();

    // 使用setTimeout让UI更新
    setTimeout(() => {
      const result = runFullSimulation({ combinations }, 4.0, 15000);

      clearInterval(interval);
      setProgress(100);
      setResults(result.stateResults);
      setBestState(result.bestState);
      setIsCalculating(false);
    }, 100);
  }, [combinations]);

  // 表格列
  const resultColumns = [
    { title: '背包状态', dataIndex: 'label', key: 'label' },
    { title: '描述', dataIndex: 'description', key: 'description' },
    {
      title: '全收集率',
      dataIndex: 'fullCollectionRate',
      key: 'fullCollectionRate',
      render: (v: number) => <Tag color={v > 50 ? 'green' : 'orange'}>{v.toFixed(2)}%</Tag>,
    },
    ...combinations.map((combo, idx) => ({
      title: `${combo.name}中奖率`,
      key: combo.name,
      render: (record: SingleStateResult) => {
        const rate = record.combinationRates[combo.name] || 0;
        const color = Math.abs(rate - 4) < 1 ? 'green' : Math.abs(rate - 4) < 2 ? 'orange' : 'red';
        return <Tag color={color}>{rate.toFixed(2)}%</Tag>;
      },
    })),
  ];

  return (
    <div style={{ padding: '24px', maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>🎴 神奇物种概率测算系统</Title>
        <Text type="secondary">
          自由配置组合（任意卡片、任意数量），自动计算降权系数控制中奖率≈4%
        </Text>
      </div>

      <Row gutter={[24, 24]}>
        {/* 左侧：组合配置 */}
        <Col xs={24} lg={14}>
          <AntCard title="组合配置（完全自由）" bordered={false}>
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              {combinations.map((combo, comboIdx) => (
                <div key={comboIdx} style={{ border: '1px solid #d9d9d9', borderRadius: 8, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <Space>
                      <InputNumber
                        min={1}
                        max={14}
                        value={combo.deadline}
                        onChange={(v) => updateCombination(comboIdx, { deadline: v || 7 })}
                        addonBefore="第"
                        addonAfter="天截止"
                        style={{ width: 140 }}
                      />
                      <input
                        value={combo.name}
                        onChange={(e) => updateCombination(comboIdx, { name: e.target.value })}
                        style={{ fontWeight: 'bold', fontSize: 16, padding: '4px 8px', border: '1px solid #d9d9d9', borderRadius: 4 }}
                      />
                    </Space>
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => removeCombination(comboIdx)}
                    />
                  </div>

                  <div style={{ marginBottom: 8 }}>
                    <Text type="secondary">需要的卡片（数量和种类任意）：</Text>
                  </div>

                  <Space direction="vertical" style={{ width: '100%' }}>
                    {combo.requirements.map((req, reqIdx) => (
                      <Space key={reqIdx}>
                        <Select
                          value={req.cardId}
                          onChange={(v) => updateRequirement(comboIdx, reqIdx, { cardId: v })}
                          style={{ width: 80 }}
                        >
                          {ALL_CARDS.map(c => <Option key={c} value={c}>{c}</Option>)}
                        </Select>
                        <InputNumber
                          min={1}
                          max={5}
                          value={req.count}
                          onChange={(v) => updateRequirement(comboIdx, reqIdx, { count: v || 1 })}
                          addonAfter="张"
                          style={{ width: 100 }}
                        />
                        <Button
                          type="text"
                          danger
                          size="small"
                          icon={<DeleteOutlined />}
                          onClick={() => removeRequirement(comboIdx, reqIdx)}
                        />
                      </Space>
                    ))}
                    <Button
                      type="dashed"
                      size="small"
                      icon={<PlusOutlined />}
                      onClick={() => addRequirement(comboIdx)}
                    >
                      添加卡片
                    </Button>
                  </Space>

                  {combo.requirements.length > 0 && (
                    <div style={{ marginTop: 12, padding: 8, backgroundColor: '#f6ffed', borderRadius: 4 }}>
                      <Text strong style={{ color: '#52c41a' }}>
                        {combo.requirements.map(r => `${r.cardId}×${r.count}`).join(' + ')}
                      </Text>
                    </div>
                  )}
                </div>
              ))}

              <Button type="dashed" block icon={<PlusOutlined />} onClick={addCombination}>
                添加组合
              </Button>
            </Space>
          </AntCard>
        </Col>

        {/* 右侧：模拟 */}
        <Col xs={24} lg={10}>
          <AntCard title="概率测算" bordered={false}>
            <Button
              type="primary"
              size="large"
              icon={<CalculatorOutlined />}
              onClick={runSimulation}
              disabled={isCalculating}
              block
              style={{ marginBottom: 16 }}
            >
              {isCalculating ? '计算中...' : '开始测算'}
            </Button>

            {isCalculating && (
              <div style={{ marginBottom: 16 }}>
                <Progress percent={progress} status="active" />
                <Text type="secondary">正在计算各背包状态...</Text>
              </div>
            )}

            {results.length > 0 && (
              <div>
                {bestState && (
                  <AntCard size="small" style={{ marginBottom: 16, backgroundColor: '#f6ffed' }}>
                    <div style={{ textAlign: 'center' }}>
                      <Text type="secondary">最佳背包状态</Text>
                      <div style={{ fontSize: 24, fontWeight: 'bold', color: '#52c41a' }}>
                        {bestState.label}
                      </div>
                      <Text type="secondary">平均14天全收集率</Text>
                      <div style={{ fontSize: 36, fontWeight: 'bold', color: '#52c41a' }}>
                        {bestState.fullCollectionRate.toFixed(2)}%
                      </div>
                    </div>
                  </AntCard>
                )}

                <Table
                  size="small"
                  dataSource={results}
                  columns={resultColumns}
                  pagination={false}
                  rowKey="state"
                />

                {/* 降权系数展示 */}
                <div style={{ marginTop: 16 }}>
                  <Text strong>降权系数（示例）- {results[0]?.label}:</Text>
                  <div style={{ marginTop: 8, fontSize: 12 }}>
                    {Object.entries(results[0]?.coefficients || {})
                      .filter(([_, coeffs]) => coeffs[1] > 0)
                      .slice(0, 5)
                      .map(([card, coeffs]) => (
                        <Tag key={card} style={{ margin: '2px 4px' }}>
                          {card}: [{coeffs.map(c => (c * 100).toFixed(1) + '%').join(', ')}]
                        </Tag>
                      ))}
                  </div>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    [持有0张系数, 持有1张系数, 持有2张系数...]
                  </Text>
                </div>
              </div>
            )}
          </AntCard>
        </Col>
      </Row>

      <div style={{ marginTop: 24, textAlign: 'center' }}>
        <Button type="default" size="large" icon={<SettingOutlined />} onClick={onNavigateToConfig}>
          概率配置详情
        </Button>
      </div>
    </div>
  );
}
