/**
 * 概率系数调控系统 - 全部使用中宋字体
 */

import { useState, useCallback, useMemo } from 'react';
import { Row, Col, message, Progress, Table, Tag, Select, InputNumber } from 'antd';
import type { CardSetup, WeeklyCombo, CoefficientResult, SolverProgress, CardCoefficients } from '@/types';
import { runSimulation, ALL_CARDS } from '@/services/simulationEngine';

const { Option } = Select;

// 全局字体
const FONT_DISPLAY = "'Noto Serif SC', 'Source Han Serif SC', 'SimSun', serif";
const FONT_MONO = "'IBM Plex Mono', 'SF Mono', monospace";

const PALETTE = {
  bg: '#F7F9F7', surface: '#FFFFFF', text: '#1a1a2e', textMuted: '#6b6b7b',
  border: '#e5e7eb', borderLight: '#f0f0f2', accent: '#511B3A',
  accentLight: '#f4f0f3', success: '#3d6b4a',
};

const CARD_META: Record<string, { type: 'magic' | 'rare' | 'common'; prob: number }> = {
  A: { type: 'magic', prob: 2 }, B: { type: 'rare', prob: 7 }, C: { type: 'rare', prob: 7 },
  D: { type: 'rare', prob: 7 }, E: { type: 'rare', prob: 7 }, F: { type: 'common', prob: 14 },
  G: { type: 'common', prob: 14 }, H: { type: 'common', prob: 14 },
  I: { type: 'common', prob: 14 }, J: { type: 'common', prob: 14 },
};

const TYPE_LABELS: Record<string, string> = { magic: '神奇', rare: '稀有', common: '普通' };

const DEFAULT_SETUP: CardSetup = {
  week1: { name: '第一周', cards: ['A', 'A', 'B'], deadline: 7 },
  week2: { name: '第二周', cards: ['H', 'H', 'I'], deadline: 14 },
  dailyDraws: 4,
};

// 顶部导航栏
function TopNav({ onNavigateToConfig, title }: { onNavigateToConfig?: () => void; title: string }) {
  return (
    <div style={{
      background: PALETTE.surface,
      borderBottom: `1px solid ${PALETTE.border}`,
      padding: '16px 24px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    }}>
      <div style={{ fontSize: 18, fontWeight: 600, color: PALETTE.text, fontFamily: FONT_DISPLAY }}>
        {title}
      </div>
      <div style={{ display: 'flex', gap: 16 }}>
        <button
          onClick={onNavigateToConfig}
          style={{
            color: PALETTE.textMuted,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontFamily: FONT_DISPLAY,
            fontSize: 14,
            padding: '8px 16px',
          }}
        >
          使用教程
        </button>
      </div>
    </div>
  );
}

// 配置难度指示器
function ConfigBalanceBar({ setup }: { setup: CardSetup }) {
  const analysis = useMemo(() => {
    const w1Cards = setup.week1.cards.length;
    const w2Cards = setup.week2.cards.length;
    const totalUnique = new Set([...setup.week1.cards, ...setup.week2.cards]).size;
    const w1Repeats = setup.week1.cards.length - new Set(setup.week1.cards).size;
    const w2Repeats = setup.week2.cards.length - new Set(setup.week2.cards).size;
    const baseScore = 30;
    const cardFactor = (w1Cards + w2Cards) * 8;
    const uniqueFactor = totalUnique * 5;
    const repeatPenalty = (w1Repeats + w2Repeats) * 15;
    let score = baseScore + cardFactor - uniqueFactor - repeatPenalty;
    score = Math.max(10, Math.min(95, score));
    let label = '适中', color = PALETTE.success;
    if (score < 25) { label = '极易'; color = '#8fb069'; }
    else if (score < 40) { label = '容易'; color = '#6b8e6b'; }
    else if (score > 70) { label = '困难'; color = PALETTE.accent; }
    else if (score > 55) { label = '偏难'; color = '#8b5a6b'; }
    return { score, label, color, details: `${w1Cards}张+${w2Cards}张 · ${totalUnique}种` };
  }, [setup]);

  return (
    <div style={{ background: PALETTE.surface, borderRadius: 4, padding: '20px 24px', border: `1px solid ${PALETTE.border}`, marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <span style={{ fontSize: 11, letterSpacing: '0.1em', color: PALETTE.textMuted, opacity: 0.7, fontFamily: FONT_DISPLAY }}>配置难度</span>
          <div style={{ fontSize: 13, color: PALETTE.textMuted, marginTop: 2, fontFamily: FONT_DISPLAY }}>{analysis.details}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: 32, fontWeight: 600, color: analysis.color, fontFamily: FONT_DISPLAY }}>
            {analysis.score}
          </span>
          <span style={{ fontSize: 12, color: PALETTE.textMuted, marginLeft: 4, fontFamily: FONT_DISPLAY }}>/ 一百</span>
        </div>
      </div>
      <div style={{ position: 'relative', height: 4, background: PALETTE.borderLight, borderRadius: 2 }}>
        <div style={{ position: 'absolute', left: 0, width: `${analysis.score}%`, height: '100%', background: analysis.color, borderRadius: 2, transition: 'all 0.4s ease' }} />
        {[25, 50, 75].map(pos => <div key={pos} style={{ position: 'absolute', left: `${pos}%`, top: -3, width: 1, height: 10, background: PALETTE.border }} />)}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontFamily: FONT_DISPLAY }}>
        <span style={{ fontSize: 11, color: PALETTE.textMuted }}>极易完成</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: analysis.color }}>{analysis.label}</span>
        <span style={{ fontSize: 11, color: PALETTE.textMuted }}>极难完成</span>
      </div>
    </div>
  );
}

