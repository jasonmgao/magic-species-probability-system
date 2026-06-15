/**
 * 卡面选择页（反向求解版）
 * 输入：两套组合配置
 * 输出：
 *  1. 降权系数（缺3/2/1张）
 *  2. 组合中奖率
 *  3. 14天全收集概率
 *  4. 概率配置表和案例
 */

import { useState, useCallback } from 'react';
import {
  Row, Col, Card as AntCard, Button, Space, Typography,
  message, Progress, Table, Tag, InputNumber, Select, Divider, Alert, Tabs
} from 'antd';
import {
  CalculatorOutlined, SettingOutlined, PlusOutlined,
  DeleteOutlined, CheckCircleOutlined, TrophyOutlined,
  QuestionCircleOutlined, TableOutlined
} from '@ant-design/icons';
import type { Combination, CoefficientResult } from '@/types';
import {
  runFullSimulationAsync,
  ALL_CARDS,
  generateCases,
  generateProbabilityTables
} from '@/services/simulationEngine';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;

// 默认配置：AaB 和 CcD
const DEFAULT_COMBINATIONS: Combination[] = [
  {
    name: '第一套（AaB）',
    requirements: [
      { cardId: 'A', count: 2 },
      { cardId: 'B', count: 1 },
    ],
    deadline: 7,
  },
  {
    name: '第二套（CcD）',
    requirements: [
      { cardId: 'C', count: 2 },
      { cardId: 'D', count: 1 },
    ],
    deadline: 14,
  },
];

interface CardSelectionPageProps {
  onNavigateToConfig?: () => void;
}

