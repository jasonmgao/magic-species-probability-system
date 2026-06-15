/**
 * 卡面选择页（修正版）
 *
 * 正确逻辑：
 * 1. 自由选择A/B/C/D四张卡及其稀有度
 * 2. 系统自动计算降权系数，确保中奖率≈4%
 * 3. 只显示一个核心指标：14天10张全收集率
 */

import { useState, useCallback, useEffect } from 'react';
import { Row, Col, Card as AntCard, Button, Space, Typography, message, Progress, Tag, Radio, Alert } from 'antd';
import { CalculatorOutlined, SettingOutlined } from '@ant-design/icons';
import type { CardRarityConfig, Rarity } from '@/types';
import { BASE_CARDS, RARITY_CONFIG } from '@/constants';
import { runSimulationInChunks, findOptimalCoefficients, type CardSetup, type SimulationResult } from '@/services/simulationEngine';

const { Title, Text } = Typography;

interface CardSelectionPageProps {
  onNavigateToConfig?: () => void;
}

// 10张卡
const ALL_CARDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

// 背包状态
const BACKPACK_STATES = [
  { key: 'empty', label: '全新用户（0张）'},
  { key: 'need3', label: '缺3张（A×0, B×0）' },
  { key: 'need2', label: '缺2张（A×1, B×0）' },
  { key: 'need1', label: '缺1张（A×1, B×1）' },
  { key: 'complete', label: '第一套完成' },
] as const;

