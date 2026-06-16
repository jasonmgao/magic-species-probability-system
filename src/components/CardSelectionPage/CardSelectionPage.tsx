/**
 * 🎴 卡面选择页（V6 - 强制基础卡版）
 * 每个卡组必须有一个基础卡（固定x2），可选扩展卡（可变数量）
 */

import { useState, useCallback } from 'react';
import {
  Row, Col, Card as AntCard, Button, Space, Typography,
  message, Progress, Table, Tag, Select, Divider, Alert, Tabs, InputNumber,
} from 'antd';
import {
  CalculatorOutlined, PlusOutlined, DeleteOutlined, CheckCircleOutlined,
  TrophyOutlined, QuestionCircleOutlined, TableOutlined, GiftOutlined,
  StarOutlined, ThunderboltOutlined,
} from '@ant-design/icons';
import type { CardSetup, WeeklyCombo, CoefficientResult, SolverProgress, CardCoefficients } from '@/types';
import {
  runSimulation,
  ALL_CARDS,
  generateCases,
  generateProbabilityTables,
  getCardType,
  getBaseProb,
} from '@/services/simulationEngine';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;

const CARD_COLORS: Record<string, string> = {
  'A': '#722ed1',
  'B': '#1890ff', 'C': '#1890ff', 'D': '#1890ff', 'E': '#1890ff',
  'F': '#52c41a', 'G': '#52c41a', 'H': '#52c41a', 'I': '#52c41a', 'J': '#52c41a',
};

// V6默认配置：AAB和AAA
const DEFAULT_SETUP: CardSetup = {
  week1: {
    name: '第一周',
    cards: ['A', 'A', 'B'], // AAB: 基础卡A(x2) + 扩展卡B(x1)
    deadline: 7,
  },
  week2: {
    name: '第二周',
    cards: ['C', 'C', 'C'], // CCC: 基础卡C(x2) + 扩展卡C(x1)
    deadline: 14,
  },
  dailyDraws: 4,
  // V6新增：基础卡（每张都是基础卡，最终合并成总数）
  baseCards: {
    week1: 'A', // 基础卡A固定x2
    week2: 'C', // 基础卡C固定x2
  },
};

const MIN_X1_CARD = 1;   // 至少1张x1的卡（加上基础卡x2 = 最小3张）
const MAX_EXTRA_CARDS = 3; // 最多3张扩展卡，加上基础卡x2 = 最大5张
const MIN_DAILY_DRAWS = 1;
const MAX_DAILY_DRAWS = 10;

interface CardSelectionPageProps {
  onNavigateToConfig?: () => void;
}

// 从cards数组推导出基础卡和扩展卡列表
function parseCards(cards: string[], baseCard: string): { baseCount: number; extras: { card: string; count: number; index: number }[] } {
  // 统计卡组中各卡数量
  const counts = new Map<string, number>();
  cards.forEach(c => counts.set(c, (counts.get(c) || 0) + 1));

  // 基础卡及其数量
  const baseCount = counts.get(baseCard) || 0; // 应该 ≥ 2
  counts.delete(baseCard);

  // 剩余的作为扩展卡（展示为x1, x2等）
  const extras: { card: string; count: number; index: number }[] = [];
  let idx = 0;
  for (const [card, count] of counts.entries()) {
    extras.push({ card, count, index: idx++ });
  }

  return { baseCount, extras };
}

// 根据基础卡和扩展卡列表重建cards数组
function buildCards(baseCard: string, baseCount: number, extras: { card: string; count: number }[]): string[] {
  const cards: string[] = [];
  for (let i = 0; i < baseCount; i++) cards.push(baseCard);
  for (const extra of extras) {
    for (let i = 0; i < extra.count; i++) cards.push(extra.card);
  }
  return cards;
}

