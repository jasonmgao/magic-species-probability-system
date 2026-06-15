/**
 * 卡面选择页（最终版）
 *
 * 特性：
 * 1. 任意组合形式（不限定A×2+B×1）
 * 2. 一次性输出所有背包状态的降权系数
 * 3. 使用Web Worker避免卡顿
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { Row, Col, Card as AntCard, Button, Space, Typography, message, Progress, Tag, Table, InputNumber, Alert } from 'antd';
import { CalculatorOutlined, SettingOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import type { CombinationRequirement, StateSimulationResult } from '@/types';
import { BACKPACK_CONFIGS } from '@/services/simulationEngine';

const { Title, Text } = Typography;

interface CardSelectionPageProps {
  onNavigateToConfig?: () => void;
}

const ALL_CARDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
const RARITIES = [
  { value: 'MAGIC' as const, label: '神奇', color: '#FFD700' },
  { value: 'RARE' as const, label: '稀有', color: '#9B59B6' },
  { value: 'COMMON' as const, label: '普通', color: '#95A5A6' },
];

export function CardSelectionPage({ onNavigateToConfig }: CardSelectionPageProps) {
  // 组合配置（支持任意形式）
  const [combinations, setCombinations] = useState<CombinationRequirement[]>([
    {
      name: '第一套',
      cards: [
        { cardId: 'A', count: 2 },
        { cardId: 'B', count: 1 },
      ],
      deadline: 7,
    },
    {
      name: '第二套',
      cards: [
        { cardId: 'C', count: 2 },
        { cardId: 'D', count: 1 },
      ],
      deadline: 14,
    },
  ]);

  // 模拟状态
  const [isCalculating, setIsCalculating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<StateSimulationResult[]>([]);
  const [bestState, setBestState] = useState<StateSimulationResult | null>(null);

  const workerRef = useRef<Worker | null>(null);

  // 初始化Worker
  useEffect(() => {
    workerRef.current = new Worker(new URL('../../workers/simulation.worker.ts', import.meta.url));

    workerRef.current.onmessage = (event) => {
      const { type, state, result, error } = event.data;

      if (type === 'stateComplete') {
        setResults(prev => [...prev, result]);
        const completedCount = results.length + 1;
        setProgress((completedCount / 5) * 100);
      } else if (type === 'complete') {
        setResults(result.stateResults);
        setBestState(result.bestState);
        setIsCalculating(false);
        setProgress(100);
        message.success('模拟完成！');
      } else if (type === 'error') {
        message.error(`模拟失败: ${error}`);
        setIsCalculating(false);
      }
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  // 添加组合
  const addCombination = useCallback(() => {
    setCombinations(prev => [
      ...prev,
      {
        name: `组合${prev.length + 1}`,
        cards: [{ cardId: 'A', count: 1 }],
        deadline: 14,
      },
    ]);
  }, []);

  // 删除组合
  const removeCombination = useCallback((index: number) => {
    setCombinations(prev => prev.filter((_, i) => i !== index));
  }, []);

  // 更新组合
  const updateCombination = useCallback((index: number, updates: Partial<CombinationRequirement>) => {
    setCombinations(prev => prev.map((combo, i) =>
      i === index ? { ...combo, ...updates } : combo
    ));
  }, []);

  // 添加卡片需求
  const addCardRequirement = useCallback((comboIndex: number) => {
    setCombinations(prev => prev.map((combo, i) =>
      i === comboIndex
        ? { ...combo, cards: [...combo.cards, { cardId: 'E', count: 1 }] }
        : combo
    ));
  }, []);

  // 更新卡片需求
  const updateCardRequirement = useCallback((comboIndex: number, cardIndex: number, updates: { cardId?: string; count?: number }) => {
    setCombinations(prev => prev.map((combo, i) => {
      if (i !== comboIndex) return combo;
      const newCards = [...combo.cards];
      newCards[cardIndex] = { ...newCards[cardIndex], ...updates };
      return { ...combo, cards: newCards };
    }));
  }, []);

  // 删除卡片需求
  const removeCardRequirement = useCallback((comboIndex: number, cardIndex: number) => {
    setCombinations(prev => prev.map((combo, i) => {
      if (i !== comboIndex) return combo;
      return { ...combo, cards: combo.cards.filter((_, j) => j !== cardIndex) };
    }));
  }, []);

  // 运行模拟
  const runSimulation = useCallback(() => {
    if (combinations.length === 0) {
      message.error('请至少配置一个组合');
      return;
    }

    setIsCalculating(true);
    setProgress(0);
    setResults([]);
    setBestState(null);

    workerRef.current?.postMessage({
      combinations,
      trials: 20000, // 减少次数以提高速度
    });
  }, [combinations]);

  // 结果表格列
  const resultColumns = [
    {
      title: '背包状态',
      dataIndex: 'label',
      key: 'label',
    },
    {
      title: '全收集率',
      dataIndex: 'fullCollectionRate',
      key: 'fullCollectionRate',
      render: (rate: number) => (
        <Tag color={rate > 50 ? 'green' : rate > 30 ? 'orange' : 'red'}>
          {rate.toFixed(2)}%
        </Tag>
      ),
    },
    ...combinations.map(combo => ({
      title: `${combo.name}中奖率`,
      key: combo.name,
      render: (record: StateSimulationResult) => (
        <Tag color={record.combinationRates[combo.name] < 5 ? 'green' : 'red'}>
          {record.combinationRates[combo.name]?.toFixed(2) || '0'}%
        </Tag>
      ),
    })),
  ];

  return (
    <div style={{ padding: '24px', maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>🎴 神奇物种概率测算系统</Title>
        <Text type="secondary">
          配置任意形式的组合，系统自动计算所有背包状态下的降权系数
        </Text>
      </div>

      <Row gutter={[24, 24]}>
        {/* 左侧：组合配置 */}
        <Col xs={24} lg={14}>
          <AntCard title="组合配置（任意形式）" bordered={false}>
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              {combinations.map((combo, comboIndex) => (
                <div key={comboIndex} style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <Space>
                      <input
                        value={combo.name}
                        onChange={(e) => updateCombination(comboIndex, { name: e.target.value })}
                        style={{ fontWeight: 'bold', fontSize: 16, border: 'none', borderBottom: '1px solid #d9d9d9' }}
                      />
                      <span>截止第</span>
                      <InputNumber
                        min={1}
                        max={14}
                        value={combo.deadline}
                        onChange={(v) => updateCombination(comboIndex, { deadline: v || 7 })}
                        size="small"
                        style={{ width: 60 }}
                      />
                      <span>天</span>
                    </Space>
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => removeCombination(comboIndex)}
                    />
                  </div>

                  <Space direction="vertical" style={{ width: '100%' }}>
                    {combo.cards.map((req, cardIndex) => (
                      <Space key={cardIndex}>
                        <span>需要</span>
                        <InputNumber
                          min={1}
                          max={5}
                          value={req.count}
                          onChange={(v) => updateCardRequirement(comboIndex, cardIndex, { count: v || 1 })}
                          style={{ width: 60 }}
                        />
                        <span>张</span>
                        <select
                          value={req.cardId}
                          onChange={(e) => updateCardRequirement(comboIndex, cardIndex, { cardId: e.target.value })}
                          style={{ padding: '4px 8px' }}
                        >
                          {ALL_CARDS.map(card => (
                            <option key={card} value={card}>{card}</option>
                          ))}
                        </select>
                        <Button
                          type="text"
                          danger
                          size="small"
                          onClick={() => removeCardRequirement(comboIndex, cardIndex)}
                        >
                          删除
                        </Button>
                      </Space>
                    ))}
                    <Button
                      type="dashed"
                      size="small"
                      icon={<PlusOutlined />}
                      onClick={() => addCardRequirement(comboIndex)}
                    >
                      添加卡片
                    </Button>
                  </Space>
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
                <Progress percent={Math.round(progress)} status="active" />
                <Text type="secondary">正在计算所有背包状态...</Text>
              </div>
            )}

            {results.length > 0 && !isCalculating && (
              <div>
                <Alert
                  message="测算完成"
                  description="所有背包状态的降权系数已自动计算"
                  type="success"
                  showIcon
                  style={{ marginBottom: 16 }}
                />

                {bestState && (
                  <AntCard
                    size="small"
                    style={{ marginBottom: 16, backgroundColor: '#f6ffed', borderColor: '#b7eb8f' }}
                  >
                    <div style={{ textAlign: 'center' }}>
                      <Text type="secondary">最佳背包状态</Text>
                      <div style={{ fontSize: 24, fontWeight: 'bold', color: '#52c41a' }}>
                        {bestState.label}
                      </div>
                      <Text type="secondary">全收集率</Text>
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
                  rowKey="backpackState"
                />
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