export function CardSelectionPage({ onNavigateToConfig }: CardSelectionPageProps) {
  // 组合配置
  const [combinations, setCombinations] = useState<Combination[]>(DEFAULT_COMBINATIONS);

  // 模拟状态
  const [isCalculating, setIsCalculating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<CoefficientResult | null>(null);
  const [activeTab, setActiveTab] = useState('coefficients');

  // 更新组合
  const updateCombination = useCallback((index: number, updates: Partial<Combination>) => {
    setCombinations(prev => prev.map((combo, i) =>
      i === index ? { ...combo, ...updates } : combo
    ));
  }, []);

  // 更新卡片需求
  const updateRequirement = useCallback((
    comboIndex: number,
    reqIndex: number,
    updates: { cardId?: string; count?: number }
  ) => {
    setCombinations(prev => prev.map((combo, i) => {
      if (i !== comboIndex) return combo;
      return {
        ...combo,
        requirements: combo.requirements.map((req, j) =>
          j === reqIndex ? { ...req, ...updates } : req
        ),
      };
    }));
  }, []);

  // 添加卡片到组合
  const addCardToCombo = useCallback((comboIndex: number) => {
    setCombinations(prev => prev.map((combo, i) => {
      if (i !== comboIndex) return combo;
      // 找出未使用的卡片
      const usedCards = new Set(combo.requirements.map(r => r.cardId));
      const availableCard = ALL_CARDS.find(c => !usedCards.has(c)) || 'A';
      return {
        ...combo,
        requirements: [...combo.requirements, { cardId: availableCard, count: 1 }],
      };
    }));
  }, []);

  // 从组合删除卡片
  const removeCardFromCombo = useCallback((comboIndex: number, reqIndex: number) => {
    setCombinations(prev => prev.map((combo, i) => {
      if (i !== comboIndex) return combo;
      return {
        ...combo,
        requirements: combo.requirements.filter((_, j) => j !== reqIndex),
      };
    }));
  }, []);

  // 运行模拟
  const runSimulation = useCallback(async () => {
    if (combinations.length === 0) {
      message.error('请至少配置一个组合');
      return;
    }

    for (const combo of combinations) {
      if (combo.requirements.length === 0) {
        message.error(`组合"${combo.name}"没有配置卡片`);
        return;
      }
    }

    setIsCalculating(true);
    setProgress(0);
    setResult(null);

    try {
      const coefficientResult = await runFullSimulationAsync(
        { combinations },
        4.0,
        10000,
        (completed, total) => {
          setProgress((completed / total) * 100);
        }
      );

      setResult(coefficientResult);
      message.success(`求解完成！迭代 ${coefficientResult.iterations} 次`);
    } catch (error) {
      message.error('求解失败: ' + String(error));
    } finally {
      setIsCalculating(false);
    }
  }, [combinations]);

  // 获取概率表数据
  const probTables = result ? generateProbabilityTables({ combinations }, result) : null;
  const cases = result ? generateCases({ combinations }, result) : [];

  return (
    <div style={{ padding: '24px', maxWidth: 1400, margin: '0 auto' }}>
      {/* 标题 */}
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>🎴 神奇物种概率配置自动化系统</Title>
        <Paragraph type="secondary">
          配置两套组合，系统将自动求解降权系数，确保每组中奖率≈4%
        </Paragraph>
      </div>

      <Row gutter={[24, 24]}>
        {/* 左侧：组合配置 */}
        <Col xs={24} lg={10}>
          <AntCard
            title="组合配置"
            bordered={false}
            extra={
              <Button type="primary" icon={<CalculatorOutlined />} onClick={runSimulation} loading={isCalculating}>
                开始测算
              </Button>
            }
          >
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              {combinations.map((combo, comboIdx) => (
                <div
                  key={comboIdx}
                  style={{
                    border: '1px solid #d9d9d9',
                    borderRadius: 8,
                    padding: 16,
                    backgroundColor: comboIdx === 0 ? '#f6ffed' : '#e6f7ff'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <Space>
                      <Text strong>{combo.name}</Text>
                      <InputNumber
                        min={1}
                        max={14}
                        value={combo.deadline}
                        onChange={(v) => updateCombination(comboIdx, { deadline: v || 7 })}
                        addonBefore="截止"
                        addonAfter="天"
                        style={{ width: 120 }}
                        size="small"
                      />
                    </Space>
                  </div>

                  <div style={{ marginBottom: 8 }}>
                    <Text type="secondary">所需卡片（长按修改数量）：</Text>
                  </div>

                  <Space wrap>
                    {combo.requirements.map((req, reqIdx) => (
                      <div
                        key={reqIdx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '4px 8px',
                          backgroundColor: '#fff',
                          borderRadius: 4,
                          border: '1px solid #d9d9d9'
                        }}
                      >
                        <Select
                          value={req.cardId}
                          onChange={(v) => updateRequirement(comboIdx, reqIdx, { cardId: v })}
                          style={{ width: 60 }}
                          size="small"
                          bordered={false}
                        >
                          {ALL_CARDS.map(c => <Option key={c} value={c}>{c}</Option>)}
                        </Select>
                        <Text>×</Text>
                        <InputNumber
                          min={1}
                          max={5}
                          value={req.count}
                          onChange={(v) => updateRequirement(comboIdx, reqIdx, { count: v || 1 })}
                          style={{ width: 50 }}
                          size="small"
                          bordered={false}
                        />
                        <Button
                          type="text"
                          danger
                          size="small"
                          icon={<DeleteOutlined />}
                          onClick={() => removeCardFromCombo(comboIdx, reqIdx)}
                        />
                      </div>
                    ))}
                    {combo.requirements.length < 5 && (
                      <Button
                        type="dashed"
                        size="small"
                        icon={<PlusOutlined />}
                        onClick={() => addCardToCombo(comboIdx)}
                      >
                        添加卡
                      </Button>
                    )}
                  </Space>

                  <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                    目标：{combo.requirements.length > 0
                      ? combo.requirements.map(r => `${r.cardId}×${r.count}`).join(' + ')
                      : '请添加卡片'}
                  </div>
                </div>
              ))}

              {isCalculating && (
                <div style={{ padding: 16, backgroundColor: '#f5f5f5', borderRadius: 8 }}>
                  <Progress percent={Math.round(progress)} status="active" />
                  <Text type="secondary">正在求解降权系数...</Text>
                </div>
              )}
            </Space>
          </AntCard>

          {/* 关键结果摘要 */}
          {result && (
            <AntCard style={{ marginTop: 16 }} bordered={false}>
              <Row gutter={16}>
                <Col span={8}>
                  <div style={{ textAlign: 'center' }}>
                    <Text type="secondary">第一套中奖率</Text>
                    <div style={{ fontSize: 28, fontWeight: 'bold', color: '#52c41a' }}>
                      {(result.combinationRates['第一套（AaB）'] ??
                        result.combinationRates[combinations[0]?.name] ?? 0).toFixed(2)}%
                    </div>
                  </div>
                </Col>
                <Col span={8}>
                  <div style={{ textAlign: 'center' }}>
                    <Text type="secondary">第二套中奖率</Text>
                    <div style={{ fontSize: 28, fontWeight: 'bold', color: '#1890ff' }}>
                      {(result.combinationRates['第二套（CcD）'] ??
                        result.combinationRates[combinations[1]?.name] ?? 0).toFixed(2)}%
                    </div>
                  </div>
                </Col>
                <Col span={8}>
                  <div style={{ textAlign: 'center' }}>
                    <Text type="secondary">14天全收集率</Text>
                    <div style={{ fontSize: 28, fontWeight: 'bold', color: '#722ed1' }}>
                      {result.fullCollectionRate.toFixed(2)}%
                    </div>
                  </div>
                </Col>
              </Row>

              {!result.converged && (
                <Alert
                  message="警告：求解未完全收敛"
                  description="建议调整组合配置或增加迭代次数"
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
                {/* 降权系数 */}
                <TabPane
                  tab={<span><TrophyOutlined /> 推荐降权系数</span>}
                  key="coefficients"
                >
                  <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                    基于目标中奖率 4%，通过二分搜索求解得到的最优降权系数
                  </Paragraph>

                  {/* 缺3张时的系数 */}
                  {Object.keys(result.byMissingCount.missing3).length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <Text strong style={{ color: '#52c41a' }}>缺3张时（持有0张）系数：</Text>
                      <div style={{ marginTop: 8 }}>
                        {Object.entries(result.byMissingCount.missing3).map(([card, coeff]) => (
                          <Tag key={card} color="green" style={{ margin: '2px' }}>
                            {card}: {(coeff * 100).toFixed(0)}%
                          </Tag>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 缺2张时的系数 */}
                  {Object.keys(result.byMissingCount.missing2).length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <Text strong style={{ color: '#faad14' }}>缺2张时（持有1张）系数：</Text>
                      <div style={{ marginTop: 8 }}>
                        {Object.entries(result.byMissingCount.missing2).map(([card, coeff]) => (
                          <Tag key={card} color="orange" style={{ margin: '2px' }}>
                            {card}: {(coeff * 100).toFixed(4)}%
                          </Tag>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 缺1张时的系数 */}
                  {Object.keys(result.byMissingCount.missing1).length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <Text strong style={{ color: '#ff4d4f' }}>缺1张时（持有2张）系数：</Text>
                      <div style={{ marginTop: 8 }}>
                        {Object.entries(result.byMissingCount.missing1).map(([card, coeff]) => (
                          <Tag key={card} color="red" style={{ margin: '2px' }}>
                            {card}: {(coeff * 100).toFixed(2)}%
                          </Tag>
                        ))}
                      </div>
                    </div>
                  )}

                  <Divider />

                  <Alert
                    message="系数解释"
                    description={`
                      • 缺3张（持有0张）：系数 100%，使用基础概率抽卡
                      • 缺2张（持有1张）：系数约 ${((result.byMissingCount.missing2[Object.keys(result.byMissingCount.missing2)[0]] || 0.02) * 10000).toFixed(2)}‱，大幅降低该卡概率
                      • 缺1张（持有2张）：系数 0%，完全禁止获得该卡
                    `}
                    type="info"
                    showIcon
                  />
                </TabPane>

                {/* 概率配置表 */}
                <TabPane
                  tab={<span><TableOutlined /> 概率配置表</span>}
                  key="tables"
                >
                  {probTables && (
                    <>
                      <Title level={5}>基础概率表</Title>
                      <Table
                        size="small"
                        dataSource={probTables.baseProbTable}
                        pagination={false}
                        columns={[
                          { title: '卡片', dataIndex: 'card', width: 80 },
                          { title: '稀有度', dataIndex: 'rarity' },
                          { title: '基础概率', dataIndex: 'baseProb' },
                          {
                            title: '是否组合卡',
                            dataIndex: 'isInCombo',
                            render: (v) => v ? <Tag color="blue">是</Tag> : <Tag>否</Tag>
                          },
                        ]}
                        style={{ marginBottom: 24 }}
                      />

                      <Title level={5}>降权系数表</Title>
                      <Table
                        size="small"
                        dataSource={probTables.coefficientTable}
                        pagination={false}
                        columns={[
                          { title: '卡片', dataIndex: 'card', width: 80 },
                          {
                            title: '类型',
                            dataIndex: 'isComboCard',
                            render: (v) => v ? <Tag color="blue">组合卡</Tag> : <Tag>填充卡</Tag>
                          },
                          { title: '持有0张', dataIndex: 'coeff0' },
                          { title: '持有1张', dataIndex: 'coeff1' },
                          { title: '持有2张', dataIndex: 'coeff2' },
                          { title: '说明', dataIndex: 'description' },
                        ]}
                      />
                    </>
                  )}
                </TabPane>

                {/* 案例 */}
                <TabPane
                  tab={<span><QuestionCircleOutlined /> 池子状态案例</span>}
                  key="cases"
                >
                  <Table
                    size="small"
                    dataSource={cases}
                    pagination={false}
                    columns={[
                      { title: '案例', dataIndex: 'name', width: 120 },
                      { title: '背包状态', dataIndex: 'description' },
                      { title: '预期中奖率', dataIndex: 'expectedSuccess' },
                    ]}
                  />

                  <Alert
                    message="说明"
                    description="案例展示了不同初始背包状态下的预期表现。实际中奖率会因幸运日分布而有所波动。"
                    type="info"
                    showIcon
                    style={{ marginTop: 16 }}
                  />
                </TabPane>
              </Tabs>
            </AntCard>
          ) : (
            <AntCard bordered={false} style={{ textAlign: 'center', padding: 48 }}>
              <CalculatorOutlined style={{ fontSize: 64, color: '#d9d9d9' }} />
              <Title level={4} style={{ marginTop: 24, color: '#999' }}>
                点击"开始测算"生成概率配置
              </Title>
              <Text type="secondary">
                系统将自动计算满足 4% 中奖率的降权系数
              </Text>
            </AntCard>
          )}
        </Col>
      </Row>

      {/* 底部导航 */}
      <div style={{ marginTop: 24, textAlign: 'center' }}>
        <Button type="default" size="large" icon={<SettingOutlined />} onClick={onNavigateToConfig}>
          概率配置详情（旧版）
        </Button>
      </div>
    </div>
  );
}
