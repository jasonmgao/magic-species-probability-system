/**
 * 🎴 CardSelectionPage - Financial Instrument Aesthetic
 * Designed with precision and restraint
 */

import { useState, useCallback, useMemo } from 'react';
import {
  Row, Col, Button, Space, Typography,
  message, Progress, Table, Tag, Select, Divider,
  InputNumber,
} from 'antd';
import {
  CalculatorOutlined, PlusOutlined, DeleteOutlined,
  TrophyOutlined, ArrowRightOutlined, BarChartOutlined,
} from '@ant-design/icons';
import type { CardSetup, WeeklyCombo, CoefficientResult, SolverProgress, CardCoefficients } from '@/types';
import {
  runSimulation,
  ALL_CARDS,
  getCardType,
  getBaseProb,
} from '@/services/simulationEngine';

const { Title, Text } = Typography;
const { Option } = Select;

// Refined color system - more restraint, less AI feel
const PALETTE = {
  bg: '#F7F9F7',
  surface: '#FFFFFF',
  text: '#1a1a2e',
  textMuted: '#6b6b7b',
  border: '#e5e7eb',
  borderLight: '#f0f0f2',
  accent: '#511B3A',      // Deep plum - used sparingly
  accentLight: '#f4f0f3', // Very light plum for backgrounds
  success: '#3d6b4a',     // Refined forest green
  highlight: '#7fb069',   // Bright green accent
};

const CARD_META: Record<string, { type: 'magic' | 'rare' | 'common'; prob: number }> = {
  A: { type: 'magic', prob: 2 },
  B: { type: 'rare', prob: 7 },
  C: { type: 'rare', prob: 7 },
  D: { type: 'rare', prob: 7 },
  E: { type: 'rare', prob: 7 },
  F: { type: 'common', prob: 14 },
  G: { type: 'common', prob: 14 },
  H: { type: 'common', prob: 14 },
  I: { type: 'common', prob: 14 },
  J: { type: 'common', prob: 14 },
};

const TYPE_LABELS = {
  magic: { text: '神奇', short: '神' },
  rare: { text: '稀有', short: '稀' },
  common: { text: '普通', short: '普' },
};

const DEFAULT_SETUP: CardSetup = {
  week1: { name: '第一周', cards: ['A', 'A', 'B'], deadline: 7 },
  week2: { name: '第二周', cards: ['C', 'D', 'E'], deadline: 14 },
  dailyDraws: 4,
};