export function CardSelectionPage({ onNavigateToConfig }: CardSelectionPageProps) {
  const [setup, setSetup] = useState<CardSetup>(DEFAULT_SETUP);
  const [isCalculating, setIsCalculating] = useState(false);
  const [progress, setProgress] = useState<SolverProgress | null>(null);
  const [result, setResult] = useState<CoefficientResult | null>(null);
  const [activeTab, setActiveTab] = useState('week1');

  // V6: 设置基础卡
  const setBaseCard = useCallback((week: 'week1' | 'week2', newBase: string) => {
    setSetup(prev => {
      const prevCards = prev[week].cards;
      const newDailyDraws = prev.dailyDraws ?? 4;
      const existingBase = prev.baseCards ?? { week1: prev.week1.cards[0], week2: prev.week2.cards[0] };
      const newBaseCards: { week1: string; week2: string } = { ...existingBase, [week]: newBase };

      // 提取原先的非基础卡部分作为扩展卡
      const prevBase = prev.baseCards?.[week] || prev[week].cards[0];
      const extras: { card: string; count: number }[] = [];
      const unusedCards: string[] = [];

      for (const c of prevCards) {
        if (c !== prevBase) unusedCards.push(c);
        else if (c === newBase) unusedCards.push(c);
      }

      // 统计未分配卡
      const countMap = new Map<string, number>();
      unusedCards.forEach(c => countMap.set(c, (countMap.get(c) || 0) + 1));

      // 构建新cards数组：新基础卡x2 + 扩展卡
      const newCards: string[] = [newBase, newBase];
      for (const [card, count] of countMap) {
        if (card !== newBase) {
          extras.push({ card, count });
          for (let i = 0; i < count; i++) newCards.push(card);
        }
      }

      return {
        ...prev,
        [week]: { ...prev[week], cards: newCards },
        baseCards: newBaseCards,
        dailyDraws: newDailyDraws,
      };
    });
    if (result) setResult(null);
  }, [result]);

  // 添加扩展卡
  const addExtraCard = useCallback((week: 'week1' | 'week2') => {
    setSetup(prev => {
      const current = prev[week].cards;
      const baseCard = prev.baseCards?.[week] || current[0];
      if (current.length >= MAX_EXTRA_CARDS + 2) {
        message.warning(`每周最多 ${MAX_EXTRA_CARDS + 2} 张卡（基础x2 + 扩展${MAX_EXTRA_CARDS}）`);
        return prev;
      }
      // 默认添加一张x1的A卡（或B卡）
      const defaultExtra = baseCard === 'A' ? 'B' : 'A';
      return {
        ...prev,
        [week]: { ...prev[week], cards: [...current, defaultExtra] },
      };
    });
    if (result) setResult(null);
  }, [result]);

  // 删除扩展卡（不能删除基础卡部分的x2）
  const removeExtraCard = useCallback((week: 'week1' | 'week2', cardIndex: number) => {
    setSetup(prev => {
      const current = prev[week].cards;
      const baseCard = prev.baseCards?.[week] || current[0];

      // 计算扩展卡部分（从索引2开始是扩展卡）
      const nonBaseCount = current.filter(c => c !== baseCard).length;
      const baseCount = current.length - nonBaseCount;

      // 必须保留基础卡的x2（baseCount >= 2）
      // 并且至少要有1张卡（基础x2 + 至少1张）
      if (current.length <= 3) {
        message.warning('需要至少1张扩展卡（基础x2 + 扩展x1 = 3张）');
        return prev;
      }

      // 找到要删除的实例（去掉基础卡的2张后）
      let extIdx = 0;
      let foundIndex = -1;
      for (let i = 0; i < current.length; i++) {
        if (current[i] === baseCard && baseCount > 0) {
          // 跳过前两张基础卡
          continue;
        }
        if (extIdx === cardIndex) {
          foundIndex = i;
          break;
        }
        extIdx++;
      }

      if (foundIndex === -1) return prev;

      return {
        ...prev,
        [week]: { ...prev[week], cards: current.filter((_, i) => i !== foundIndex) },
      };
    });
    if (result) setResult(null);
  }, [result]);

  // 更新扩展卡类型
  const updateExtraCard = useCallback((week: 'week1' | 'week2', cardIndex: number, newCard: string) => {
    setSetup(prev => {
      const current = [...prev[week].cards];
      const baseCard = prev.baseCards?.[week] || current[0];

      // 找到第cardIndex个非基础卡
      let extIdx = 0;
      for (let i = 0; i < current.length; i++) {
        if (current[i] === baseCard) continue;
        if (extIdx === cardIndex) {
          current[i] = newCard;
          break;
        }
        extIdx++;
      }

      return {
        ...prev,
        [week]: { ...prev[week], cards: current },
      };
    });
    if (result) setResult(null);
  }, [result]);

  // 增加扩展卡数量（同一卡变x2,x3...）
  const increaseExtraCount = useCallback((week: 'week1' | 'week2', cardIndex: number) => {
    setSetup(prev => {
      const current = [...prev[week].cards];
      const baseCard = prev.baseCards?.[week] || current[0];

      if (current.length >= MAX_EXTRA_CARDS + 2) {
        message.warning(`已达到最大卡数 ${MAX_EXTRA_CARDS + 2}`);
        return prev;
      }

      // 找到第cardIndex个非基础卡
      let extIdx = 0;
      for (let i = 0; i < current.length; i++) {
        if (current[i] === baseCard) continue;
        if (extIdx === cardIndex) {
          // 在该位置后插入同一张卡
          current.splice(i + 1, 0, current[i]);
          break;
        }
        extIdx++;
      }

      return {
        ...prev,
        [week]: { ...prev[week], cards: current },
      };
    });
    if (result) setResult(null);
  }, [result]);

  // 减少扩展卡数量
  const decreaseExtraCount = useCallback((week: 'week1' | 'week2', cardIndex: number) => {
    setSetup(prev => {
      const current = [...prev[week].cards];
      const baseCard = prev.baseCards?.[week] || current[0];

      // 计算当前扩展卡数量
      const extCount = current.filter(c => c !== baseCard).length;
      if (extCount <= 1) {
        message.warning('至少保留1张扩展卡');
        return prev;
      }

      // 找到第cardIndex个非基础卡
      let extIdx = 0;
      for (let i = 0; i < current.length; i++) {
        if (current[i] === baseCard) continue;
        if (extIdx === cardIndex) {
          // 删除一个该卡的实例
          current.splice(i, 1);
          break;
        }
        extIdx++;
      }

      return {
        ...prev,
        [week]: { ...prev[week], cards: current },
      };
    });
    if (result) setResult(null);
  }, [result]);

  const updateDailyDraws = useCallback((draws: number) => {
    setSetup(prev => ({ ...prev, dailyDraws: draws }));
    if (result) setResult(null);
  }, [result]);

  const runSolve = useCallback(async () => {
    const total1 = setup.week1.cards.length;
    const total2 = setup.week2.cards.length;

    if (total1 < 3 || total1 > 5 || total2 < 3 || total2 > 5) {
      message.error('每周需要 3-5 张卡');
      return;
    }

    setIsCalculating(true);
    setProgress(null);
    setResult(null);

    try {
      const coefficientResult = await runSimulation(setup, (p: SolverProgress) => {
        setProgress(p);
      });
      setResult(coefficientResult);
      const error1 = Math.abs(coefficientResult.actualRates.week1 - 4.0);
      const error2 = Math.abs(coefficientResult.actualRates.week2 - 4.0);
      if (coefficientResult.converged && error1 < 0.3 && error2 < 0.3) {
        message.success(`求解成功！两周集齐率均接近 4%`);
      } else {
        message.warning(`结果已生成（误差：${Math.max(error1, error2).toFixed(2)}%）`);
      }
    } catch (error) {
      message.error('求解失败: ' + String(error));
    } finally {
      setIsCalculating(false);
    }
  }, [setup]);

  const probTables = result ? generateProbabilityTables(setup, result) : null;
  const cases = result ? generateCases(setup, result) : [];

  const getCardLabel = (card: string, index: number, isBase = false) => (
    <Tag
      key={index}
      color={CARD_COLORS[card]}
      style={{ margin: 2, fontSize: 14, fontWeight: isBase ? 'bold' : 'normal' }}
    >
      {card}{isBase && <StarOutlined style={{ marginLeft: 2, fontSize: 10 }} />}
    </Tag>
  );

  const renderWeekConfig = (weekKey: 'week1' | 'week2', weekData: WeeklyCombo, color: string) => {
    const baseCard = setup.baseCards?.[weekKey] || weekData.cards[0];
    const { baseCount, extras } = parseCards(weekData.cards, baseCard);
    const totalCards = weekData.cards.length;
    // V6系数数量 = 需要降权的卡数量 = 超过第一张的卡数
    const needsCards = buildNeedsMap(weekData.cards);
    const needReductionCount = Array.from(needsCards.values()).reduce((sum, need) => sum + Math.max(0, need - 1), 0);

    return (
      <div style={{ border: `2px solid ${color}`, borderRadius: 12, padding: 16, backgroundColor: `${color}10` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <Space>
            <Text strong style={{ color, fontSize: 16 }}>{weekData.name}</Text>
            <Tag color={color}>第 {weekData.deadline} 天截止</Tag>
          </Space>
          <Text type="secondary">{totalCards} 张卡</Text>
        </div>

        {/* 基础卡选择（强制x2） */}
        <div style={{ marginBottom: 12, padding: 8, background: '#fff', borderRadius: 6 }}>
          <Space>
            <ThunderboltOutlined style={{ color: '#fa8c16' }} />
            <Text strong>基础卡</Text>
            <Tag color="orange">固定x2</Tag>
            <Select value={baseCard} onChange={(v) => setBaseCard(weekKey, v)} style={{ width: 70 }} size="small">
              {ALL_CARDS.map(c => (
                <Option key={c} value={c}>
                  <Tag color={c === 'A' ? 'purple' : ['B','C','D','E'].includes(c) ? 'blue' : 'green'}>{c}</Tag>
                </Option>
              ))}
            </Select>
            <Tag color={color}>{getCardLabel(baseCard, 0, true)} x{baseCount}</Tag>
          </Space>
          <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>必须至少2张，降权从第三张起生效</Text>
        </div>

        {/* 扩展卡 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {extras.length > 0 ? extras.map((extra, idx) => {
            // 计算该扩展卡的实际数量
            const cardCount = weekData.cards.filter(c => c === extra.card).filter(c => c !== baseCard).length;
            const filterBase = extra.card === baseCard;
            const actualCount = filterBase
              ? Math.max(0, cardCount) // 如果和基础卡相同，计算多出的部分
              : cardCount;

            return (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', background: '#fff', borderRadius: 6, border: `1px solid ${CARD_COLORS[extra.card]}` }}>
                <Select value={extra.card} onChange={(v) => updateExtraCard(weekKey, idx, v)} style={{ width: 60 }} size="small" bordered={false}>
                  {ALL_CARDS.map(c => (
                    <Option key={c} value={c}>
                      <Tag color={c === 'A' ? 'purple' : ['B','C','D','E'].includes(c) ? 'blue' : 'green'}>{c}</Tag>
                    </Option>
                  ))}
                </Select>
                <Space size={4}>
                  <Button type="text" size="small" onClick={() => decreaseExtraCount(weekKey, idx)} disabled={actualCount <= 1}>−</Button>
                  <Text>x{actualCount}</Text>
                  <Button type="text" size="small" onClick={() => increaseExtraCount(weekKey, idx)} disabled={totalCards >= 5}>+</Button>
                </Space>
                <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeExtraCard(weekKey, idx)}>删除</Button>
              </div>
            );
          }) : <Text type="secondary" style={{ fontSize: 13, color: '#888' }}>无扩展卡</Text>}
        </div>

        {/* 添加按钮 */}
        {totalCards < 5 && (
          <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={() => addExtraCard(weekKey)} style={{ marginTop: 8 }}>
            添加扩展卡
          </Button>
        )}

        <Divider style={{ margin: '12px 0' }} />

        {/* 卡牌需求统计 */}
        <div style={{ fontSize: 13, color: '#666' }}>
          <Text strong>卡组构成：</Text>
          {Array.from(needsCards.entries()).map(([card, n], i, arr) => (
            <span key={card}>
              {card}×{n} (降权{n > 1 ? `从第2张起共${n-1}张` : '无'})
              {i < arr.length - 1 ? '，' : ''}
            </span>
          ))}
        </div>
        <div style={{ marginTop: 4, fontSize: 12, color: '#888' }}>
          总需求槽位：{totalCards} / 降权槽位：{needReductionCount} (降权从每张卡的第2张起算)
        </div>
      </div>
    );
  };

  const renderCoefficientTable = (title: string, coeffsData: Record<string, CardCoefficients>, color: string, weekCombo: WeeklyCombo) => {
    const needs = buildNeedsMap(weekCombo.cards);
    const dataSource = Object.entries(coeffsData).map(([card, coeffs]) => ({
      key: card,
      card,
      type: getCardType(card) === 'magic' ? '神奇' : getCardType(card) === 'rare' ? '稀有' : '普通',
      demand: needs.get(card) || 0,
      reductionSlots: Math.max(0, (needs.get(card) || 0) - 1), // 需要降权的槽位
      coeffs,
    }));

    return (
      <div style={{ marginBottom: 24 }}>
        <Title level={5} style={{ color }}>{title}</Title>
        <Table
          size="small"
          bordered
          dataSource={dataSource}
          pagination={false}
          columns={[
            { title: '卡牌', dataIndex: 'card', width: 80, render: (v: string) => <Tag color={CARD_COLORS[v]}>{v}</Tag> },
            { title: '类型', dataIndex: 'type', width: 80 },
            { title: '需求数', dataIndex: 'demand', width: 80, align: 'center' },
            { title: '降权槽位', dataIndex: 'reductionSlots', width: 90, align: 'center', render: (v: number) => v > 0 ? <Tag color="warning">{v}个</Tag> : <Tag color="default">無</Tag> },
            {
              title: '降权系数（从第2张起生效）',
              dataIndex: 'coeffs',
              render: (coeffs: number[], record: { demand: number }) => {
                // V6: 只显示实际需要降权的槽位（demand-1个）
                const activetitle = Math.max(0, record.demand - 1);
                return (
                  <Space>
                    <Tag color="success">第1张: 1.0(无降)</Tag>
                    {activetitle > 0 && Array.from({ length: activetitle }).map((_, i) => (
                      <Tag key={i} color={coeffs[i+1] < 0.02 ? 'error' : 'warning'}>
                        第{i+2}张: {coeffs[i+1]?.toFixed(4) || 'N/A'}
                      </Tag>
                    ))}
                  </Space>
                );
              },
            },
          ]}
        />
        <Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: 'block' }}>
          * 降权仅对超过需求第1张的卡生效。例如 AAB 对第二张A生效，AAA 对第二、第三张A生效。
        </Text>
      </div>
    );
  };

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>🎴 神奇物种发卡概率系统 (V6)</Title>
        <Paragraph type="secondary">V6新版：每卡组强制基础卡x2，降权只对超过第1张的卡生效</Paragraph>
      </div>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={10}>
          <AntCard
            title="卡组配置"
            bordered={false}
            extra={
              <Button
                type="primary"
                icon={<CalculatorOutlined />}
                onClick={runSolve}
                loading={isCalculating}
                disabled={isCalculating}
              >
                {isCalculating ? '计算中...' : '开始测算'}
              </Button>
            }
          >
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              {renderWeekConfig('week1', setup.week1, '#52c41a')}
              {renderWeekConfig('week2', setup.week2, '#1890ff')}

              <div style={{ padding: 12, background: '#fff7e6', borderRadius: 8, border: '1px solid #ffa940' }}>
                <Space align="center">
                  <GiftOutlined style={{ color: '#fa8c16', fontSize: 20 }} />
                  <Text>每日抽奖次数</Text>
                  <InputNumber
                    min={MIN_DAILY_DRAWS}
                    max={MAX_DAILY_DRAWS}
                    value={setup.dailyDraws}
                    onChange={(v) => v && updateDailyDraws(v)}
                    addonAfter="次/天"
                    size="small"
                    style={{ width: 100 }}
                  />
                </Space>
                <div style={{ marginTop: 8, fontSize: 13, color: '#888' }}>
                  单周期望抽卡数：{setup.dailyDraws * 7}（第一周） / {setup.dailyDraws * 14}（两周期），
                  V6卡组最少3张卡
                </div>
              </div>

              {isCalculating && progress && (
                <div style={{ padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
                  <Progress
                    percent={Math.round((progress.iteration / progress.totalIterations) * 100)}
                    status="active"
                    strokeColor={{ from: '#52c41a', to: '#1890ff' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                    <Text type="secondary">迭代 {progress.iteration}/{progress.totalIterations}</Text>
                    <Text type="secondary">
                      第一周: {progress.week1Rate.toFixed(1)}% | 第二周: {progress.week2Rate.toFixed(1)}%
                    </Text>
                  </div>
                </div>
              )}
            </Space>
          </AntCard>

          {result && (
            <AntCard style={{ marginTop: 16 }} bordered={false}>
              <Row gutter={16}>
                <Col span={8} style={{ textAlign: 'center' }}>
                  <Text type="secondary">第一周</Text>
                  <div style={{ fontSize: 26, fontWeight: 'bold', color: '#52c41a' }}>
                    {result.actualRates.week1.toFixed(1)}%
                  </div>
                  <div style={{ fontSize: 12, color: '#888' }}>目标4%</div>
                </Col>
                <Col span={8} style={{ textAlign: 'center' }}>
                  <Text type="secondary">第二周</Text>
                  <div style={{ fontSize: 26, fontWeight: 'bold', color: '#1890ff' }}>
                    {result.actualRates.week2.toFixed(1)}%
                  </div>
                  <div style={{ fontSize: 12, color: '#888' }}>目标4%</div>
                </Col>
                <Col span={8} style={{ textAlign: 'center' }}>
                  <Text type="secondary">全收集</Text>
                  <div style={{ fontSize: 26, fontWeight: 'bold', color: '#722ed1' }}>
                    {result.fullCollectionRate.toFixed(1)}%
                  </div>
                  <div style={{ fontSize: 12, color: '#888' }}>14天内</div>
                </Col>
              </Row>
            </AntCard>
          )}
        </Col>

        <Col xs={24} lg={14}>
          {result ? (
            <AntCard bordered={false}>
              <Tabs activeKey={activeTab} onChange={setActiveTab}>
                <TabPane tab={<span><TrophyOutlined /> 第一周系数</span>} key="week1">
                  <Paragraph type="secondary">
                    卡组：{setup.week1.cards.map((c, i) => getCardLabel(c, i, c === (setup.baseCards?.week1 || setup.week1.cards[0])))}
                  </Paragraph>
                  {renderCoefficientTable('第一周降权系数', result.week1, '#52c41a', setup.week1)}
                </TabPane>

                <TabPane tab={<span><TrophyOutlined /> 第二周系数</span>} key="week2">
                  <Paragraph type="secondary">
                    卡组：{setup.week2.cards.map((c, i) => getCardLabel(c, i, c === (setup.baseCards?.week2 || setup.week2.cards[1])))}
                  </Paragraph>
                  {renderCoefficientTable('第二周降权系数', result.week2, '#1890ff', setup.week2)}
                </TabPane>

                <TabPane tab={<span><TableOutlined /> 基础概率</span>} key="base">
                  <Table
                    size="small"
                    bordered
                    pagination={false}
                    dataSource={ALL_CARDS.map(card => ({
                      card,
                      type: getCardType(card) === 'magic' ? '神奇' : getCardType(card) === 'rare' ? '稀有' : '普通',
                      prob: `${getBaseProb(card)}%`,
                    }))}
                    columns={[
                      { title: '卡牌', dataIndex: 'card', render: (v: string) => <Tag color={CARD_COLORS[v]}>{v}</Tag> },
                      { title: '类型', dataIndex: 'type' },
                      { title: '基础概率', dataIndex: 'prob' },
                    ]}
                  />
                </TabPane>

                <TabPane tab={<span><QuestionCircleOutlined /> 案例</span>} key="cases">
                  <Table
                    size="small"
                    dataSource={cases}
                    pagination={false}
                    columns={[
                      { title: '案例', dataIndex: 'name', width: 120 },
                      { title: '状态', dataIndex: 'description' },
                      { title: '预期', dataIndex: 'expectedSuccess' },
                    ]}
                  />
                </TabPane>
              </Tabs>
            </AntCard>
          ) : (
            <AntCard bordered={false} style={{ textAlign: 'center', padding: 80 }}>
              <CalculatorOutlined style={{ fontSize: 64, color: '#d9d9d9' }} />
              <Title level={4} style={{ marginTop: 24, color: '#999' }}>
                点击下方"开始测算"
              </Title>
              <Paragraph type="secondary">
                系统将实时显示进度并求解最优降权系数
              </Paragraph>
            </AntCard>
          )}
        </Col>
      </Row>
    </div>
  );
}

// 辅助函数：统计需求
function buildNeedsMap(cards: string[]): Map<string, number> {
  const needs = new Map<string, number>();
  for (const card of cards) {
    needs.set(card, (needs.get(card) || 0) + 1);
  }
  return needs;
}