export function CardSelectionPage({ onNavigateToConfig }: CardSelectionPageProps) {
  // 四张组合卡的配置（自由选择）
  const [cardSetup, setCardSetup] = useState<CardSetup>({
    A: { id: 'A', rarity: 'COMMON' },
    B: { id: 'B', rarity: 'RARE' },
    C: { id: 'C', rarity: 'COMMON' },
    D: { id: 'D', rarity: 'RARE' },
  });

  // 背包状态
  const [backpackState, setBackpackState] = useState<string>('empty');

  // 模拟状态
  const [isCalculating, setIsCalculating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<SimulationResult | null>(null);

  // 更新卡片选择
  const updateCard = useCallback((position: keyof CardSetup, cardId: string) => {
    setCardSetup(prev => ({
      ...prev,
      [position]: { ...prev[position], id: cardId },
    }));
  }, []);

  // 更新卡片稀有度
  const updateRarity = useCallback((position: keyof CardSetup, rarity: Rarity) => {
    setCardSetup(prev => ({
      ...prev,
      [position]: { ...prev[position], rarity },
    }));
  }, []);

  // 运行模拟
  const runSimulation = useCallback(async () => {
    setIsCalculating(true);
    setProgress(0);
    setResult(null);

    try {
      // 第一步：寻找最优降权系数（使中奖率≈4%）
      const { coeffA, coeffC } = findOptimalCoefficients(cardSetup, 4.0, 10000);

      // 第二步：用最优系数运行完整模拟
      const simulationResult = await runSimulationInChunks(
        cardSetup,
        coeffA,
        coeffC,
        100000,
        (p: number) => setProgress(p * 0.5 + 0.5) // 后半段进度
      );

      setResult(simulationResult);
    } catch (error) {
      console.error('Simulation error:', error);
      message.error('模拟运行失败');
    } finally {
      setIsCalculating(false);
    }
  }, [cardSetup]);

  return (
    <div style={{ padding: '24px', maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>🎴 神奇 species 概率测算系统</Title>
        <Text type="secondary">
          配置4张组合卡，系统自动计算降权系数（控制中奖率≈4%），最大化14天全收集率
        </Text>
      </div>

      <Row gutter={[24, 24]}>
        {/* 左侧：卡片配置 */}
        <Col xs={24} lg={14}>
          <AntCard title="组合卡配置（从10张卡中自由选择）" bordered={false}>
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              {(['A', 'B', 'C', 'D'] as const).map((position, idx) => {
                const config = cardSetup[position];
                const description = [
                  'A: 第一套第1张，需要2张',
                  'B: 第一套第2张，需要1张',
                  'C: 第二套第1张，需要2张',
                  'D: 第二套第2张，需要1张',
                ][idx];

                return (
                  <div key={position} style={{ borderBottom: '1px solid #f0f0f0', paddingBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: '50%',
                          backgroundColor: RARITY_CONFIG[config.rarity].color,
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 18,
                          fontWeight: 'bold',
                        }}
                      >
                        {position}
                      </div>
                      <div>
                        <Text strong>{position} 卡</Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: 12 }}>{description}</Text>
                      </div>
                    </div>

                    {/* 卡片选择 */}
                    <div style={{ marginBottom: 8 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>选择卡片：</Text>
                      <Space wrap style={{ marginTop: 4 }}>
                        {ALL_CARDS.map(cardId => {
                          const isSelected = cardSetup[position].id === cardId;
                          const isUsedElsewhere = Object.entries(cardSetup)
                            .some(([pos, cfg]) => pos !== position && cfg.id === cardId);

                          return (
                            <Button
                              key={cardId}
                              size="small"
                              type={isSelected ? 'primary' : 'default'}
                              disabled={isUsedElsewhere}
                              onClick={() => updateCard(position, cardId)}
                              style={{
                                width: 36,
                                padding: 0,
                                backgroundColor: isSelected ? RARITY_CONFIG[config.rarity].color : undefined,
                              }}
                            >
                              {cardId}
                            </Button>
                          );
                        })}
                      </Space>
                    </div>

                    {/* 稀有度选择 */}
                    <div>
                      <Text type="secondary" style={{ fontSize: 12 }}>稀有度：</Text>
                      <Space style={{ marginTop: 4 }}>
                        {(['MAGIC', 'RARE', 'COMMON'] as Rarity[]).map(rarity => (
                          <Button
                            key={rarity}
                            size="small"
                            type={config.rarity === rarity ? 'primary' : 'default'}
                            onClick={() => updateRarity(position, rarity)}
                            style={{
                              backgroundColor: config.rarity === rarity ? RARITY_CONFIG[rarity].color : undefined,
                            }}
                          >
                            {RARITY_CONFIG[rarity].label}
                          </Button>
                        ))}
                      </Space>
                    </div>
                  </div>
                );
              })}
            </Space>
          </AntCard>

          {/* 背包状态 */}
          <AntCard title="背包状态（用于计算降权系数）" style={{ marginTop: 16 }} bordered={false}>
            <Radio.Group value={backpackState} onChange={(e) => setBackpackState(e.target.value)}>
              <Space direction="vertical">
                {BACKPACK_STATES.map(state => (
                  <Radio key={state.key} value={state.key}>{state.label}</Radio>
                ))}
              </Space>
            </Radio.Group>
          </AntCard>
        </Col>

        {/* 右侧：模拟结果 */}
        <Col xs={24} lg={10}>
          <AntCard title="概率测算" bordered={false}>
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <Button
                type="primary"
                size="large"
                icon={<CalculatorOutlined />}
                onClick={runSimulation}
                disabled={isCalculating}
                block
              >
                {isCalculating ? '计算中...' : '开始测算'}
              </Button>

              {isCalculating && (
                <div>
                  <Progress percent={Math.round(progress * 100)} status="active" />
                  <Text type="secondary">正在寻找最优降权系数并模拟...</Text>
                </div>
              )}

              {result && !isCalculating && (
                <div>
                  {/* 核心指标：全收集率 */}
                  <AntCard
                    size="small"
                    style={{
                      backgroundColor: result.fullCollectionRate > 50 ? '#f6ffed' : '#fff7e6',
                      borderColor: result.fullCollectionRate > 50 ? '#b7eb8f' : '#ffd591',
                      marginBottom: 16,
                    }}
                  >
                    <div style={{ textAlign: 'center' }}>
                      <Text type="secondary">核心指标：14天10张全收集率</Text>
                      <div style={{ fontSize: 48, fontWeight: 'bold', color: result.fullCollectionRate > 50 ? '#52c41a' : '#fa8c16' }}>
                        {result.fullCollectionRate.toFixed(2)}%
                      </div>
                      <Text type="secondary">目标：最大化此数值</Text>
                    </div>
                  </AntCard>

                  {/* 验证指标：中奖率应该≈4% */}
                  <Alert
                    message="降权系数自动计算结果"
                    description={
                      <div>
                        <p>为使中奖率接近4%，系统计算的降权系数：</p>
                        <p>A卡第2张系数：<Tag color="blue">{(result.coeffA * 100).toFixed(2)}%</Tag></p>
                        <p>C卡第2张系数：<Tag color="purple">{(result.coeffC * 100).toFixed(2)}%</Tag></p>
                        <p style={{ marginTop: 8, borderTop: '1px solid #d9d9d9', paddingTop: 8 }}>
                          验证 - 第一套中奖率：{result.week1SetRate.toFixed(2)}%<br/>
                          验证 - 第二套中奖率：{result.week2SetRate.toFixed(2)}%
                        </p>
                      </div>
                    }
                    type="info"
                    showIcon
                  />

                  {/* 推荐等级 */}
                  <div style={{ textAlign: 'center', marginTop: 16 }}>
                    {result.fullCollectionRate >= 60 ? (
                      <Tag color="success" style={{ fontSize: 18, padding: '8px 16px' }}>🌟 推荐配置</Tag>
                    ) : result.fullCollectionRate >= 40 ? (
                      <Tag color="warning" style={{ fontSize: 18, padding: '8px 16px' }}>⚠️ 可接受</Tag>
                    ) : (
                      <Tag color="error" style={{ fontSize: 18, padding: '8px 16px' }}>❌ 不推荐</Tag>
                    )}
                  </div>
                </div>
              )}
            </Space>
          </AntCard>
        </Col>
      </Row>

      {/* 底部导航 */}
      <div style={{ marginTop: 24, textAlign: 'center' }}>
        <Button type="default" size="large" icon={<SettingOutlined />} onClick={onNavigateToConfig}>
          概率配置详情
        </Button>
      </div>
    </div>
  );
}
