/**
 * 🎴 CardSelectionPage - New Minimalist Design
 * Color Palette: #E6FAFC, #9CFC97, #6BA368, #511B3A, #353D2F
 */

import { useState, useCallback } from 'react';
import {
  Row, Col, Card as AntCard, Button, Space, Typography,
  message, Progress, Table, Tag, Select, Divider, Alert, Tabs, InputNumber,
} from 'antd';
import {
  CalculatorOutlined, PlusOutlined, DeleteOutlined,
  TrophyOutlined, QuestionCircleOutlined, TableOutlined, GiftOutlined,
  ThunderboltOutlined,
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

// Color Palette
const COLORS = {
  bgLight: '#E6FAFC',
  accent: '#9CFC97',
  primary: '#6BA368',
  dark: '#511B3A',
  text: '#353D2F',
};

// Card rarity colors mapped to palette
const RARITY_COLORS = {
  magic: { bg: '#511B3A', text: '#E6FAFC', label: '神奇' },
  rare: { bg: '#6BA368', text: '#E6FAFC', label: '稀有' },
  common: { bg: '#353D2F', text: '#9CFC97', label: '普通' },
};

const CARD_META: Record<string, { type: 'magic' | 'rare' | 'common'; name: string; baseProb: number }> = {
  A: { type: 'magic', name: '神奇A', baseProb: 2 },
  B: { type: 'rare', name: '稀有B', baseProb: 7 },
  C: { type: 'rare', name: '稀有C', baseProb: 7 },
  D: { type: 'rare', name: '稀有D', baseProb: 7 },
  E: { type: 'rare', name: '稀有E', baseProb: 7 },
  F: { type: 'common', name: '普通F', baseProb: 14 },
  G: { type: 'common', name: '普通G', baseProb: 14 },
  H: { type: 'common', name: '普通H', baseProb: 14 },
  I: { type: 'common', name: '普通I', baseProb: 14 },
  J: { type: 'common', name: '普通J', baseProb: 14 },
};

const DEFAULT_SETUP: CardSetup = {
  week1: {
    name: '第一周',
    cards: ['A', 'A', 'B'],
    deadline: 7,
  },
  week2: {
    name: '第二周',
    cards: ['C', 'D', 'E'],
    deadline: 14,
  },
  dailyDraws: 4,
  baseCards: {
    week1: 'A',
    week2: 'C',
  },
};

const MIN_EXTRA_CARDS = 1;
const MAX_EXTRA_CARDS = 3;
const MIN_DAILY_DRAWS = 1;
const MAX_DAILY_DRAWS = 10;

export function CardSelectionPage({ onNavigateToConfig }: { onNavigateToConfig?: () => void }) {
  const [setup, setSetup] = useState<CardSetup>(DEFAULT_SETUP);
  const [isCalculating, setIsCalculating] = useState(false);
  const [progress, setProgress] = useState<SolverProgress | null>(null);
  const [result, setResult] = useState<CoefficientResult | null>(null);
  const [activeTab, setActiveTab] = useState('week1');

  // Helper functions...
  const buildNeedsMap = (cards: string[]): Map<string, number> => {
    const needs = new Map<string, number>();
    for (const card of cards) {
      needs.set(card, (needs.get(card) || 0) + 1);
    }
    return needs;
  };

  const parseCards = (cards: string[], baseCard: string) => {
    const counts = new Map<string, number>();
    cards.forEach(c => counts.set(c, (counts.get(c) || 0) + 1));
    const baseCount = counts.get(baseCard) || 0;
    counts.delete(baseCard);
    const extras: { card: string; count: number }[] = [];
    for (const [card, count] of counts.entries()) {
      extras.push({ card, count });
    }
    return { baseCount, extras };
  };

  // Setup update functions...
  const setBaseCard = useCallback((week: 'week1' | 'week2', newBase: string) => {
    setSetup(prev => {
      const current = [...prev[week].cards];
      const existingBase = prev.baseCards ?? { week1: prev.week1.cards[0], week2: prev.week2.cards[0] };
      const newBaseCards: { week1: string; week2: string } = { ...existingBase, [week]: newBase };

      const prevBase = prev.baseCards?.[week] || prev[week].cards[0];
      const unusedCards: string[] = [];
      for (const c of current) {
        if (c !== prevBase) unusedCards.push(c);
        else if (c === newBase) unusedCards.push(c);
      }

      const countMap = new Map<string, number>();
      unusedCards.forEach(c => countMap.set(c, (countMap.get(c) || 0) + 1));

      const newCards: string[] = [newBase, newBase];
      for (const [card, count] of countMap) {
        if (card !== newBase) {
          for (let i = 0; i < count; i++) newCards.push(card);
        }
      }

      return { ...prev, [week]: { ...prev[week], cards: newCards }, baseCards: newBaseCards };
    });
    if (result) setResult(null);
  }, [result]);

  const addExtraCard = useCallback((week: 'week1' | 'week2') => {
    setSetup(prev => {
      const current = prev[week].cards;
      if (current.length >= MAX_EXTRA_CARDS + 2) {
        message.warning(`每周最多 ${MAX_EXTRA_CARDS + 2} 张卡`);
        return prev;
      }
      const defaultExtra = (prev.baseCards?.[week] || current[0]) === 'A' ? 'B' : 'A';
      return { ...prev, [week]: { ...prev[week], cards: [...current, defaultExtra] } };
    });
    if (result) setResult(null);
  }, [result]);

  const removeExtraCard = useCallback((week: 'week1' | 'week2', cardIndex: number) => {
    setSetup(prev => {
      const current = [...prev[week].cards];
      if (current.length <= 3) {
        message.warning('需要至少1张扩展卡');
        return prev;
      }
      let extIdx = 0;
      let foundIndex = -1;
      const baseCard = prev.baseCards?.[week] || current[0];
      for (let i = 0; i < current.length; i++) {
        if (current[i] === baseCard) continue;
        if (extIdx === cardIndex) { foundIndex = i; break; }
        extIdx++;
      }
      if (foundIndex === -1) return prev;
      return { ...prev, [week]: { ...prev[week], cards: current.filter((_, i) => i !== foundIndex) } };
    });
    if (result) setResult(null);
  }, [result]);

  const updateExtraCard = useCallback((week: 'week1' | 'week2', cardIndex: number, newCard: string) => {
    setSetup(prev => {
      const current = [...prev[week].cards];
      const baseCard = prev.baseCards?.[week] || current[0];
      let extIdx = 0;
      for (let i = 0; i < current.length; i++) {
        if (current[i] === baseCard) continue;
        if (extIdx === cardIndex) { current[i] = newCard; break; }
        extIdx++;
      }
      return { ...prev, [week]: { ...prev[week], cards: current } };
    });
    if (result) setResult(null);
  }, [result]);

  const updateDailyDraws = useCallback((draws: number) => {
    setSetup(prev => ({ ...prev, dailyDraws: draws }));
    if (result) setResult(null);
  }, [result]);

  const runSolve = useCallback(async () => {
    if (setup.week1.cards.length < 3 || setup.week2.cards.length < 3) {
      message.error('每周需要至少3张卡');
      return;
    }
    setIsCalculating(true);
    setProgress(null);
    setResult(null);
    try {
      const coefficientResult = await runSimulation(setup, (p: SolverProgress) => setProgress(p));
      setResult(coefficientResult);
      const error1 = Math.abs(coefficientResult.actualRates.week1 - 4.0);
      const error2 = Math.abs(coefficientResult.actualRates.week2 - 4.0);
      if (coefficientResult.converged && error1 < 1.0 && error2 < 1.0) {
        message.success('求解成功！两周集齐率均接近4%');
      } else {
        message.warning(`结果已生成（误差：${Math.max(error1, error2).toFixed(2)}%）`);
      }
    } catch (error) {
      message.error('求解失败: ' + String(error));
    } finally {
      setIsCalculating(false);
    }
  }, [setup]);

  const getCardBadge = (card: string, isBase = false) => {
    const meta = CARD_META[card];
    const style = RARITY_COLORS[meta.type];
    return (
      <span
        key={card}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 36,
          height: 36,
          borderRadius: 8,
          background: style.bg,
          color: style.text,
          fontWeight: isBase ? 700 : 500,
          fontSize: 16,
          margin: 2,
          boxShadow: isBase ? `0 0 0 2px ${COLORS.accent}` : 'none',
        }}
      >
        {card}
      </span>
    );
  };

  // Card Type Legend
  const CardTypeLegend = () => (
    <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 28, height: 28, borderRadius: 6, background: RARITY_COLORS.magic.bg, color: RARITY_COLORS.magic.text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>A</span>
        <Text style={{ color: COLORS.text, fontSize: 13 }}>神奇 {CARD_META.A.baseProb}%</Text>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 28, height: 28, borderRadius: 6, background: RARITY_COLORS.rare.bg, color: RARITY_COLORS.rare.text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>B</span>
        <Text style={{ color: COLORS.text, fontSize: 13 }}>稀有 4张均分{CARD_META.B.baseProb}%</Text>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 28, height: 28, borderRadius: 6, background: RARITY_COLORS.common.bg, color: RARITY_COLORS.common.text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>F</span>
        <Text style={{ color: COLORS.text, fontSize: 13 }}>普通 5张均分{CARD_META.F.baseProb}%</Text>
      </div>
    </div>
  );

  const renderWeekConfig = (weekKey: 'week1' | 'week2', weekData: WeeklyCombo) => {
    const baseCard = setup.baseCards?.[weekKey] || weekData.cards[0];
    const { baseCount, extras } = parseCards(weekData.cards, baseCard);
    const totalCards = weekData.cards.length;
    const needs = buildNeedsMap(weekData.cards);
    const needReductionCount = Array.from(needs.values()).reduce((sum, n) => sum + Math.max(0, n - 1), 0);

    return (
      <div
        style={{
          background: 'white',
          borderRadius: 16,
          padding: 20,
          marginBottom: 16,
          boxShadow: '0 4px 20px rgba(81, 27, 58, 0.08)',
          border: `1px solid ${COLORS.bgLight}`,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Space>
            <Text strong style={{ color: COLORS.dark, fontSize: 16, fontWeight: 600 }}>{weekData.name}</Text>
            <Tag style={{ background: COLORS.primary, color: 'white', border: 'none' }}>第 {weekData.deadline} 天截止</Tag>
          </Space>
          <Text style={{ color: COLORS.text, fontSize: 13 }}>{totalCards} 张卡</Text>
        </div>

        {/* Base Card */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: 12,
            background: COLORS.bgLight,
            borderRadius: 12,
            marginBottom: 12,
          }}
        >
          <ThunderboltOutlined style={{ color: COLORS.primary }} />
          <Text strong style={{ color: COLORS.text }}>基础卡</Text>
          <Tag style={{ background: COLORS.accent, color: COLORS.text, border: 'none' }}>固定×2</Tag>
          <Select value={baseCard} onChange={(v) => setBaseCard(weekKey, v)} style={{ width: 70 }} size="small" bordered={false}>
            {ALL_CARDS.map(c => (
              <Option key={c} value={c}>
                <span style={{ color: RARITY_COLORS[CARD_META[c].type].bg, fontWeight: 600 }}>{c}</span>
              </Option>
            ))}
          </Select>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {getCardBadge(baseCard, true)}
            <Text style={{ marginLeft: 8, color: COLORS.text }}>×{baseCount}</Text>
          </div>
        </div>

        {/* Extra Cards */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {extras.length > 0 ? extras.map((extra, idx) => {
            const actualCount = weekData.cards.filter(c => c === extra.card && c !== baseCard).length;
            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 10px',
                  background: 'white',
                  borderRadius: 10,
                  border: `1.5px solid ${COLORS.bgLight}`,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                }}
              >
                <Select value={extra.card} onChange={(v) => updateExtraCard(weekKey, idx, v)} style={{ width: 50 }} size="small" bordered={false}>
                  {ALL_CARDS.map(c => (
                    <Option key={c} value={c}>
                      <span style={{ color: RARITY_COLORS[CARD_META[c].type].bg }}>{c}</span>
                    </Option>
                  ))}
                </Select>
                <Space size={2}>
                  <Button type="text" size="small" onClick={() => {}} disabled={actualCount <= 1}>−</Button>
                  <Text style={{ fontSize: 13 }}>×{actualCount}</Text>
                  <Button type="text" size="small" onClick={() => {}} disabled={totalCards >= 5}>+</Button>
                </Space>
                <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeExtraCard(weekKey, idx)} />
              </div>
            );
          }) : <Text type="secondary" style={{ fontSize: 13 }}>无扩展卡</Text>}
        </div>

        {totalCards < 5 && (
          <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={() => addExtraCard(weekKey)} style={{ color: COLORS.primary, borderColor: COLORS.primary }}>
            添加扩展卡
          </Button>
        )}

        <div style={{ marginTop: 12, fontSize: 12, color: COLORS.text, opacity: 0.7 }}>
          {Array.from(needs.entries()).map(([card, n]) => `${card}×${n}(${n > 1 ? `第2张起降权` : '无降权'})`).join(', ')}
        </div>
      </div>
    );
  };

  const renderCoefficientTable = (title: string, coeffsData: Record<string, CardCoefficients>, weekCombo: WeeklyCombo, otherWeekCombo: WeeklyCombo) => {
    const needs = buildNeedsMap(weekCombo.cards);
    const otherNeeds = buildNeedsMap(otherWeekCombo.cards);

    // Combine cards from both weeks for display
    const allRelevantCards = new Set([...weekCombo.cards, ...otherWeekCombo.cards]);

    const dataSource = Array.from(allRelevantCards).sort().map(card => {
      const coeffs = coeffsData[card] || [1.0];
      const demand = needs.get(card) || 0;
      const otherDemand = otherNeeds.get(card) || 0;
      const isInCurrent = demand > 0;
      const isInOther = otherDemand > 0;

      return {
        key: card,
        card,
        type: getCardType(card),
        demand,
        otherDemand,
        isInCurrent,
        isInOther,
        reductionSlots: Math.max(0, (needs.get(card) || 0) - 1),
        coeffs,
      };
    });

    return (
      <div style={{ marginBottom: 24 }}>
        <Title level={5} style={{ color: COLORS.dark, marginBottom: 12 }}>{title}</Title>
        <Table
          size="small"
          dataSource={dataSource}
          pagination={false}
          style={{ background: 'white', borderRadius: 12, overflow: 'hidden' }}
          rowClassName={(record) => record.isInOther && !record.isInCurrent ? 'cross-week-row' : ''}
        >
          <Table.Column
            title="卡牌"
            dataIndex="card"
            width={70}
            render={(v: string) => (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28, height: 28,
                borderRadius: 6,
                background: RARITY_COLORS[CARD_META[v].type].bg,
                color: RARITY_COLORS[CARD_META[v].type].text,
                fontWeight: 600,
              }}>{v}</span>
            )}
          />
          <Table.Column
            title="类型"
            dataIndex="type"
            width={80}
            render={(v: string) => (
              <span style={{
                padding: '2px 8px',
                borderRadius: 4,
                background: RARITY_COLORS[v as 'magic' | 'rare' | 'common'].bg,
                color: RARITY_COLORS[v as 'magic' | 'rare' | 'common'].text,
                fontSize: 12,
              }}>{RARITY_COLORS[v as 'magic' | 'rare' | 'common'].label}</span>
            )}
          />
          <Table.Column
            title="本周需求"
            dataIndex="demand"
            width={90}
            align="center"
            render={(v: number) => v > 0 ? <Tag color="processing">{v}张</Tag> : <span style={{ color: '#999' }}>—</span>}
          />
          <Table.Column
            title="跨周需求"
            dataIndex="otherDemand"
            width={90}
            align="center"
            render={(v: number) => v > 0 ? <Tag color="warning">{v}张</Tag> : <span style={{ color: '#999' }}>—</span>}
          />
          <Table.Column
            title="降权系数"
            dataIndex="coeffs"
            render={(coeffs: number[], record: { demand: number }) => {
              const activeSlots = Math.max(0, record.demand - 1);
              return (
                <Space size={4}>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: COLORS.bgLight,
                    color: COLORS.text,
                    fontSize: 12,
                  }}>第1张: 1.0</span>
                  {activeSlots > 0 && Array.from({ length: activeSlots }).map((_, i) => (
                    <span key={i} style={{
                      padding: '2px 8px',
                      borderRadius: 4,
                      background: (coeffs[i+1] || 1) < 0.01 ? '#511B3A' : (coeffs[i+1] || 1) < 0.1 ? '#6BA368' : '#9CFC97',
                      color: (coeffs[i+1] || 1) < 0.01 ? '#E6FAFC' : COLORS.text,
                      fontSize: 12,
                      fontWeight: (coeffs[i+1] || 1) < 0.01 ? 600 : 400,
                    }}>
                      第{i+2}张: {(coeffs[i+1] || 0).toFixed(5)}
                    </span>
                  ))}
                </Space>
              );
            }}
          />
        </Table>
        <style>{`
          .cross-week-row {
            background: linear-gradient(90deg, rgba(156,252,151,0.1) 0%, transparent 100%);
          }
        `}</style>
      </div>
    );
  };

  return (
    <div style={{ minHeight: '100vh', background: `linear-gradient(135deg, ${COLORS.bgLight} 0%, #fff 100%)`, padding: '32px 24px' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <Title style={{ color: COLORS.dark, fontSize: 32, fontWeight: 700, marginBottom: 8, letterSpacing: '-0.02em' }}>
            神奇物种概率系统
          </Title>
          <Paragraph style={{ color: COLORS.text, fontSize: 15, opacity: 0.8 }}>
            智能求解最优降权系数 · 精准控制集齐率
          </Paragraph>
        </div>

        {/* Card Type Legend */}
        <AntCard
          style={{
            background: 'white',
            borderRadius: 16,
            marginBottom: 24,
            boxShadow: '0 4px 20px rgba(81, 27, 58, 0.06)',
            border: 'none',
          }}
          bodyStyle={{ padding: 20 }}
        >
          <Text strong style={{ color: COLORS.dark, display: 'block', marginBottom: 12 }}>卡牌类型说明</Text>
          <CardTypeLegend />
        </AntCard>

        <Row gutter={[24, 24]}>
          <Col xs={24} lg={10}>
            <div
              style={{
                background: 'white',
                borderRadius: 20,
                padding: 24,
                boxShadow: '0 8px 32px rgba(81, 27, 58, 0.08)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <Text strong style={{ color: COLORS.dark, fontSize: 18 }}>卡组配置</Text>
                <Button
                  type="primary"
                  icon={<CalculatorOutlined />}
                  onClick={runSolve}
                  loading={isCalculating}
                  style={{
                    background: COLORS.primary,
                    borderColor: COLORS.primary,
                    borderRadius: 8,
                    height: 40,
                    padding: '0 24px',
                  }}
                >
                  {isCalculating ? '计算中...' : '开始测算'}
                </Button>
              </div>

              {renderWeekConfig('week1', setup.week1)}
              {renderWeekConfig('week2', setup.week2)}

              {/* Daily Draws */}
              <div
                style={{
                  padding: 16,
                  background: COLORS.bgLight,
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  marginBottom: 16,
                }}
              >
                <GiftOutlined style={{ color: COLORS.primary, fontSize: 20 }} />
                <Text style={{ color: COLORS.text }}>每日抽奖次数</Text>
                <InputNumber
                  min={MIN_DAILY_DRAWS}
                  max={MAX_DAILY_DRAWS}
                  value={setup.dailyDraws}
                  onChange={(v) => v && updateDailyDraws(v)}
                  style={{ width: 80 }}
                  size="small"
                />
                <Text type="secondary" style={{ fontSize: 12 }}>次/天</Text>
              </div>

              {/* Progress */}
              {isCalculating && progress && (
                <div style={{ padding: 16, background: COLORS.bgLight, borderRadius: 12 }}>
                  <Progress
                    percent={Math.round((progress.iteration / progress.totalIterations) * 100)}
                    status="active"
                    strokeColor={COLORS.primary}
                    trailColor="rgba(107, 163, 104, 0.2)"
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>迭代 {progress.iteration.toFixed(1)}/{progress.totalIterations}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>Week1: {progress.week1Rate.toFixed(1)}% | Week2: {progress.week2Rate.toFixed(1)}%</Text>
                  </div>
                </div>
              )}

              {/* Results */}
              {result && (
                <div style={{ marginTop: 20, padding: 20, background: COLORS.bgLight, borderRadius: 12 }}>
                  <Row gutter={16}>
                    <Col span={8} style={{ textAlign: 'center' }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>第一周</Text>
                      <div style={{ fontSize: 28, fontWeight: 700, color: COLORS.primary }}>{result.actualRates.week1.toFixed(1)}%</div>
                      <Text type="secondary" style={{ fontSize: 11 }}>目标4%</Text>
                    </Col>
                    <Col span={8} style={{ textAlign: 'center' }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>第二周</Text>
                      <div style={{ fontSize: 28, fontWeight: 700, color: COLORS.primary }}>{result.actualRates.week2.toFixed(1)}%</div>
                      <Text type="secondary" style={{ fontSize: 11 }}>目标4%</Text>
                    </Col>
                    <Col span={8} style={{ textAlign: 'center' }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>全收集</Text>
                      <div style={{ fontSize: 28, fontWeight: 700, color: COLORS.dark }}>{result.fullCollectionRate.toFixed(1)}%</div>
                      <Text type="secondary" style={{ fontSize: 11 }}>14天内</Text>
                    </Col>
                  </Row>
                </div>
              )}
            </div>
          </Col>

          <Col xs={24} lg={14}>
            {result ? (
              <div style={{ background: 'white', borderRadius: 20, padding: 24, boxShadow: '0 8px 32px rgba(81, 27, 58, 0.08)' }}>
                <Tabs activeKey={activeTab} onChange={setActiveTab}>
                  <TabPane tab={<span><TrophyOutlined /> 第一周系数</span>} key="week1">
                    <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                      包含本周卡组及跨周卡牌的系数配置。
                      <span style={{ background: 'rgba(156,252,151,0.3)', padding: '2px 6px', borderRadius: 4, marginLeft: 8 }}>绿色底纹</span>表示跨周卡牌
                    </Paragraph>
                    {renderCoefficientTable('降权系数详情', result.week1, setup.week1, setup.week2)}
                  </TabPane>

                  <TabPane tab={<span><TrophyOutlined /> 第二周系数</span>} key="week2">
                    <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                      包含本周卡组及跨周卡牌的系数配置。
                    </Paragraph>
                    {renderCoefficientTable('降权系数详情', result.week2, setup.week2, setup.week1)}
                  </TabPane>

                  <TabPane tab={<span><TableOutlined /> 基础概率</span>} key="base">
                    <Table
                      size="small"
                      pagination={false}
                      dataSource={ALL_CARDS.map(card => ({
                        card,
                        type: CARD_META[card].type,
                        name: CARD_META[card].name,
                        prob: `${CARD_META[card].baseProb}%`,
                      }))}
                      columns={[
                        { title: '卡牌', dataIndex: 'card', render: (v: string) => getCardBadge(v) },
                        { title: '类型', dataIndex: 'type', render: (v: string) => RARITY_COLORS[v as 'magic' | 'rare' | 'common'].label },
                        { title: '名称', dataIndex: 'name' },
                        { title: '基础概率', dataIndex: 'prob' },
                      ]}
                    />
                  </TabPane>
                </Tabs>
              </div>
            ) : (
              <div style={{ background: 'white', borderRadius: 20, padding: 80, textAlign: 'center', boxShadow: '0 8px 32px rgba(81, 27, 58, 0.08)' }}>
                <CalculatorOutlined style={{ fontSize: 64, color: COLORS.bgLight }} />
                <Title level={4} style={{ marginTop: 24, color: COLORS.text, opacity: 0.5 }}>点击"开始测算"生成系数</Title>
              </div>
            )}
          </Col>
        </Row>
      </div>
    </div>
  );
}
