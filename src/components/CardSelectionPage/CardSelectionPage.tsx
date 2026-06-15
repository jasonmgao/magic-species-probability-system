/**
 * 卡面选择页 - 主页面（修正版）
 *
 * 正确理解：
 * 1. 集齐率 = 14天内10张卡每张都≥1张的概率（全收集）
 * 2. 中奖率：
 *    - 第一套中奖率 = 7天内获得 A×2 + B×1 的概率（目标控制在4%以内）
 *    - 第二套中奖率 = 14天内获得 C×2 + D×1 的概率（目标控制在4%以内）
 */

import { useState, useCallback } from 'react';
import { Layout, Row, Col, Card as AntCard, Button, Space, Typography, message, Progress, Statistic, Tag, Alert } from 'antd';
import { CalculatorOutlined, SettingOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import type { CardRarityConfig, Rarity } from '@/types';
import { RARITY_CONFIG } from '@/constants';
import { runSimulationInChunks, type CardSetup, type SimulationResult } from '@/services/simulationEngine';

const { Content } = Layout;
const { Title, Text } = Typography;

interface CardSelectionPageProps {
  onNavigateToConfig?: () => void;
}

// 4张组合卡的配置
const COMBO_CARDS = ['A', 'B', 'C', 'D'] as const;

export function CardSelectionPage({ onNavigateToConfig }: CardSelectionPageProps) {
  // 4张卡的稀有度配置
  const [cardSetup, setCardSetup] = useState<CardSetup>({
    A: { id: 'A', rarity: 'COMMON' },
    B: { id: 'B', rarity: 'RARE' },
    C: { id: 'C', rarity: 'COMMON' },
    D: { id: 'D', rarity: 'RARE' },
  });

  // 降权系数
  const [coeffA, setCoeffA] = useState<number>(0.02);
  const [coeffC, setCoeffC] = useState<number>(0.008);

  // 模拟状态
  const [isCalculating, setIsCalculating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<SimulationResult | null>(null);

  // 更新卡片稀有度
  const updateCardRarity = useCallback((cardId: keyof CardSetup, rarity: Rarity) => {
    setCardSetup(prev => ({
      ...prev,
      [cardId]: { ...prev[cardId], rarity },
    }));
  }, []);

  // 运行模拟
  const runSimulation = useCallback(async () => {
    setIsCalculating(true);
    setProgress(0);

    try {
      const simulationResult = await runSimulationInChunks(
        cardSetup,
        { A: coeffA, C: coeffC },
        100000,
        (p) => setProgress(p)
      );

      setResult(simulationResult);
    } catch (error) {
      console.error('Simulation error:', error);
      message.error('模拟运行失败');
    } finally {
      setIsCalculating(false);
    }
  }, [cardSetup, coeffA, coeffC]);

  // 判断费率是否在目标范围内
  const isWeek1Good = result && result.week1SetRate <= 4.0;
  const isWeek2Good = result && result.week2SetRate <= 4.0;

  return (
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>🎴 神奇物种概率测算系统</Title>
        <Text type="secondary">
          评估卡组配置：计算10张全收集概率 + 两套组合中奖率（目标控制在4%以内）
        </Text>
      </div>

      <Row gutter={[24, 24]}>
        {/* 左侧：卡片配置 */}
        <Col xs={24} lg={12}>
          <AntCard title="组合卡配置（A/B/C/D）" bordered={false}>
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              {COMBO_CARDS.map(cardId => {
                const config = cardSetup[cardId];
                const isTargetCard = cardId === 'A' || cardId === 'C';

                return (
                  <div key={cardId} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        backgroundColor: RARITY_CONFIG[config.rarity].color,
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 20,
                        fontWeight: 'bold',
                      }}
                    >
                      {cardId}
                    </div>

                    <div style={{ flex: 1 }}>
                      <Text strong>{cardId} 卡配置</Text>
                      <br />
                      <Text type="secondary">
                        {cardId === 'A' && '需要2张（第2张降权）'}
                        {cardId === 'B' && '需要1张'}
                        {cardId === 'C' && '需要2张（第2张降权）'}
                        {cardId === 'D' && '需要1张'}
                      </Text>
                    </div>

                    <Space>
                      {(['MAGIC', 'RARE', 'COMMON'] as Rarity[]).map(rarity => (
                        <Button
                          key={rarity}
                          type={config.rarity === rarity ? 'primary' : 'default'}
                          size="small"
                          style={{
                            backgroundColor: config.rarity === rarity ? RARITY_CONFIG[rarity].color : undefined,
                          }}
                          onClick={() => updateCardRarity(cardId, rarity)}
                        >
                          {RARITY_CONFIG[rarity].label}
                        </Button>
                      ))}
                    </Space>
                  </div>
                );
              })}
            </Space>
          </AntCard>

          {/* 降权系数配置 */}
          <AntCard title="降权系数配置" style={{ marginTop: 16 }} bordered={false}>
            <Row gutter={16}>
              <Col span={12}>
                <div>
                  <Text strong>A卡第2张系数</Text>
                  <br />
                  <Text type="secondary">第一套7天窗口，系数较高</Text>
                  <div style={{ marginTop: 8 }}>
                    <input
                      type="range"
                      min={0}
                      max={0.1}
                      step={0.001}
                      value={coeffA}
                      onChange={(e) => setCoeffA(parseFloat(e.target.value))}
                      style={{ width: '100%' }}
                    />
                    <div style={{ textAlign: 'center', marginTop: 4 }}>
                      <Tag color="blue">{(coeffA * 100).toFixed(1)}%</Tag>
                    </div>
                  </div>
                </div>
              </Col>
              <Col span={12}>
                <div>
                  <Text strong>C卡第2张系数</Text>
                  <br />
                  <Text type="secondary">第二套14天窗口，系数较低</Text>
                  <div style={{ marginTop: 8 }}>
                    <input
                      type="range"
                      min={0}
                      max={0.05}
                      step={0.0001}
                      value={coeffC}
                      onChange={(e) => setCoeffC(parseFloat(e.target.value))}
                      style={{ width: '100%' }}
                    />
                    <div style={{ textAlign: 'center', marginTop: 4 }}>
                      <Tag color="purple">{(coeffC * 100).toFixed(2)}%</Tag>
                    </div>
                  </div>
                </div>
              </Col>
            </Row>
          </AntCard>
        </Col>

        {/* 右侧：模拟结果 */}
        <Col xs={24} lg={12}>
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
                {isCalculating ? '计算中...' : '开始测算（10万次模拟）'}
              </Button>

              {isCalculating && (
                <div>
                  <Progress percent={Math.round(progress * 100)} status="active" />
                  <Text type="secondary">正在运行蒙特卡洛模拟...</Text>
                </div>
              )}

              {result && !isCalculating && (
                <div>
                  <Alert
                    message="测算完成"
                    description={
                      <div>
                        <p><strong>集齐率（10张全收集）：</strong>{result.fullCollectionRate.toFixed(2)}%</p>
                        <p>第一套中奖率（7天AaB）：{result.week1SetRate.toFixed(3)}% {isWeek1Good ? '✅ 符合目标' : '❌ 超出目标'}</p>
                        <p>第二套中奖率（14天CcD）：{result.week2SetRate.toFixed(3)}% {isWeek2Good ? '✅ 符合目标' : '❌ 超出目标'}</p>
                      </div>
                    }
                    type={isWeek1Good && isWeek2Good ? 'success' : 'warning'}
                    showIcon
                    style={{ marginBottom: 16 }}
                  />

                  {/* 集齐率 */}
                  <AntCard size="small" style={{ marginBottom: 16, backgroundColor: '#f6ffed', borderColor: '#b7eb8f' }}>
                    <Statistic
                      title="集齐率（10张全收集 ≥1张）"
                      value={result.fullCollectionRate}
                      precision={2}
                      suffix="%"
                      valueStyle={{ color: result.fullCollectionRate > 50 ? '#52c41a' : '#faad14' }}
                    />
                    <Text type="secondary">14天内所有卡片都获得至少1张的概率</Text>
                  </AntCard>

                  {/* 第一套中奖率 */}
                  <AntCard size="small" style={{ marginBottom: 16, borderColor: isWeek1Good ? '#b7eb8f' : '#ffbb96' }}>
                    <Statistic
                      title="第一套中奖率（7天内 A×2 + B×1）"
                      value={result.week1SetRate}
                      precision={3}
                      suffix="%"
                      valueStyle={{ color: isWeek1Good ? '#52c41a' : '#f5222d' }}
                    />
                    <Space>
                      <Text type="secondary">目标：≤ 4%</Text>
                      {isWeek1Good ? (
                        <Tag color="success" icon={<CheckCircleOutlined />}>符合</Tag>
                      ) : (
                        <Tag color="error" icon={<CloseCircleOutlined />}>超出</Tag>
                      )}
                    </Space>
                  </AntCard>

                  {/* 第二套中奖率 */}
                  <AntCard size="small" style={{ borderColor: isWeek2Good ? '#b7eb8f' : '#ffbb96' }}>
                    <Statistic
                      title="第二套中奖率（14天内 C×2 + D×1）"
                      value={result.week2SetRate}
                      precision={3}
                      suffix="%"
                      valueStyle={{ color: isWeek2Good ? '#52c41a' : '#f5222d' }}
                    />
                    <Space>
                      <Text type="secondary">目标：≤ 4%</Text>
                      {isWeek2Good ? (
                        <Tag color="success" icon={<CheckCircleOutlined />}>符合</Tag>
                      ) : (
                        <Tag color="error" icon={<CloseCircleOutlined />}>超出</Tag>
                      )}
                    </Space>
                  </AntCard>

                  <Text type="secondary" style={{ display: 'block', marginTop: 16 }}>
                    平均获得不同卡片数：{result.avgUniqueCards.toFixed(2)} 张
                  </Text>
                </div>
              )}
            </Space>
          </AntCard>
        </Col>
      </Row>

      {/* 底部导航 */}
      <div style={{ marginTop: 24, textAlign: 'center' }}>
        <Button
          type="default"
          size="large"
          icon={<SettingOutlined />}
          onClick={onNavigateToConfig}
        >
          前往概率配置页
        </Button>
      </div>
    </div>
  );
}