// Configuration Balance Indicator - Signature Element
function ConfigBalanceBar({ setup }: { setup: CardSetup }) {
  const analysis = useMemo(() => {
    const w1Cards = setup.week1.cards.length;
    const w2Cards = setup.week2.cards.length;
    const totalUnique = new Set([...setup.week1.cards, ...setup.week2.cards]).size;
    const w1Repeats = setup.week1.cards.length - new Set(setup.week1.cards).size;
    const w2Repeats = setup.week2.cards.length - new Set(setup.week2.cards).size;

    // Difficulty score: 0-100
    const baseScore = 30;
    const cardFactor = (w1Cards + w2Cards) * 8;
    const uniqueFactor = totalUnique * 5;
    const repeatPenalty = (w1Repeats + w2Repeats) * 15;

    let score = baseScore + cardFactor - uniqueFactor - repeatPenalty;
    score = Math.max(10, Math.min(95, score));

    let label = '适中';
    let color = PALETTE.success;
    if (score < 25) { label = '极易'; color = PALETTE.highlight; }
    else if (score < 40) { label = '容易'; color = '#8fb069'; }
    else if (score > 70) { label = '困难'; color = PALETTE.accent; }
    else if (score > 55) { label = '偏难'; color = '#8b5a6b'; }

    return { score, label, color, details: `${w1Cards}+${w2Cards}张 · ${totalUnique}种` };
  }, [setup]);

  return (
    <div style={{
      background: PALETTE.surface,
      borderRadius: 4,
      padding: '20px 24px',
      border: `1px solid ${PALETTE.border}`,
      marginBottom: 24,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <Text style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: PALETTE.textMuted }}>
            Configuration Difficulty
          </Text>
          <div style={{ fontSize: 13, color: PALETTE.textMuted, marginTop: 2 }}>
            {analysis.details}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 28,
            fontWeight: 600,
            color: analysis.color,
          }}>
            {analysis.score}
          </span>
          <span style={{ fontSize: 12, color: PALETTE.textMuted, marginLeft: 4 }}>/100</span>
        </div>
      </div>

      {/* Balance Bar */}
      <div style={{ position: 'relative', height: 4, background: PALETTE.borderLight, borderRadius: 2 }}>
        <div style={{
          position: 'absolute',
          left: 0,
          width: `${analysis.score}%`,
          height: '100%',
          background: analysis.color,
          borderRadius: 2,
          transition: 'all 0.4s ease',
        }} />
        {/* Markers */}
        {[25, 50, 75].map(pos => (
          <div key={pos} style={{
            position: 'absolute',
            left: `${pos}%`,
            top: -3,
            width: 1,
            height: 10,
            background: PALETTE.border,
          }} />
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
        <span style={{ fontSize: 11, color: PALETTE.textMuted }}>极易完成</span>
        <span style={{
          fontSize: 11,
          fontWeight: 600,
          color: analysis.color,
          letterSpacing: '0.02em',
        }}>
          {analysis.label}
        </span>
        <span style={{ fontSize: 11, color: PALETTE.textMuted }}>极难完成</span>
      </div>
    </div>
  );
}

// Minimal Card Component
function CardToken({
  card,
  count,
  isActive,
  isBase,
}: {
  card: string;
  count?: number;
  isActive?: boolean;
  isBase?: boolean;
}) {
  const meta = CARD_META[card];
  const typeColors = {
    magic: PALETTE.accent,
    rare: PALETTE.success,
    common: PALETTE.textMuted,
  };

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: isBase ? '6px 12px' : '4px 10px',
      background: isActive ? PALETTE.accentLight : PALETTE.surface,
      border: `1px solid ${isBase ? typeColors[meta.type] : isActive ? PALETTE.accent : PALETTE.border}`,
      borderRadius: 3,
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: 13,
      fontWeight: 500,
      color: isBase ? typeColors[meta.type] : PALETTE.text,
    }}>
      <span>{card}</span>
      {count && count > 1 && (
        <span style={{ fontSize: 11, color: PALETTE.textMuted }}>×{count}</span>
      )}
      {isBase && (
        <span style={{
          fontSize: 9,
          textTransform: 'uppercase',
          letterSpacing: '0.03em',
          color: typeColors[meta.type],
          opacity: 0.7,
        }}>
          base
        </span>
      )}
    </div>
  );
}