// 卡牌标签
function CardToken({ card, count, isActive, isBase }: { card: string; count?: number; isActive?: boolean; isBase?: boolean }) {
  const meta = CARD_META[card];
  const typeColors = { magic: PALETTE.accent, rare: PALETTE.success, common: PALETTE.textMuted };
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: isBase ? '6px 12px' : '4px 10px', background: isActive ? PALETTE.accentLight : PALETTE.surface, border: `1px solid ${isBase ? typeColors[meta.type] : isActive ? PALETTE.accent : PALETTE.border}`, borderRadius: 3 }}>
      <span style={{ fontSize: 14, fontWeight: 600, color: isBase ? typeColors[meta.type] : PALETTE.text, fontFamily: FONT_MONO }}>{card}</span>
      {count && count > 1 && <span style={{ fontSize: 11, color: PALETTE.textMuted, fontFamily: FONT_DISPLAY }}>× {count}</span>}
      {isBase && <span style={{ fontSize: 9, color: typeColors[meta.type], opacity: 0.7, fontFamily: FONT_DISPLAY }}>×2</span>}
    </div>
  );
}

// 周配置面板
function WeekPanel({ title, subtitle, weekKey, combo, setup, onChange }: { title: string; subtitle: string; weekKey: 'week1' | 'week2'; combo: WeeklyCombo; setup: CardSetup; onChange: (newSetup: CardSetup) => void }) {
  const needs = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of combo.cards) map.set(c, (map.get(c) || 0) + 1);
    return map;
  }, [combo.cards]);

  const baseCard = combo.cards[0];
  const extraCards = combo.cards.slice(2);

  const setBase = (card: string) => {
    const current = [...combo.cards];
    const newCards = [card, card, ...current.filter(c => c !== baseCard)];
    onChange({ ...setup, [weekKey]: { ...combo, cards: newCards.slice(0, 5) } });
  };

  const addCard = () => {
    if (combo.cards.length >= 5) { message.warning('已达上限'); return; }
    const options = ALL_CARDS.filter(c => !combo.cards.includes(c) || c === baseCard);
    const newCard = options[0] || 'A';
    onChange({ ...setup, [weekKey]: { ...combo, cards: [...combo.cards, newCard] } });
  };

  const removeCard = (idx: number) => {
    const actualIdx = idx + 2;
    onChange({ ...setup, [weekKey]: { ...combo, cards: combo.cards.filter((_, i) => i !== actualIdx) } });
  };

  const changeCard = (idx: number, newCard: string) => {
    const actualIdx = idx + 2;
    const newCards = [...combo.cards];
    newCards[actualIdx] = newCard;
    onChange({ ...setup, [weekKey]: { ...combo, cards: newCards } });
  };

  return (
    <div style={{ background: PALETTE.surface, borderRadius: 4, border: `1px solid ${PALETTE.border}`, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${PALETTE.border}`, background: PALETTE.bg }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: PALETTE.text, marginBottom: 2, fontFamily: FONT_DISPLAY }}>{title}</div>
        <span style={{ fontSize: 12, color: PALETTE.textMuted, fontFamily: FONT_DISPLAY }}>{subtitle}</span>
      </div>

      <div style={{ padding: 20 }}>
        {/* 当前卡组明细 */}
        <div style={{ marginBottom: 16, padding: '12px 16px', background: PALETTE.bg, borderRadius: 4 }}>
          <span style={{ fontSize: 11, color: PALETTE.textMuted, opacity: 0.7, letterSpacing: '0.1em', display: 'block', marginBottom: 8, fontFamily: FONT_DISPLAY }}>当前卡组明细</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {combo.cards.map((card, idx) => (
              <span key={idx} style={{
                padding: '2px 8px',
                background: PALETTE.surface,
                borderRadius: 3,
                fontSize: 13,
                fontFamily: FONT_MONO,
                color: idx < 2 ? PALETTE.accent : PALETTE.text,
                border: `1px solid ${idx < 2 ? PALETTE.accent : PALETTE.border}`
              }}>
                {card} {idx < 2 && <span style={{ fontSize: 10, opacity: 0.6 }}>(基)</span>}
              </span>
            ))}
          </div>
        </div>

        {/* 基础卡 */}
        <div style={{ marginBottom: 20 }}>
          <span style={{ fontSize: 11, color: PALETTE.textMuted, opacity: 0.7, letterSpacing: '0.1em', display: 'block', marginBottom: 8, fontFamily: FONT_DISPLAY }}>基础卡牌（固定×2）</span>
          <Select value={baseCard} onChange={setBase} style={{ width: '100%' }} size="large" bordered={false}>
            {ALL_CARDS.map(c => (
              <Option key={c} value={c}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 3, background: CARD_META[c].type === 'magic' ? PALETTE.accent : CARD_META[c].type === 'rare' ? PALETTE.success : PALETTE.textMuted, color: '#fff', fontFamily: FONT_MONO, fontSize: 12, fontWeight: 600 }}>{c}</span>
                  <span style={{ fontFamily: FONT_DISPLAY }}>{TYPE_LABELS[CARD_META[c].type]}</span>
                  <span style={{ color: PALETTE.textMuted, fontFamily: FONT_DISPLAY }}>{CARD_META[c].prob}%</span>
                </div>
              </Option>
            ))}
          </Select>
          <div style={{ marginTop: 8 }}>
            <CardToken card={baseCard} count={2} isBase />
          </div>
        </div>

        {/* 扩展卡 */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 11, color: PALETTE.textMuted, opacity: 0.7, fontFamily: FONT_DISPLAY }}>扩展卡牌（{extraCards.length} / 3）</span>
            <button onClick={addCard} disabled={combo.cards.length >= 5} style={{ color: PALETTE.success, background: 'none', border: 'none', cursor: combo.cards.length >= 5 ? 'not-allowed' : 'pointer', opacity: combo.cards.length >= 5 ? 0.5 : 1, fontFamily: FONT_DISPLAY, fontSize: 13 }}>+ 添加</button>
          </div>

          {extraCards.length === 0 ? (
            <div style={{ padding: '20px 0', textAlign: 'center', color: PALETTE.textMuted, fontSize: 13, border: `1px dashed ${PALETTE.border}`, borderRadius: 4, fontFamily: FONT_DISPLAY }}>暂无扩展卡牌</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {extraCards.map((card, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: PALETTE.bg, borderRadius: 3 }}>
                  <Select value={card} onChange={(v) => changeCard(idx, v)} style={{ flex: 1 }} size="small" bordered={false}>
                    {ALL_CARDS.map(c => (
                      <Option key={c} value={c}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 600, fontFamily: FONT_MONO }}>{c}</span>
                          <span style={{ fontSize: 12, color: PALETTE.textMuted, fontFamily: FONT_DISPLAY }}>{TYPE_LABELS[CARD_META[c].type]} {CARD_META[c].prob}%</span>
                        </div>
                      </Option>
                    ))}
                  </Select>
                  <button onClick={() => removeCard(idx)} style={{ color: PALETTE.accent, background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 汇总统计 */}
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px dashed ${PALETTE.border}` }}>
          <span style={{ fontSize: 11, color: PALETTE.textMuted, opacity: 0.7, letterSpacing: '0.1em', display: 'block', marginBottom: 8, fontFamily: FONT_DISPLAY }}>卡牌统计</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {Array.from(needs.entries()).map(([card, count]) => (
              <CardToken key={card} card={card} count={count} isActive={count > 1} />
            ))}
          </div>
          {Array.from(needs.values()).some(n => n > 1) && (
            <div style={{ marginTop: 10, padding: '8px 12px', background: PALETTE.accentLight, borderRadius: 3, fontSize: 11, color: PALETTE.accent, fontFamily: FONT_DISPLAY }}>
              重复卡牌将于第2张起应用降权系数
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// 系数展示
function CoefficientDisplay({ value }: { value: number }) {
  const severity = value < 0.001 ? 'extreme' : value < 0.01 ? 'high' : value < 0.1 ? 'medium' : 'low';
  const colors = {
    extreme: { bg: PALETTE.accent, text: '#fff' },
    high: { bg: '#d4a5a5', text: PALETTE.accent },
    medium: { bg: '#e8f0e8', text: PALETTE.success },
    low: { bg: PALETTE.borderLight, text: PALETTE.textMuted },
  };
  const c = colors[severity];
  return <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', background: c.bg, color: c.text, borderRadius: 3, fontSize: 12, fontWeight: severity === 'extreme' ? 600 : 400, fontFamily: FONT_MONO }}>{value.toFixed(5)}</span>;
}

// 主组件
export function CardSelectionPage({ onNavigateToConfig }: { onNavigateToConfig?: () => void }) {
  const [setup, setSetup] = useState<CardSetup>(DEFAULT_SETUP);
  const [isCalculating, setIsCalculating] = useState(false);
  const [progress, setProgress] = useState<SolverProgress | null>(null);
  const [result, setResult] = useState<CoefficientResult | null>(null);
  const [showResults, setShowResults] = useState(false);

  const runSolve = useCallback(async () => {
    if (setup.week1.cards.length < 3 || setup.week2.cards.length < 3) { message.error('每周至少3张卡'); return; }
    setIsCalculating(true); setProgress(null); setResult(null);
    try {
      const coefficientResult = await runSimulation(setup, setProgress);
      setResult(coefficientResult); setShowResults(true);
    } catch (error) { message.error('求解失败'); }
    finally { setIsCalculating(false); }
  }, [setup]);

  // 系数表格
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
      return { key: card, card, type: CARD_META[card].type, demand, otherDemand, coeffs: cardCoeffs, hasReduction: demand > 1 || otherDemand > 1 };
    });

    return (
      <Table size="small" dataSource={data} pagination={false} style={{ fontSize: 13 }} columns={[
        { title: '卡牌', dataIndex: 'card', width: 60, render: (v: string) => <span style={{ fontWeight: 600, color: CARD_META[v].type === 'magic' ? PALETTE.accent : CARD_META[v].type === 'rare' ? PALETTE.success : PALETTE.textMuted, fontFamily: FONT_MONO }}>{v}</span> },
        { title: '类型', dataIndex: 'type', width: 70, render: (v: string) => <span style={{ fontFamily: FONT_DISPLAY }}>{TYPE_LABELS[v]}</span> },
        { title: '本周需求', dataIndex: 'demand', width: 90, align: 'right' as const, render: (v: number) => v > 0 ? <span style={{ fontFamily: FONT_MONO }}>{v}</span> : <span style={{ color: PALETTE.textMuted, fontFamily: FONT_DISPLAY }}>—</span> },
        { title: '跨周需求', dataIndex: 'otherDemand', width: 90, align: 'right' as const, render: (v: number, record: any) => v > 0 ? <span style={{ color: record.hasReduction ? PALETTE.accent : PALETTE.textMuted, fontFamily: FONT_MONO }}>{v}</span> : <span style={{ color: PALETTE.textMuted, fontFamily: FONT_DISPLAY }}>—</span> },
        { title: '降权系数', dataIndex: 'coeffs', render: (c: number[], record: any) => (
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={{ padding: '2px 6px', background: PALETTE.borderLight, borderRadius: 3, fontSize: 12, color: PALETTE.textMuted, fontFamily: FONT_MONO }}>1.0</span>
            {record.demand > 1 && <CoefficientDisplay value={c[1] || 0.01} />}
            {record.demand > 2 && <CoefficientDisplay value={c[2] || 0.01} />}
          </div>
        )},
      ]} />
    );
  };

  return (
    <div style={{ minHeight: '100vh', background: PALETTE.bg, fontFamily: FONT_DISPLAY }}>
      {/* 顶部导航栏 */}
      <TopNav onNavigateToConfig={onNavigateToConfig} title="概率系数调控系统" />

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px 48px' }}>

        {/* 标题区 */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 700, color: PALETTE.text, letterSpacing: '0.08em', fontFamily: FONT_DISPLAY }}>
            蒙特卡洛模拟求解最优降权系数
          </h1>
          <p style={{ margin: '12px 0 0', fontSize: 15, color: PALETTE.textMuted, fontFamily: FONT_DISPLAY }}>
            目标完成率 4% · 精准控制集齐概率
          </p>
        </div>

        <ConfigBalanceBar setup={setup} />

        {/* 周配置并排 */}
        <Row gutter={24} style={{ marginBottom: 24 }}>
          <Col xs={24} lg={12}>
            <WeekPanel title="第一周配置" subtitle="第 1 天至第 7 天" weekKey="week1" combo={setup.week1} setup={setup} onChange={setSetup} />
          </Col>
          <Col xs={24} lg={12}>
            <WeekPanel title="第二周配置" subtitle="第 8 天至第 14 天" weekKey="week2" combo={setup.week2} setup={setup} onChange={setSetup} />
          </Col>
        </Row>

        {/* 控制区 */}
        <div style={{ background: PALETTE.surface, borderRadius: 4, border: `1px solid ${PALETTE.border}`, padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div>
              <span style={{ fontSize: 11, color: PALETTE.textMuted, opacity: 0.7, letterSpacing: '0.1em', display: 'block', marginBottom: 4, fontFamily: FONT_DISPLAY }}>每日抽奖</span>
              <InputNumber min={1} max={10} value={setup.dailyDraws} onChange={(v) => v && setSetup({ ...setup, dailyDraws: v })} style={{ width: 80 }} />
            </div>
            <div style={{ padding: '6px 12px', background: PALETTE.bg, borderRadius: 3 }}>
              <span style={{ fontSize: 12, color: PALETTE.textMuted, fontFamily: FONT_DISPLAY }}>两周共计 {setup.dailyDraws * 14} 次抽奖</span>
            </div>
          </div>

          <div>
            <button onClick={runSolve} disabled={isCalculating} style={{ background: PALETTE.accent, color: '#fff', border: 'none', borderRadius: 4, height: 44, padding: '0 32px', fontWeight: 500, cursor: isCalculating ? 'wait' : 'pointer', opacity: isCalculating ? 0.7 : 1, fontFamily: FONT_DISPLAY, fontSize: 15 }}>
              {isCalculating ? '计算中...' : '开始求解'}
            </button>
          </div>
        </div>

        {/* 进度 */}
        {isCalculating && progress && (
          <div style={{ background: PALETTE.surface, borderRadius: 4, border: `1px solid ${PALETTE.border}`, padding: '24px 32px', marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: PALETTE.text, fontFamily: FONT_DISPLAY }}>
                {progress.iteration < 2 ? '第一阶段：粗网格搜索' : progress.iteration < 2.9 ? '第二阶段：细网格优化' : '第三阶段：最终验证'}
              </span>
              <span style={{ fontSize: 13, color: PALETTE.textMuted, fontFamily: FONT_MONO }}>{Math.round((progress.iteration / progress.totalIterations) * 100)}%</span>
            </div>
            <Progress percent={Math.round((progress.iteration / progress.totalIterations) * 100)} status="active" strokeColor={PALETTE.accent} trailColor={PALETTE.borderLight} showInfo={false} />
            <div style={{ display: 'flex', gap: 32, marginTop: 16 }}>
              <div><span style={{ fontSize: 11, color: PALETTE.textMuted, display: 'block', fontFamily: FONT_DISPLAY }}>第一周</span><span style={{ fontSize: 18, fontWeight: 600, color: PALETTE.text, fontFamily: FONT_MONO }}>{progress.week1Rate.toFixed(2)}%</span></div>
              <div><span style={{ fontSize: 11, color: PALETTE.textMuted, display: 'block', fontFamily: FONT_DISPLAY }}>第二周</span><span style={{ fontSize: 18, fontWeight: 600, color: PALETTE.text, fontFamily: FONT_MONO }}>{progress.week2Rate.toFixed(2)}%</span></div>
              <div><span style={{ fontSize: 11, color: PALETTE.textMuted, display: 'block', fontFamily: FONT_DISPLAY }}>误差</span><span style={{ fontSize: 18, fontWeight: 600, color: progress.error < 1 ? PALETTE.success : PALETTE.accent, fontFamily: FONT_MONO }}>{progress.error.toFixed(2)}</span></div>
            </div>
          </div>
        )}

        {/* 结果 */}
        {showResults && result && (
          <div style={{ background: PALETTE.surface, borderRadius: 4, border: `1px solid ${PALETTE.border}`, overflow: 'hidden' }}>
            <div style={{ padding: '24px 32px', borderBottom: `1px solid ${PALETTE.border}`, background: PALETTE.bg }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontSize: 11, color: PALETTE.textMuted, opacity: 0.7, letterSpacing: '0.1em', display: 'block', fontFamily: FONT_DISPLAY }}>求解结果</span>
                  <div style={{ fontSize: 22, fontWeight: 600, color: PALETTE.text, marginTop: 4, fontFamily: FONT_DISPLAY }}>求解完成</div>
                </div>
                {result.converged && <Tag style={{ background: PALETTE.success, color: '#fff', border: 'none', fontSize: 11, fontFamily: FONT_DISPLAY }}>已收敛</Tag>}
              </div>

              <Row gutter={16} style={{ marginTop: 24 }}>
                <Col span={8}>
                  <div style={{ padding: '20px 24px', background: PALETTE.surface, borderRadius: 4, border: `1px solid ${PALETTE.border}` }}>
                    <span style={{ fontSize: 11, color: PALETTE.textMuted, opacity: 0.7, letterSpacing: '0.1em', display: 'block', fontFamily: FONT_DISPLAY }}>第一周完成率</span>
                    <div style={{ marginTop: 4 }}>
                      <span style={{ fontSize: 32, fontWeight: 600, color: Math.abs(result.actualRates.week1 - 4) < 1 ? PALETTE.success : PALETTE.accent, fontFamily: FONT_MONO }}>{result.actualRates.week1.toFixed(2)}</span>
                      <span style={{ fontSize: 14, color: PALETTE.textMuted, marginLeft: 4, fontFamily: FONT_DISPLAY }}>%</span>
                    </div>
                    <span style={{ fontSize: 11, color: PALETTE.textMuted, fontFamily: FONT_DISPLAY }}>目标 4.00%</span>
                  </div>
                </Col>
                <Col span={8}>
                  <div style={{ padding: '20px 24px', background: PALETTE.surface, borderRadius: 4, border: `1px solid ${PALETTE.border}` }}>
                    <span style={{ fontSize: 11, color: PALETTE.textMuted, opacity: 0.7, letterSpacing: '0.1em', display: 'block', fontFamily: FONT_DISPLAY }}>第二周完成率</span>
                    <div style={{ marginTop: 4 }}>
                      <span style={{ fontSize: 32, fontWeight: 600, color: Math.abs(result.actualRates.week2 - 4) < 1 ? PALETTE.success : PALETTE.accent, fontFamily: FONT_MONO }}>{result.actualRates.week2.toFixed(2)}</span>
                      <span style={{ fontSize: 14, color: PALETTE.textMuted, marginLeft: 4, fontFamily: FONT_DISPLAY }}>%</span>
                    </div>
                    <span style={{ fontSize: 11, color: PALETTE.textMuted, fontFamily: FONT_DISPLAY }}>目标 4.00%</span>
                  </div>
                </Col>
                <Col span={8}>
                  <div style={{ padding: '20px 24px', background: PALETTE.surface, borderRadius: 4, border: `1px solid ${PALETTE.border}` }}>
                    <span style={{ fontSize: 11, color: PALETTE.textMuted, opacity: 0.7, letterSpacing: '0.1em', display: 'block', fontFamily: FONT_DISPLAY }}>全收集完成率</span>
                    <div style={{ marginTop: 4 }}>
                      <span style={{ fontSize: 32, fontWeight: 600, color: PALETTE.text, fontFamily: FONT_MONO }}>{result.fullCollectionRate.toFixed(2)}</span>
                      <span style={{ fontSize: 14, color: PALETTE.textMuted, marginLeft: 4, fontFamily: FONT_DISPLAY }}>%</span>
                    </div>
                    <span style={{ fontSize: 11, color: PALETTE.textMuted, fontFamily: FONT_DISPLAY }}>十四天期限</span>
                  </div>
                </Col>
              </Row>
            </div>

            <div style={{ padding: '24px 32px' }}>
              <Row gutter={48}>
                <Col xs={24} lg={12}>
                  <div style={{ marginBottom: 16 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: PALETTE.text, fontFamily: FONT_DISPLAY }}>第一周系数</span>
                    <span style={{ fontSize: 12, color: PALETTE.textMuted, marginLeft: 8, fontFamily: FONT_DISPLAY }}>第一周卡组降权配置</span>
                  </div>
                  {renderCoefficients(setup.week1, setup.week2, result.week1)}
                </Col>
                <Col xs={24} lg={12}>
                  <div style={{ marginBottom: 16 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: PALETTE.text, fontFamily: FONT_DISPLAY }}>第二周系数</span>
                    <span style={{ fontSize: 12, color: PALETTE.textMuted, marginLeft: 8, fontFamily: FONT_DISPLAY }}>第二周卡组降权配置</span>
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
