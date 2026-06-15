/**
 * 🎴 卡面选择页（反向求解版 - 两周独立配置）
 *
 * 核心功能：
 * 1. 第一周配置（2-5 张卡，可重复）
 * 2. 第二周配置（2-5 张卡，可重复）
 * 3. 反向求解降权系数（按持有数量分层）
 * 4. 验证两周中奖率均≈4%
 */

import { useState, useCallback } from 'react';
import {
  Row, Col, Card as AntCard, Button, Space, Typography,
  message, Progress, Table, Tag, Select, Divider, Alert, Tabs, Statistic, Tooltip,
} from 'antd';
import {
  CalculatorOutlined, PlusOutlined, DeleteOutlined, CheckCircleOutlined,
  TrophyOutlined, QuestionCircleOutlined, TableOutlined, BarChartOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import type { CardSetup, WeeklyCombo, CoefficientResult, SolverProgress, CardCoefficients } from '@/types';
import {
  runFullSimulationAsync,
  runQuickSimulation,
  ALL_CARDS,
  generateCases,
  generateProbabilityTables,
  getCardType,
  getBaseProb,
} from '@/services/simulationEngine';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;

// 卡片颜色配置
const CARD_COLORS: Record<string, string> = {
  'A': '#722ed1',  // 神奇 - 紫色
  'B': '#1890ff', 'C': '#1890ff', 'D': '#1890ff', 'E': '#1890ff',  // 稀有 - 蓝色
  'F': '#52c41a', 'G': '#52c41a', 'H': '#52c41a', 'I': '#52c41a', 'J': '#52c41a',  // 普通 - 绿色
};

// 默认配置
const DEFAULT_SETUP: CardSetup = {
  week1: {
    name: '第一周',
    cards: ['A', 'A', 'B'],  // 需要 A×2 + B×1
    deadline: 7,
  },
  week2: {
    name: '第二周',
    cards: ['C', 'C', 'C', 'D', 'E'],  // 需要 C×3 + D×1 + E×1
    deadline: 14,
  },
};

// 卡槽范围
const MIN_CARDS = 2;
const MAX_CARDS = 5;

interface CardSelectionPageProps {
  onNavigateToConfig?: () => void;
}

export function CardSelectionPage({ onNavigateToConfig }: CardSelectionPageProps) {
  // 两周卡组配置
  const [setup, setSetup] = useState<CardSetup>(DEFAULT_SETUP);

  // 求解状态
  const [isCalculating, setIsCalculating] = useState(false);
  const [isQuickMode, setIsQuickMode] = useState(false);
  const [progress, setProgress] = useState<SolverProgress | null>(null);
  const [result, setResult] = useState<CoefficientResult | null>(null);
  const [activeTab, setActiveTab] = useState('week1');

  // 统计卡牌需求（用于显示）
  const countNeeds = (cards: string[]): Map<string, number> => {
    const needs = new Map<string, number>();
    for (const card of cards) {
      needs.set(card, (needs.get(card) || 0) + 1);
    }
    return needs;
  };

  // 更新某周配置
  const updateWeek = useCallback((week: 'week1' | 'week2', updates: Partial<WeeklyCombo>) => {
    setSetup(prev => ({
      ...prev,
      [week]: { ...prev[week], ...updates },
    }));
    // 清除旧结果
    if (result) setResult(null);
  }, [result]);

  // 添加卡牌到某周
  const addCardToWeek = useCallback((week: 'week1' | 'week2') => {
    setSetup(prev => {
      const currentCards = prev[week].cards;
      if (currentCards.length >= MAX_CARDS) {
        message.warning(`每周最多 ${MAX_CARDS} 张卡`);
        return prev;
      }
      return {
        ...prev,
        [week]: {
          ...prev[week],
          cards: [...currentCards, 'A'],
        },
      };
    });
    if (result) setResult(null);
  }, [result]);

  // 从某周删除卡牌
  const removeCardFromWeek = useCallback((week: 'week1' | 'week2', index: number) => {
    setSetup(prev => {
      const currentCards = prev[week].cards;
      if (currentCards.length <= MIN_CARDS) {
        message.warning(`每周最少 ${MIN_CARDS} 张卡`);
        return prev;
      }
      return {
        ...prev,
        [week]: {
          ...prev[week],
          cards: currentCards.filter((_, i) => i !== index),
        },
      };
    });
    if (result) setResult(null);
  }, [result]);

  // 修改某张卡牌
  const updateCard = useCallback((week: 'week1' | 'week2', index: number, cardId: string) => {
    setSetup(prev => ({
      ...prev,
      [week]: {
        ...prev[week],
        cards: prev[week].cards.map((c, i) => i === index ? cardId : c),
      },
    }));
    if (result) setResult(null);
  }, [result]);

  // 运行求解
  const runSolve = useCallback(async (quick: boolean = false) => {
    // 验证配置
    if (setup.week1.cards.length < MIN_CARDS || setup.week1.cards.length > MAX_CARDS) {
      message.error(`第一周需要 ${MIN_CARDS}-${MAX_CARDS} 张卡`);
      return;
    }
    if (setup.week2.cards.length < MIN_CARDS || setup.week2.cards.length > MAX_CARDS) {
      message.error(`第二周需要 ${MIN_CARDS}-${MAX_CARDS} 张卡`);
      return;
    }

    setIsCalculating(true);
    setIsQuickMode(quick);
    setProgress(null);
    setResult(null);

    try {
      const coefficientResult = quick
        ? await runQuickSimulation(setup, 4.0, (p: SolverProgress) => setProgress(p))
        : await runFullSimulationAsync(setup, 4.0, 30000, (p: SolverProgress) => setProgress(p));

      setResult(coefficientResult);

      const error1 = Math.abs(coefficientResult.actualRates.week1 - 4.0);
      const error2 = Math.abs(coefficientResult.actualRates.week2 - 4.0);

      if (coefficientResult.converged && error1 < 0.2 && error2 < 0.2) {
        message.success(`求解成功！两周中奖率均接近 4%`);
      } else if (coefficientResult.converged) {
        message.warning(`已收敛，但误差稍大（${Math.max(error1, error2).toFixed(2)}%）`);
      } else {
        message.warning(`未完全收敛，当前最佳结果已显示`);
      }
    } catch (error) {
      message.error('求解失败: ' + String(error));
    } finally {
      setIsCalculating(false);
    }
  }, [setup]);

  // 获取概率表数据
  const probTables = result ? generateProbabilityTables(setup, result) : null;
  const cases = result ? generateCases(setup, result) : [];

  // 获取某张卡的显示标签
  const getCardLabel = (card: string, index: number) => (
    <Tag
      key={index}
      color={card === 'A' ? 'purple' : ['B', 'C', 'D', 'E'].includes(card) ? 'blue' : 'green'}
      style={{ margin: 2, fontSize: 14, padding: '2px 8px' }}
    >
      {card}
    </Tag>
  );

  // 渲染单周配置器
  const renderWeekConfig = (weekKey: 'week1' | 'week2', weekData: WeeklyCombo, color: string) => {
    const needs = countNeeds(weekData.cards);
    const totalCards = weekData.cards.length;
    const coeffCount = totalCards - 1;  // n 张卡 → n-1 个系数

    return (
      <div
        style={{
          border: `2px solid ${color}`,
          borderRadius: 12,
          padding: 16,
          backgroundColor: `${color}10`,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Space>
            <Text strong style={{ color, fontSize: 16 }}>{weekData.name}</Text>
            <Tag color={color}>第 {weekData.deadline} 天截止</Tag>
          </Space>
          <Text type="secondary">共 {totalCards} 张卡（需 {coeffCount} 个降权系数）</Text>
        </div>

        {/* 卡槽 */}
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>卡组配置（可重复）：</Text>
          <Space wrap>
            {weekData.cards.map((card, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 8px',
                  backgroundColor: '#fff',
                  borderRadius: 6,
                  border: `1px solid ${CARD_COLORS[card]}`,
                }}
              >
                <Select
                  value={card}
                  onChange={(v) => updateCard(weekKey, idx, v)}
                  style={{ width: 60 }}
                  size="small"
                  bordered={false}
                >
                  {ALL_CARDS.map(c => (
                    <Option key={c} value={c}>
                      <Tag color={c === 'A' ? 'purple' : ['B', 'C', 'D', 'E'].includes(c) ? 'blue' : 'green'}>{c}</Tag>
                    </Option>
                  ))}
                </Select>
                <Button
                  type="text"
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={() => removeCardFromWeek(weekKey, idx)}
                />
              </div>
            ))}
            {weekData.cards.length < MAX_CARDS && (
              <Button
                type="dashed"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => addCardToWeek(weekKey)}
              >
                添加卡槽
              </Button>
            )}
          </Space>
        </div>

        {/* 需求汇总 */}
        <div style={{ fontSize: 13, color: '#666' }}>
          <Text strong>需求汇总：</Text>
          {Array.from(needs.entries()).map(([card, need]) => (
            <span key={card} style={{ marginRight: 12 }}>
              {card}×{need}
            </span>
          ))}
          <span style={{ marginLeft: 8 }}>(共需 {Array.from(needs.values()).reduce((a, b) => a + b, 0)} 张)</span>
        </div>
      </div>
    );
  };

  // 渲染降权系数表
  const renderCoefficientTable = (title: string, coeffsData: Record<string, CardCoefficients>, color: string) => {
    const columns = [
      { title: '卡牌', dataIndex: 'card', width: 80, render: (v: string) => <Tag color={CARD_COLORS[v]}>{v}</Tag> },
      { title: '类型', dataIndex: 'type', width: 80 },
      { title: '需求', dataIndex: 'needs', width: 80 },
      {
        title: '降权系数（按持有数量）',
        dataIndex: 'coeffs',
        render: (coeffs: number[]) => (
          <Space>
            {coeffs.map((c, i) => (
              <Tooltip key={i} title={`持有 ${i + 1} 张时的系数`}>
                <Tag
                  color={i === 0 ? 'success' : c < 0.02 ? 'error' : 'warning'}
                  style={{ fontSize: 13, padding: '2px 8px' }}
                >
                  {i === 0 ? '1.0' : c.toFixed(3)}
                </Tag>
              </Tooltip>
            ))}
            <Tag color="default">≥{coeffs.length + 1}张=0</Tag>
          </Space>
        ),
      },
    ];

    const dataSource = Object.entries(coeffsData).map(([card, coeffs]) => ({
      key: card,
      card,
      type: getCardType(card) === 'magic' ? '神奇' : getCardType(card) === 'rare' ? '稀有' : '普通',
      needs: coeffs.length + 1,
      coeffs,
    }));

    return (
      <div style={{ marginBottom: 24 }}>
        <Title level={5} style={{ color }}>{title}</Title>
        <Table
          size="small"
          bordered
          dataSource={dataSource}
          columns={columns}
          pagination={false}
        />
      </div>
    );
  };

  return (
    <div style={{ padding: '24px', maxWidth: 1400, margin: '0 auto' }}>
      {/* 标题 */}
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>🎴 神奇物种发卡概率系统 - 反向求解</Title>
        <Paragraph type="secondary">
          配置两周的卡组（2-5 张，可重复），系统自动求解降权系数，确保每周中奖率≈4%
        </Paragraph>
      </div>

      <Row gutter={[24, 24]}>
        {/* 左侧：配置器 */}
        <Col xs={24} lg={10}>
          <AntCard
            title="卡组配置"
            bordered={false}
            extra={
              <Space>
                <Button
                  onClick={() => runSolve(true)}
                  loading={isCalculating && isQuickMode}
                  disabled={isCalculating && !isQuickMode}
                >
                  快速测算
                </Button>
                <Button
                  type="primary"
                  icon={<CalculatorOutlined />}
                  onClick={() => runSolve(false)}
                  loading={isCalculating && !isQuickMode}
                  disabled={isCalculating && isQuickMode}
                >
                  精确测算
                </Button>
              </Space>
            }
          >
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              {/* 第一周配置 */}
              {renderWeekConfig('week1', setup.week1, '#52c41a')}

              {/* 第二周配置 */}
              {renderWeekConfig('week2', setup.week2, '#1890ff')}

              {/* 计算进度 */}
              {isCalculating && progress && (
                <div style={{ padding: 16, backgroundColor: '#f5f5f5', borderRadius: 8 }}>
                  <Progress
                    percent={Math.round((progress.iteration / progress.totalIterations) * 100)}
                    status="active"
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                    <Text type="secondary">
                      迭代 {progress.iteration}/{progress.totalIterations}
                    </Text>
                    <Text type="secondary">
                      第一周: {progress.week1Rate.toFixed(2)}% | 第二周: {progress.week2Rate.toFixed(2)}%
                    </Text>
                  </div>
                  <div style={{ marginTop: 4, fontSize: 12, color: '#888' }}>
                    蒙特卡洛模拟 + 梯度下降优化 | 目标: 两周均达 4%
                  </div>
                </div>
              )}
            </Space>
          </AntCard>

          {/* 核心规则说明 */}
          <AntCard style={{ marginTop: 16 }} bordered={false}>
            <Alert
              message="📖 降权系数规则"
              description={
                <div style={{ fontSize: 13 }}>
                  <p><strong>核心逻辑：</strong>每周独立配置，持有某周卡组中的卡时，该周抽卡概率会降权</p>
                  <p>• <strong>n 张卡组</strong> → 输出 <strong>n-1 个系数</strong>（第 1 张固定=1.0）</p>
                  <p>• <strong>持有≥n+1 张</strong> → 该卡概率=<strong>0</strong>（不再掉落）</p>
                  <p>• <strong>跨周控制</strong>：第一周不降权第二周的卡，反之亦然</p>
                </div>
              }
              type="info"
              showIcon
            />
          </AntCard>

          {/* 结果摘要 */}
          {result && (
            <AntCard style={{ marginTop: 16 }} bordered={false}>
              <Row gutter={16}>
                <Col span={8}>
                  <div style={{ textAlign: 'center' }}>
                    <Text type="secondary">第一周中奖率</Text>
                    <div style={{
                      fontSize: 28,
                      fontWeight: 'bold',
                      color: Math.abs(result.actualRates.week1 - 4.0) < 0.2 ? '#52c41a' : '#fa8c16',
                    }}>
                      {result.actualRates.week1.toFixed(2)}%
                    </div>
                    <div style={{ fontSize: 12, color: '#888' }}>目标: 4% (7天)</div>
                  </div>
                </Col>
                <Col span={8}>
                  <div style={{ textAlign: 'center' }}>
                    <Text type="secondary">第二周中奖率</Text>
                    <div style={{
                      fontSize: 28,
                      fontWeight: 'bold',
                      color: Math.abs(result.actualRates.week2 - 4.0) < 0.2 ? '#1890ff' : '#fa8c16',
                    }}>
                      {result.actualRates.week2.toFixed(2)}%
                    </div>
                    <div style={{ fontSize: 12, color: '#888' }}>目标: 4% (14天)</div>
                  </div>
                </Col>
                <Col span={8}>
                  <div style={{ textAlign: 'center' }}>
                    <Text type="secondary">14天全收集率</Text>
                    <div style={{ fontSize: 28, fontWeight: 'bold', color: '#722ed1' }}>
                      {result.fullCollectionRate.toFixed(2)}%
                    </div>
                    <div style={{ fontSize: 12, color: '#888' }}>集齐 10 张卡</div>
                  </div>
                </Col>
              </Row>

              {!result.converged && (
                <Alert
                  message="求解未完全收敛"
                  description={`建议尝试精确测算或调整卡组配置（当前误差 ${result.finalError.toFixed(2)}%）`}
                  type="warning"
                  showIcon
                  style={{ marginTop: 16 }}
                />
              )}
            </AntCard>
          )}
        </Col>

        {/* 右侧：详细结果 */}
        <Col xs={24} lg={14}>
          {result ? (
            <AntCard bordered={false}>
              <Tabs activeKey={activeTab} onChange={setActiveTab}>
                {/* 第一周系数 */}
                <TabPane
                  tab={<span><TrophyOutlined /> 第一周降权系数</span>}
                  key="week1"
                >
                  <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                    卡组：{setup.week1.cards.map((c, i) => getCardLabel(c, i))}
                    <span style={{ marginLeft: 8 }}>({setup.week1.cards.length}张卡 → {setup.week1.cards.length - 1}个系数)</span>
                  </Paragraph>

                  {renderCoefficientTable('第一周降权系数表', result.week1, '#52c41a')}

                  <Alert
                    message="系数解释"
                    description={
                      <div style={{ fontSize: 13 }}>
                        <p>• <strong>索引 0（1.0）：</strong>持有 1 张时不降权</p>
                        <p>• <strong>后续系数：</strong>持有 2 张、3 张...时的降权比例</p>
                        <p>• <strong>持有≥{Math.max(...Object.values(result.week1).map((c: number[]) => c.length)) + 1}张：</strong>该卡概率=0</p>
                      </div>
                    }
                    type="info"
                    showIcon
                  />
                </TabPane>

                {/* 第二周系数 */}
                <TabPane
                  tab={<span><TrophyOutlined /> 第二周降权系数</span>}
                  key="week2"
                >
                  <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                    卡组：{setup.week2.cards.map((c, i) => getCardLabel(c, i))}
                    <span style={{ marginLeft: 8 }}>({setup.week2.cards.length}张卡 → {setup.week2.cards.length - 1}个系数)</span>
                  </Paragraph>

                  {renderCoefficientTable('第二周降权系数表', result.week2, '#1890ff')}

                  <Alert
                    message="跨周控制说明"
                    description={
                      <div style={{ fontSize: 13 }}>
                        <p>• 第一周抽卡时，只有第一周卡组的卡会应用降权</p>
                        <p>• 第二周的卡在第一周不降权（正常概率）</p>
                        <p>• 反之亦然，实现两周独立控制</p>
                      </div>
                    }
                    type="info"
                    showIcon
                  />
                </TabPane>

                {/* 基础概率 */}
                <TabPane
                  tab={<span><TableOutlined /> 基础概率表</span>}
                  key="base"
                >
                  <Title level={5}>卡片基础概率</Title>
                  <Table
                    size="small"
                    bordered
                    dataSource={ALL_CARDS.map(card => ({
                      card,
                      type: getCardType(card) === 'magic' ? '神奇' : getCardType(card) === 'rare' ? '稀有' : '普通',
                      prob: `${getBaseProb(card)}%`,
                    }))}
                    pagination={false}
                    columns={[
                      { title: '卡牌', dataIndex: 'card', render: (v: string) => <Tag color={CARD_COLORS[v]}>{v}</Tag> },
                      { title: '类型', dataIndex: 'type' },
                      { title: '基础概率', dataIndex: 'prob' },
                    ]}
                  />
                </TabPane>

                {/* 案例 */}
                <TabPane
                  tab={<span><QuestionCircleOutlined /> 应用案例</span>}
                  key="cases"
                >
                  <Table
                    size="small"
                    dataSource={cases}
                    pagination={false}
                    columns={[
                      { title: '案例', dataIndex: 'name', width: 120 },
                      { title: '背包状态', dataIndex: 'description' },
                      { title: '预期表现', dataIndex: 'expectedSuccess' },
                    ]}
                  />
                </TabPane>
              </Tabs>
            </AntCard>
          ) : (
            <AntCard bordered={false} style={{ textAlign: 'center', padding: 64 }}>
              <CalculatorOutlined style={{ fontSize: 64, color: '#d9d9d9' }} />
              <Title level={4} style={{ marginTop: 24, color: '#999' }}>
                点击"快速测算"或"精确测算"生成降权系数
              </Title>
              <Paragraph type="secondary">
                系统将自动计算满足两周均≈4%中奖率的降权系数
              </Paragraph>

              <Divider />

              <div style={{ textAlign: 'left', maxWidth: 500, margin: '0 auto' }}>
                <Title level={5}>测算模式对比</Title>
                <Paragraph>
                  <InfoCircleOutlined style={{ marginRight: 8 }} />
                  <strong>快速测算：</strong>约 5-10 秒，迭代 20 次，适合预览
                </Paragraph>
                <Paragraph>
                  <CheckCircleOutlined style={{ marginRight: 8 }} />
                  <strong>精确测算：</strong>约 30-60 秒，迭代 50 次，结果更稳定
                </Paragraph>
              </div>
            </AntCard>
          )}
        </Col>
      </Row>

      {/* 底部导航 */}
      {onNavigateToConfig && (
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <Button type="default" size="large" onClick={onNavigateToConfig}>
            查看概率配置详情
          </Button>
        </div>
      )}
    </div>
  );
}