// Week Panel Component
function WeekPanel({
  title,
  weekKey,
  combo,
  setup,
  onChange,
}: {
  title: string;
  weekKey: 'week1' | 'week2';
  combo: WeeklyCombo;
  setup: CardSetup;
  onChange: (newSetup: CardSetup) => void;
}) {
  const needs = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of combo.cards) {
      map.set(c, (map.get(c) || 0) + 1);
    }
    return map;
  }, [combo.cards]);

  const baseCard = combo.cards[0];
  const extraCards = combo.cards.slice(2); // After 2 base cards

  const setBase = (card: string) => {
    const current = [...combo.cards];
    const newCards = [card, card, ...current.filter(c => c !== baseCard)];
    onChange({
      ...setup,
      [weekKey]: { ...combo, cards: newCards.slice(0, 5) },
    });
  };

  const addCard = () => {
    if (combo.cards.length >= 5) {
      message.warning('上限5张');
      return;
    }
    const options = ALL_CARDS.filter(c => !combo.cards.includes(c) || c === baseCard);
    const newCard = options[0] || 'A';
    onChange({
      ...setup,
      [weekKey]: { ...combo, cards: [...combo.cards, newCard] },
    });
  };

  const removeCard = (idx: number) => {
    const actualIdx = idx + 2;
    onChange({
      ...setup,
      [weekKey]: { ...combo, cards: combo.cards.filter((_, i) => i !== actualIdx) },
    });
  };

  const changeCard = (idx: number, newCard: string) => {
    const actualIdx = idx + 2;
    const newCards = [...combo.cards];
    newCards[actualIdx] = newCard;
    onChange({
      ...setup,
      [weekKey]: { ...combo, cards: newCards },
    });
  };

  return (
    <div style={{
      background: PALETTE.surface,
      borderRadius: 4,
      border: `1px solid ${PALETTE.border}`,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: `1px solid ${PALETTE.border}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <Text style={{
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: PALETTE.textMuted,
            display: 'block',
          }}>
            Deck Configuration
          </Text>
          <Title level={5} style={{ margin: '4px 0 0 0', fontSize: 16, fontWeight: 600, color: PALETTE.text }}>
            {title}
          </Title>
        </div>
        <div style={{
          padding: '4px 12px',
          background: PALETTE.bg,
          borderRadius: 3,
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 12,
          color: PALETTE.textMuted,
        }}>
          {combo.deadline} days
        </div>
      </div>

      <div style={{ padding: 20 }}>
        {/* Base Card Selector */}
        <div style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 11, color: PALETTE.textMuted, display: 'block', marginBottom: 8 }}>
            BASE CARD (×2 FIXED)
          </Text>
          <Select
            value={baseCard}
            onChange={setBase}
            style={{ width: '100%' }}
            size="large"
            bordered={false}
            dropdownStyle={{ borderRadius: 4 }}
          >
            {ALL_CARDS.map(c => (
              <Option key={c} value={c}>
                <Space>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 24,
                    height: 24,
                    borderRadius: 3,
                    background: CARD_META[c].type === 'magic' ? PALETTE.accent :
                               CARD_META[c].type === 'rare' ? PALETTE.success : PALETTE.textMuted,
                    color: '#fff',
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 12,
                    fontWeight: 600,
                  }}>{c}</span>
                  <span>{TYPE_LABELS[CARD_META[c].type].text}</span>
                  <span style={{ color: PALETTE.textMuted }}>{CARD_META[c].prob}%</span>
                </Space>
              </Option>
            ))}
          </Select>
          <div style={{ marginTop: 8 }}>
            <CardToken card={baseCard} count={2} isBase />
          </div>
        </div>

        {/* Extra Cards */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 11, color: PALETTE.textMuted }}>
              EXTENSION CARDS ({extraCards.length}/3)
            </Text>
            <Button
              type="text"
              size="small"
              icon={<PlusOutlined />}
              onClick={addCard}
              disabled={combo.cards.length >= 5}
              style={{ color: PALETTE.success }}
            >
              Add
            </Button>
          </div>

          {extraCards.length === 0 ? (
            <div style={{
              padding: '20px 0',
              textAlign: 'center',
              color: PALETTE.textMuted,
              fontSize: 13,
              border: `1px dashed ${PALETTE.border}`,
              borderRadius: 4,
            }}>
              No extension cards
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {extraCards.map((card, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '8px 12px',
                  background: PALETTE.bg,
                  borderRadius: 3,
                }}>
                  <Select
                    value={card}
                    onChange={(v) => changeCard(idx, v)}
                    style={{ flex: 1 }}
                    size="small"
                    bordered={false}
                  >
                    {ALL_CARDS.map(c => (
                      <Option key={c} value={c}>
                        <Space>
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 }}>{c}</span>
                          <span style={{ fontSize: 12, color: PALETTE.textMuted }}>
                            {TYPE_LABELS[CARD_META[c].type].text} {CARD_META[c].prob}%
                          </span>
                        </Space>
                      </Option>
                    ))}
                  </Select>
                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={() => removeCard(idx)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Summary */}
        <Divider style={{ margin: '20px 0', borderColor: PALETTE.borderLight }} />
        <div style={{
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
        }}>
          {Array.from(needs.entries()).map(([card, count]) => (
            <CardToken key={card} card={card} count={count} isActive={count > 1} />
          ))}
        </div>
        {Array.from(needs.values()).some(n => n > 1) && (
          <div style={{
            marginTop: 12,
            padding: '8px 12px',
            background: PALETTE.accentLight,
            borderRadius: 3,
            fontSize: 11,
            color: PALETTE.accent,
          }}>
            重复卡牌将在第2张起应用降权系数
          </div>
        )}
      </div>
    </div>
  );
}

// Coefficient Display Component
function CoefficientDisplay({ value }: { value: number }) {
  const severity = value < 0.001 ? 'extreme' : value < 0.01 ? 'high' : value < 0.1 ? 'medium' : 'low';
  const colors = {
    extreme: { bg: PALETTE.accent, text: '#fff' },
    high: { bg: '#d4a5a5', text: PALETTE.accent },
    medium: { bg: '#e8f0e8', text: PALETTE.success },
    low: { bg: PALETTE.borderLight, text: PALETTE.textMuted },
  };
  const c = colors[severity];

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 8px',
      background: c.bg,
      color: c.text,
      borderRadius: 3,
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: 12,
      fontWeight: severity === 'extreme' ? 600 : 400,
    }}>
      {value.toFixed(5)}
    </span>
  );
}

// Main Component
export function CardSelectionPage({ onNavigateToConfig }: { onNavigateToConfig?: () => void }) {
  const [setup, setSetup] = useState<CardSetup>(DEFAULT_SETUP);
  const [isCalculating, setIsCalculating] = useState(false);
  const [progress, setProgress] = useState<SolverProgress | null>(null);
  const [result, setResult] = useState<CoefficientResult | null>(null);
  const [showResults, setShowResults] = useState(false);

  const runSolve = useCallback(async () => {
    if (setup.week1.cards.length < 3 || setup.week2.cards.length < 3) {
      message.error('每周至少3张卡');
      return;
    }
    setIsCalculating(true);
    setProgress(null);
    setResult(null);
    try {
      const coefficientResult = await runSimulation(setup, setProgress);
      setResult(coefficientResult);
      setShowResults(true);
      const error1 = Math.abs(coefficientResult.actualRates.week1 - 4.0);
      const error2 = Math.abs(coefficientResult.actualRates.week2 - 4.0);
      if (coefficientResult.converged && error1 < 1.0 && error2 < 1.0) {
        message.success('系数已收敛');
      }
    } catch (error) {
      message.error('求解失败: ' + String(error));
    } finally {
      setIsCalculating(false);
    }
  }, [setup]);

  // Coefficient Table
  const renderCoefficients = (weekData: WeeklyCombo, otherWeekData: WeeklyCombo, coeffs: Record<string, CardCoefficients>) => {
    const needs = new Map<string, number>();
    for (const c of weekData.cards) needs.set(c, (needs.get(c) || 0) + 1);
    const otherNeeds = new Map<string, number>();
    for (const c of otherWeekData.cards) otherNeeds.set(c, (otherNeeds.get(c) || 0) + 1);

    const allCards = new Set([...weekData.cards, ...otherWeekData.cards]);
    const data = Array.from(allCards).sort().map(card => {
      const demand = needs.get(card) || 0;
      const otherDemand = otherNeeds.get(card) || 0;
      const cardCoeffs = coeffs[card] || [1.0];
      return {
        key: card,
        card,
        type: CARD_META[card].type,
        demand,
        otherDemand,
        coeffs: cardCoeffs,
        hasReduction: demand > 1 || otherDemand > 1,
      };
    });

    return (
      <Table
        size="small"
        dataSource={data}
        pagination={false}
        style={{ fontSize: 13 }}
        columns={[
          {
            title: '卡牌',
            dataIndex: 'card',
            width: 60,
            render: (v: string) => (
              <span style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontWeight: 600,
                color: CARD_META[v].type === 'magic' ? PALETTE.accent :
                       CARD_META[v].type === 'rare' ? PALETTE.success : PALETTE.textMuted,
              }}>{v}</span>
            ),
          },
          {
            title: '类型',
            dataIndex: 'type',
            width: 70,
            render: (v: string) => TYPE_LABELS[v as 'magic'|'rare'|'common'].text,
          },
          {
            title: '本周',
            dataIndex: 'demand',
            width: 60,
            align: 'right',
            render: (v: number) => v > 0 ?
              <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{v}</span> :
              <span style={{ color: PALETTE.textMuted }}>—</span>,
          },
          {
            title: '跨周',
            dataIndex: 'otherDemand',
            width: 60,
            align: 'right',
            render: (v: number, record: any) => v > 0 ?
              <span style={{
                fontFamily: "'IBM Plex Mono', monospace",
                color: record.hasReduction ? PALETTE.accent : PALETTE.textMuted,
              }}>{v}</span> :
              <span style={{ color: PALETTE.textMuted }}>—</span>,
          },
          {
            title: '降权系数',
            dataIndex: 'coeffs',
            render: (c: number[], record: any) => (
              <Space size={8}>
                <span style={{
                  padding: '2px 6px',
                  background: PALETTE.borderLight,
                  borderRadius: 3,
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 12,
                  color: PALETTE.textMuted,
                }}>1.0</span>
                {record.demand > 1 && <CoefficientDisplay value={c[1] || 0.01} />}
                {record.demand > 2 && <CoefficientDisplay value={c[2] || 0.01} />}
              </Space>
            ),
          },
        ]}
      />
    );
  };

  return (
    <div style={{ minHeight: '100vh', background: PALETTE.bg, padding: '40px 24px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 8 }}>
            <Title level={2} style={{
              margin: 0,
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: PALETTE.text,
            }}>
              概率系数调控系统
            </Title>
            <Tag style={{
              background: PALETTE.accentLight,
              color: PALETTE.accent,
              border: 'none',
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              v6.5
            </Tag>
          </div>
          <Text style={{ color: PALETTE.textMuted, fontSize: 14 }}>
            蒙特卡洛模拟求解最优降权系数 · 目标完成率 4%
          </Text>
        </div>

        {/* Configuration Balance Indicator - Signature Element */}
        <ConfigBalanceBar setup={setup} />

        {/* Main Layout: Side by Side Weeks */}
        <Row gutter={24} style={{ marginBottom: 24 }}>
          <Col xs={24} lg={12}>
            <WeekPanel
              title="第一周 (Day 1-7)"
              weekKey="week1"
              combo={setup.week1}
              setup={setup}
              onChange={setSetup}
            />
          </Col>
          <Col xs={24} lg={12}>
            <WeekPanel
              title="第二周 (Day 8-14)"
              weekKey="week2"
              combo={setup.week2}
              setup={setup}
              onChange={setSetup}
            />
          </Col>
        </Row>

        {/* Controls */}
        <div style={{
          background: PALETTE.surface,
          borderRadius: 4,
          border: `1px solid ${PALETTE.border}`,
          padding: '20px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div>
              <Text style={{ fontSize: 11, color: PALETTE.textMuted, display: 'block', marginBottom: 4 }}>
                DAILY DRAWS
              </Text>
              <InputNumber
                min={1}
                max={10}
                value={setup.dailyDraws}
                onChange={(v) => v && setSetup({ ...setup, dailyDraws: v })}
                style={{ width: 80 }}
              />
            </div>
            <div style={{
              padding: '6px 12px',
              background: PALETTE.bg,
              borderRadius: 3,
            }}>
              <Text style={{ fontSize: 12, color: PALETTE.textMuted }}>
                总计 {setup.dailyDraws * 14} 次抽奖 / 两周
              </Text>
            </div>
          </div>

          <Space>
            <Button
              type="text"
              onClick={onNavigateToConfig}
              style={{ color: PALETTE.textMuted }}
            >
              教程
            </Button>
            <Button
              type="primary"
              size="large"
              icon={<CalculatorOutlined />}
              onClick={runSolve}
              loading={isCalculating}
              style={{
                background: PALETTE.accent,
                borderColor: PALETTE.accent,
                borderRadius: 4,
                height: 44,
                padding: '0 32px',
                fontWeight: 500,
              }}
            >
              {isCalculating ? '计算中...' : '开始求解'}
            </Button>
          </Space>
        </div>

        {/* Progress */}
        {isCalculating && progress && (
          <div style={{
            background: PALETTE.surface,
            borderRadius: 4,
            border: `1px solid ${PALETTE.border}`,
            padding: '24px 32px',
            marginBottom: 24,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text style={{ fontSize: 13, color: PALETTE.text }}>
                {progress.iteration < 2 ? 'Phase 1: 粗网格搜索' :
                 progress.iteration < 2.9 ? 'Phase 2: 细网格优化' :
                 'Phase 3: 最终验证'}
              </Text>
              <Text style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 13,
                color: PALETTE.textMuted,
              }}>
                {Math.round((progress.iteration / progress.totalIterations) * 100)}%
              </Text>
            </div>
            <Progress
              percent={Math.round((progress.iteration / progress.totalIterations) * 100)}
              status="active"
              strokeColor={PALETTE.accent}
              trailColor={PALETTE.borderLight}
              showInfo={false}
            />
            <div style={{ display: 'flex', gap: 32, marginTop: 16 }}>
              <div>
                <Text style={{ fontSize: 11, color: PALETTE.textMuted, display: 'block' }}>WEEK 1</Text>
                <span style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 18,
                  fontWeight: 600,
                  color: PALETTE.text,
                }}>{progress.week1Rate.toFixed(2)}%</span>
              </div>
              <div>
                <Text style={{ fontSize: 11, color: PALETTE.textMuted, display: 'block' }}>WEEK 2</Text>
                <span style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 18,
                  fontWeight: 600,
                  color: PALETTE.text,
                }}>{progress.week2Rate.toFixed(2)}%</span>
              </div>
              <div>
                <Text style={{ fontSize: 11, color: PALETTE.textMuted, display: 'block' }}>ERROR</Text>
                <span style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 18,
                  fontWeight: 600,
                  color: progress.error < 1 ? PALETTE.success : PALETTE.accent,
                }}>{progress.error.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {showResults && result && (
          <div style={{
            background: PALETTE.surface,
            borderRadius: 4,
            border: `1px solid ${PALETTE.border}`,
            overflow: 'hidden',
          }}>
            {/* Results Header */}
            <div style={{
              padding: '24px 32px',
              borderBottom: `1px solid ${PALETTE.border}`,
              background: PALETTE.bg,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <Text style={{
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: PALETTE.textMuted,
                    display: 'block',
                  }}>
                    Optimization Results
                  </Text>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                    <Title level={4} style={{ margin: 0, color: PALETTE.text }}>
                      求解完成
                    </Title>
                    {result.converged && (
                      <Tag style={{
                        background: PALETTE.success,
                        color: '#fff',
                        border: 'none',
                        fontSize: 11,
                      }}>
                        CONVERGED
                      </Tag>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <Text style={{ fontSize: 11, color: PALETTE.textMuted, display: 'block' }}>
                    Iterations
                  </Text>
                  <span style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 14,
                    color: PALETTE.text,
                  }}>{result.iterations}</span>
                </div>
              </div>

              {/* Rate Cards */}
              <Row gutter={16} style={{ marginTop: 24 }}>
                <Col span={8}>
                  <div style={{
                    padding: '20px 24px',
                    background: PALETTE.surface,
                    borderRadius: 4,
                    border: `1px solid ${PALETTE.border}`,
                  }}>
                    <Text style={{ fontSize: 11, color: PALETTE.textMuted, display: 'block' }}>WEEK 1</Text>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                      <span style={{
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontSize: 32,
                        fontWeight: 600,
                        color: Math.abs(result.actualRates.week1 - 4) < 1 ? PALETTE.success : PALETTE.accent,
                      }}>
                        {result.actualRates.week1.toFixed(2)}
                      </span>
                      <span style={{ fontSize: 14, color: PALETTE.textMuted }}>%</span>
                    </div>
                    <Text style={{ fontSize: 11, color: PALETTE.textMuted }}>
                      Target: 4.00%
                    </Text>
                  </div>
                </Col>
                <Col span={8}>
                  <div style={{
                    padding: '20px 24px',
                    background: PALETTE.surface,
                    borderRadius: 4,
                    border: `1px solid ${PALETTE.border}`,
                  }}>
                    <Text style={{ fontSize: 11, color: PALETTE.textMuted, display: 'block' }}>WEEK 2</Text>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                      <span style={{
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontSize: 32,
                        fontWeight: 600,
                        color: Math.abs(result.actualRates.week2 - 4) < 1 ? PALETTE.success : PALETTE.accent,
                      }}>
                        {result.actualRates.week2.toFixed(2)}
                      </span>
                      <span style={{ fontSize: 14, color: PALETTE.textMuted }}>%</span>
                    </div>
                    <Text style={{ fontSize: 11, color: PALETTE.textMuted }}>
                      Target: 4.00%
                    </Text>
                  </div>
                </Col>
                <Col span={8}>
                  <div style={{
                    padding: '20px 24px',
                    background: PALETTE.surface,
                    borderRadius: 4,
                    border: `1px solid ${PALETTE.border}`,
                  }}>
                    <Text style={{ fontSize: 11, color: PALETTE.textMuted, display: 'block' }}>FULL COLLECTION</Text>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                      <span style={{
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontSize: 32,
                        fontWeight: 600,
                        color: PALETTE.text,
                      }}>
                        {result.fullCollectionRate.toFixed(2)}
                      </span>
                      <span style={{ fontSize: 14, color: PALETTE.textMuted }}>%</span>
                    </div>
                    <Text style={{ fontSize: 11, color: PALETTE.textMuted }}>
                      14 days
                    </Text>
                  </div>
                </Col>
              </Row>
            </div>

            {/* Coefficient Tables */}
            <div style={{ padding: '24px 32px' }}>
              <Row gutter={48}>
                <Col xs={24} lg={12}>
                  <div style={{ marginBottom: 16 }}>
                    <Text strong style={{ color: PALETTE.text, fontSize: 14 }}>
                      Week 1 Coefficients
                    </Text>
                    <Text style={{ fontSize: 12, color: PALETTE.textMuted, marginLeft: 8 }}>
                      应用于第一周的降权配置
                    </Text>
                  </div>
                  {renderCoefficients(setup.week1, setup.week2, result.week1)}
                </Col>
                <Col xs={24} lg={12}>
                  <div style={{ marginBottom: 16 }}>
                    <Text strong style={{ color: PALETTE.text, fontSize: 14 }}>
                      Week 2 Coefficients
                    </Text>
                    <Text style={{ fontSize: 12, color: PALETTE.textMuted, marginLeft: 8 }}>
                      应用于第二周的降权配置
                    </Text>
                  </div>
                  {renderCoefficients(setup.week2, setup.week1, result.week2)}
                </Col>
              </Row>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
