/**
 * 卡面选择页（修正版）
 *
 * 特性：
 * 1. 两套组合，每套3张卡（其中1张需要2张）
 * 2. 显示A-J分别是什么卡
 * 3. 自动计算所有背包状态的降权系数
 * 4. 交叉控制逻辑
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { Row, Col, Card as AntCard, Button, Space, Typography, message, Progress, Tag, Table, Alert } from 'antd';
import { CalculatorOutlined, SettingOutlined } from '@ant-design/icons';
import type { CardSetup, Combination, StateResult } from '@/types';
import { BASE_CARDS, RARITY_CONFIG } from '@/constants';
import { runFullSimulation, BACKPACK_CONFIGS } from '@/services/simulationEngine';

const { Title, Text } = Typography;

interface CardSelectionPageProps {
  onNavigateToConfig?: () => void;
}

// 10张卡信息
const CARD_INFO: Record<string, { name: string; rarity: string; color: string }> = {
  A: { name: '神奇卡 A', rarity: 'MAGIC', color: '#FFD700' },
  B: { name: '稀有卡 B', rarity: 'RARE', color: '#9B59B6' },
  C: { name: '稀有卡 C', rarity: 'RARE', color: '#9B59B6' },
  D: { name: '稀有卡 D', rarity: 'RARE', color: '#9B59B6' },
  E: { name: '稀有卡 E', rarity: 'RARE', color: '#9B59B6' },
  F: { name: '普通卡 F', rarity: 'COMMON', color: '#95A5A6' },
  G: { name: '普通卡 G', rarity: 'COMMON', color: '#95A5A6' },
  H: { name: '普通卡 H', rarity: 'COMMON', color: '#95A5A6' },
  I: { name: '普通卡 I', rarity: 'COMMON', color: '#95A5A6' },
  J: { name: '普通卡 J', rarity: 'COMMON', color: '#95A5A6' },
};

export function CardSelectionPage({ onNavigateToConfig }: CardSelectionPageProps) {
  // 组合配置（3张卡：1张需要2张 + 2张各需要1张）
  const [setup, setSetup] = useState<CardSetup>({
    week1: {
      name: '第一套',
      doubleCard: 'A',  // 需要2张
      singleCards: ['B', 'C'],  // 各需要1张
    },
    week2: {
      name: '第二套',
      doubleCard: 'C',  // 需要2张
      singleCards: ['D', 'E'],  // 各需要1张
    },
  });

  // 模拟状态
  const [isCalculating, setIsCalculating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<StateResult[]>([]);
  const [bestState, setBestState] = useState<StateResult | null>(null);

  // 更新组合
  const updateCombination = useCallback((week: 'week1' | 'week2', updates: Partial<Combination>) => {
    setSetup(prev => ({
      ...prev,
      [week]: { ...prev[week], ...updates },
    }));
  }, []);

  // 运行模拟
  const runSimulation = useCallback(() => {
    setIsCalculating(true);
    setProgress(0);
    setResults([]);
    setBestState(null);

    // 使用setTimeout模拟异步
    setTimeout(() => {
      const result = runFullSimulation(setup, 4.0, 10000);
      setResults(result.stateResults);
      setBestState(result.bestState);
      setProgress(100);
      setIsCalculating(false);
    }, 100);
  }, [setup]);

  // 结果表格列
  const resultColumns = [
    {
      title: '背包状态',
      dataIndex: 'label',
      key: 'label',
    },
    {
      title: '全收集率（核心）',
      dataIndex: 'fullCollectionRate',
      key: 'fullCollectionRate',
      render: (rate: number) => (
        <span style={{ fontSize: 18, fontWeight: 'bold', color: rate > 50 ? '#52c41a' : '#fa8c16' }}>
          {rate.toFixed(2)}%
        </span>
      ),
    },
    {
      title: '第一套中奖率',
      dataIndex: 'week1Rate',
      key: 'week1Rate',
      render: (rate: number) => (
        <span style={{ color: Math.abs(rate - 4) < 1 ? '#52c41a' : '#f5222d' }}>
          {rate.toFixed(2)}%
        </span>
      ),
    },
    {
      title: '第二套中奖率',
      dataIndex: 'week2Rate',
      key: 'week2Rate',
      render: (rate: number) => (
        <span style={{ color: Math.abs(rate - 4) < 1 ? '#52c41a' : '#f5222d' }}>
          {rate.toFixed(2)}%
        </span>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px', maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>🎴 神奇物种概率测算系统</Title>
        <Text type="secondary">
          配置两套组合（每套3张卡），系统自动计算降权系数，控制中奖率≈4%，最大化全收集率
        </Text>
      </div>

      {/* 卡片说明 */}
      <AntCard title="卡片说明（A-J）" style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]}>
          {Object.entries(CARD_INFO).map(([id, info]) => (
            <Col key={id} xs={12} sm={8} md={6} lg={4}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    backgroundColor: info.color,
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                  }}
                >
                  {id}
                </div>
                <div>
                  <Text strong>{info.name}</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {info.rarity === 'MAGIC' ? '神奇' : info.rarity === 'RARE' ? '稀有' : '普通'}
                  </Text>
                </div>
              </div>
            </Col>
          ))}
        </Row>
      </AntCard>

      <Row gutter={[24, 24]}>
        {/* 左侧：组合配置 */}
        <Col xs={24} lg={14}>
          <AntCard title="组合配置（每套3张卡）" bordered={false}>
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              {(['week1', 'week2'] as const).map((week, weekIdx) => {
                const combo = setup[week];
                const weekName = week === 'week1' ? '第一套（第1-7天）' : '第二套（第1-14天）';

                return (
                  <div key={week} style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 16 }}>
                    <Title level={5} style={{ marginBottom: 16 }}>{weekName}</Title>

                    <div style={{ marginBottom: 16 }}>
                      <Text strong>需要2张的卡：</Text>
                      <Space wrap style={{ marginLeft: 8 }}>
                        {Object.keys(CARD_INFO).map(cardId => (
                          <Button
                            key={cardId}
                            size="small"
                            type={combo.doubleCard === cardId ? 'primary' : 'default'}
                            onClick={() => updateCombination(week, { doubleCard: cardId })}
                            style={{
                              backgroundColor: combo.doubleCard === cardId ? CARD_INFO[cardId].color : undefined,
                            }}
                          >
                            {cardId}
                          </Button>
                        ))}
                      </Space>
                    </div>

                    <div>
                      <Text strong>需要各1张的卡：</Text>
                      <div style={{ marginTop: 8 }}>
                        {combo.singleCards.map((cardId, idx) => (
                          <Space key={idx} style={{ marginRight: 16, marginBottom: 8 }}>
                            <Text>卡{idx + 1}:</Text>
                            <select
                              value={cardId}
                              onChange={(e) => {
                                const newCards = [...combo.singleCards];
                                newCards[idx] = e.target.value;
                                updateCombination(week, { singleCards: newCards as [string, string] });
                              }}
                              style={{ padding: '4px 8px' }}
                            >
                              {Object.keys(CARD_INFO).map(id => (
                                <option key={id} value={id}>{id}</option>
                              ))}
                            </select>
                          </Space>
                        ))}
                      </div>
                    </div>

                    <div style={{ marginTop: 16, padding: 12, backgroundColor: '#f6ffed', borderRadius: 4 }}>
                      <Text>当前配置：</Text>
                      <Text strong style={{ color: '#52c41a' }}>
                        {combo.doubleCard}×2 + {combo.singleCards[0]}×1 + {combo.singleCards[1]}×1
                      </Text>
                    </div>
                  </div>
                );
              })}
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
                <Text type="secondary">正在计算5种背包状态...</Text>
              </div>
            )}

            {results.length > 0 && !isCalculating && (
              <div>
                <Alert
                  message="测算完成"
                  description="所有背包状态的降权系数已自动计算，控制中奖率≈4%"
                  type="success"
                  showIcon
                  style={{ marginBottom: 16 }}
                />

                {bestState && (
                  <AntCard size="small" style={{ marginBottom: 16, backgroundColor: '#f6ffed' }}>
                    <div style={{ textAlign: 'center' }}>
                      <Text type="secondary">最佳背包状态</Text>
                      <div style={{ fontSize: 24, fontWeight: 'bold', color: '#52c41a' }}>
                        {bestState.label}
                      </div>
                      <Text type="secondary">14天全收集率</Text>
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

                {/* 降权系数详情 */}
                <div style={{ marginTop: 16 }}>
                  <Text strong>降权系数示例（{results[0]?.label}）：</Text>
                  <div style={{ marginTop: 8 }}>
                    {Object.entries(results[0]?.coefficients || {}).slice(0, 5).map(([card, coeff]) => (
                      <Tag key={card} style={{ margin: '0 4px 4px 0' }}>
                        {card}: {coeff.count1.toFixed(3)}
                      </Tag>
                    ))}
                    <Text type="secondary">...</Text>
                  </div>
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
