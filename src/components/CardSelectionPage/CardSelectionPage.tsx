 /**
 * 🎴 卡面选择页（单按钮版）
 */

import { useState, useCallback } from 'react';
import {
  Row, Col, Card as AntCard, Button, Space, Typography,
  message, Progress, Table, Tag, Select, Divider, Alert, Tabs,
} from 'antd';
import {
  CalculatorOutlined, PlusOutlined, DeleteOutlined, CheckCircleOutlined,
  TrophyOutlined, QuestionCircleOutlined, TableOutlined,
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

const DEFAULT_SETUP: CardSetup = {
  week1: {
    name: '第一周',
    cards: ['A', 'A', 'B'],
    deadline: 7,
  },
  week2: {
    name: '第二周',
    cards: ['C', 'C', 'C', 'D', 'E'],
    deadline: 14,
  },
};

const MIN_CARDS = 2;
const MAX_CARDS = 5;

interface CardSelectionPageProps {
  onNavigateToConfig?: () => void;
}

export function CardSelectionPage({ onNavigateToConfig }: CardSelectionPageProps) {
  const [setup, setSetup] = useState<CardSetup>(DEFAULT_SETUP);
  const [isCalculating, setIsCalculating] = useState(false);
  const [progress, setProgress] = useState<SolverProgress | null>(null);
  const [result, setResult] = useState<CoefficientResult | null>(null);
  const [activeTab, setActiveTab] = useState('week1');

  const countNeeds = (cards: string[]): Map<string, number> => {
    const needs = new Map<string, number>();
    for (const card of cards) {
      needs.set(card, (needs.get(card) || 0) + 1);
    }
    return needs;
  };

  const updateWeek = useCallback((week: 'week1' | 'week2', updates: Partial<WeeklyCombo>) => {
    setSetup(prev => ({ ...prev, [week]: { ...prev[week], ...updates } }));
    if (result) setResult(null);
  }, [result]);

  const addCardToWeek = useCallback((week: 'week1' | 'week2') => {
    setSetup(prev => {
      const current = prev[week].cards;
      if (current.length >= MAX_CARDS) {
        message.warning(`每周最多 ${MAX_CARDS} 张卡`);
        return prev;
      }
      return { ...prev, [week]: { ...prev[week], cards: [...current, 'A'] } };
    });
    if (result) setResult(null);
  }, [result]);

  const removeCardFromWeek = useCallback((week: 'week1' | 'week2', index: number) => {
    setSetup(prev => {
      const current = prev[week].cards;
      if (current.length <= MIN_CARDS) {
        message.warning(`每周最少 ${MIN_CARDS} 张卡`);
        return prev;
      }
      return { ...prev, [week]: { ...prev[week], cards: current.filter((_, i) => i !== index) } };
    });
    if (result) setResult(null);
  }, [result]);

  const updateCard = useCallback((week: 'week1' | 'week2', index: number, cardId: string) => {
    setSetup(prev => ({
      ...prev,
      [week]: { ...prev[week], cards: prev[week].cards.map((c, i) => i === index ? cardId : c) },
    }));
    if (result) setResult(null);
  }, [result]);

  const runSolve = useCallback(async () => {
    if (setup.week1.cards.length < MIN_CARDS || setup.week1.cards.length > MAX_CARDS) {
      message.error(`第一周需要 ${MIN_CARDS}-${MAX_CARDS} 张卡`);
      return;
    }
    if (setup.week2.cards.length < MIN_CARDS || setup.week2.cards.length > MAX_CARDS) {
      message.error(`第二周需要 ${MIN_CARDS}-${MAX_CARDS} 张卡`);
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
        message.success(`求解成功！两周中奖率均接近 4%`);
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

  const getCardLabel = (card: string, index: number) => (
    <Tag
      key={index}
      color={card === 'A' ? 'purple' : ['B', 'C', 'D', 'E'].includes(card) ? 'blue' : 'green'}
      style={{ margin: 2, fontSize: 14 }}
    >
      {card}
    </Tag>
  );

  const renderWeekConfig = (weekKey: 'week1' | 'week2', weekData: WeeklyCombo, color: string) => {
    const needs = countNeeds(weekData.cards);
    const totalCards = weekData.cards.length;
    const coeffCount = totalCards - 1;

    return (
      <div style={{ border: `2px solid ${color}`, borderRadius: 12, padding: 16, backgroundColor: `${color}10` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <Space>
            <Text strong style={{ color, fontSize: 16 }}>{weekData.name}</Text>
            <Tag color={color}>第 {weekData.deadline} 天截止</Tag>
          </Space>
          <Text type="secondary">{totalCards} 张卡 → {coeffCount} 个系数</Text>
        </div>

        <Space wrap>
          {weekData.cards.map((card, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: 4, background: '#fff', borderRadius: 6, border: `1px solid ${CARD_COLORS[card]}` }}>
              <Select value={card} onChange={(v) => updateCard(weekKey, idx, v)} style={{ width: 60 }} size="small" bordered={false}>
                {ALL_CARDS.map(c => (
                  <Option key={c} value={c}>
                    <Tag color={c === 'A' ? 'purple' : ['B','C','D','E'].includes(c) ? 'blue' : 'green'}>{c}</Tag>
                  </Option>
                ))}
              </Select>
              <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeCardFromWeek(weekKey, idx)} />
            </div>
          ))}
          {weekData.cards.length < MAX_CARDS && (
            <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={() => addCardToWeek(weekKey)}>添加</Button>
          )}
        </Space>

        <div style={{ marginTop: 8, fontSize: 13, color: '#666' }}>
          需求：{Array.from(needs.entries()).map(([card, n]) => `${card}×${n}`).join(', ')}
        </div>
      </div>
    );
  };

  const renderCoefficientTable = (title: string, coeffsData: Record<string, CardCoefficients>, color: string) => {
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
          pagination={false}
          columns={[
            { title: '卡牌', dataIndex: 'card', width: 80, render: (v: string) => <Tag color={CARD_COLORS[v]}>{v}</Tag> },
            { title: '类型', dataIndex: 'type', width: 80 },
            {
              title: '降权系数',
              dataIndex: 'coeffs',
              render: (coeffs: number[]) => (
                <Space>
                  {coeffs.map((c, i) => (
                    <Tag key={i} color={i === 0 ? 'success' : c < 0.02 ? 'error' : 'warning'}>
                      持{i+1}: {i === 0 ? '1.0' : c.toFixed(3)}
                    </Tag>
                  ))}
                  <Tag color="default">≥{coeffs.length+1}张=0</Tag>
                </Space>
              ),
            },
          ]}
        />
      </div>
    );
  };

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>🎴 神奇物种发卡概率系统</Title>
        <Paragraph type="secondary">配置两周卡组，自动求解降权系数</Paragraph>
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

              {/* 进度条 */}
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

          {/* 结果摘要 */}
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
                    卡组：{setup.week1.cards.map((c, i) => getCardLabel(c, i))}
                  </Paragraph>
                  {renderCoefficientTable('第一周降权系数', result.week1, '#52c41a')}
                </TabPane>

                <TabPane tab={<span><TrophyOutlined /> 第二周系数</span>} key="week2">
                  <Paragraph type="secondary">
                    卡组：{setup.week2.cards.map((c, i) => getCardLabel(c, i))}
                  </Paragraph>
                  {renderCoefficientTable('第二周降权系数', result.week2, '#1890ff')}
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
