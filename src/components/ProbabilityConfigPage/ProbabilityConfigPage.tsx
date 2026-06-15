/**
 * 概率配置页
 * 展示基础概率表、降权系数表、案例模拟
 */

import { useState } from 'react';
import { Tabs, Card as AntCard, Typography, Space, Table, Tag, Row, Col, Alert } from 'antd';
import { ArrowLeftOutlined, InfoCircleOutlined, BookOutlined } from '@ant-design/icons';
import { Button } from 'antd';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

interface ProbabilityConfigPageProps {
  onNavigateToSelection?: () => void;
}

// 基础概率表数据
const BASE_PROB_DATA = {
  common: {
    普通日: { 普通卡: 16.08, 稀有卡: 8.04, 神奇卡: 2.30, 幸运卡: 1.20 },
    稀有日: { 普通卡: 14.87, 稀有卡: 7.44, 神奇卡: 2.12, 幸运卡: 1.20 },
    神奇日: { 普通卡: 14.11, 稀有卡: 7.06, 神奇卡: 0.00, 幸运卡: 1.20 },
  },
};

// 降权系数表数据
const COEFF_DATA = [
  { card: 'A/a', need0: '1.0', need1: '0.02', need2: '0', note: '第一套第2张，7天窗口' },
  { card: 'B/b', need0: '1.0', need1: '0', need2: '0', note: '第一套只需要1张' },
  { card: 'C/c', need0: '1.0', need1: '0.008', need2: '0', note: '第二套第2张，14天窗口' },
  { card: 'D/d', need0: '1.0', need1: '0', need2: '0', note: '第二套只需要1张' },
  { card: 'E~J', need0: '1.0', need1: '0', need2: '0', note: '填充卡每张只出1次' },
];

// 案例数据
const CASE_EXAMPLE = {
  condition: {
    用户持有: 'A×1, B×0, C×0, D×0',
    今日类型: '普通日',
    幸运卡: 'E（普通卡）',
    'A卡稀有度': '普通卡',
    'B卡稀有度': '稀有卡',
    'C卡稀有度': '普通卡',
    'D卡稀有度': '神奇卡',
  },
  step1: [
    { card: 'A卡', rarity: '普通卡', lucky: false, prob: 16.08 },
    { card: 'B卡', rarity: '稀有卡', lucky: false, prob: 8.04 },
    { card: 'C卡', rarity: '普通卡', lucky: false, prob: 16.08 },
    { card: 'D卡', rarity: '神奇卡', lucky: false, prob: 2.30 },
    { card: '幸运卡E', rarity: '普通卡', lucky: true, prob: 1.20 },
    { card: '其他普通卡', rarity: '普通卡', lucky: false, prob: 16.08 },
    { card: '其他稀有卡', rarity: '稀有卡', lucky: false, prob: 8.04 },
  ],
  step2: [
    { card: 'A卡', hold: 1, coeff: 0.02, calc: '16.08% × 0.02', result: 0.32 },
    { card: 'B卡', hold: 0, coeff: 1.0, calc: '8.04% × 1.0', result: 8.04 },
    { card: 'C卡', hold: 0, coeff: 1.0, calc: '16.08% × 1.0', result: 16.08 },
    { card: 'D卡', hold: 0, coeff: 1.0, calc: '2.30% × 1.0', result: 2.30 },
  ],
  step4: {
    abcdSum: 26.74,
    remaining: 73.26,
    distribution: [
      { type: '幸运卡', base: 1.20, weight: '1.63%', final: 1.19 },
      { type: '其他普通卡(3张)', base: 48.24, weight: '65.58%', final: 16.01 },
      { type: '其他稀有卡(3张)', base: 24.12, weight: '32.79%', final: 8.01 },
    ],
  },
};

export function ProbabilityConfigPage({ onNavigateToSelection }: ProbabilityConfigPageProps) {
  return (
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>📚 概率配置参考</Title>
        <Text type="secondary">
          基础概率表、降权系数表、计算案例
        </Text>
      </div>

      <Tabs defaultActiveKey="1" type="card">
        {/* 基础概率表 */}
        <TabPane tab="基础概率表" key="1">
          <AntCard bordered={false}>
            <Alert
              message="基础概率表说明"
              description="根据日期类型（普通日/稀有日/神奇日），非幸运卡的基础概率不同。幸运卡固定为1.2%。"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />

            {Object.entries(BASE_PROB_DATA.common).map(([dayType, probs]) => (
              <div key={dayType} style={{ marginBottom: 24 }}>
                <Title level={5}>{dayType}</Title>
                <Table
                  size="small"
                  dataSource={[
                    { key: '1', type: '幸运卡', value: `${probs.幸运卡}%`, note: '固定值' },
                    { key: '2', type: '普通卡（非幸运）', value: `${probs.普通卡}%`, note: '5张均分' },
                    { key: '3', type: '稀有卡（非幸运）', value: `${probs.稀有卡}%`, note: '4张均分' },
                    { key: '4', type: '神奇卡（非幸运）', value: `${probs.神奇卡}%`, note: '仅1张' },
                  ]}
                  columns={[
                    { title: '类型', dataIndex: 'type', key: 'type' },
                    { title: '概率', dataIndex: 'value', key: 'value' },
                    { title: '说明', dataIndex: 'note', key: 'note' },
                  ]}
                  pagination={false}
                />
              </div>
            ))}
          </AntCard>
        </TabPane>

        {/* 降权系数表 */}
        <TabPane tab="降权系数表" key="2">
          <AntCard bordered={false}>
            <Alert
              message="降权系数设计原理"
              description={
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  <li>A/a 第2张系数 0.02（2%）：第一套只有7天窗口，需要适当提高掉率</li>
                  <li>C/c 第2张系数 0.008（0.8%）：第二套有14天窗口，累积效应更强</li>
                  <li>B/b 和 D/d 只需要1张，有了就不再掉落</li>
                  <li>填充卡 E-J 每张只出1次</li>
                </ul>
              }
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />

            <Table
              dataSource={COEFF_DATA}
              columns={[
                { title: '卡片', dataIndex: 'card', key: 'card' },
                { title: '持有0张', dataIndex: 'need0', key: 'need0' },
                { title: '持有1张', dataIndex: 'need1', key: 'need1' },
                { title: '持有≥2张', dataIndex: 'need2', key: 'need2' },
                { title: '说明', dataIndex: 'note', key: 'note' },
              ]}
              pagination={false}
            />
          </AntCard>
        </TabPane>

        {/* 计算案例 */}
        <TabPane tab="计算案例" key="3">
          <AntCard bordered={false}>
            <Alert
              message="案例条件"
              description={
                <Space direction="vertical">
                  {Object.entries(CASE_EXAMPLE.condition).map(([key, value]) => (
                    <Text key={key}><strong>{key}:</strong> {value}</Text>
                  ))}
                </Space>
              }
              type="info"
              style={{ marginBottom: 16 }}
            />

            <Title level={5}>Step 1-2: 查基础概率</Title>
            <Table
              size="small"
              dataSource={CASE_EXAMPLE.step1}
              columns={[
                { title: '卡片', dataIndex: 'card', key: 'card' },
                { title: '稀有度', dataIndex: 'rarity', key: 'rarity' },
                { title: '是否幸运', dataIndex: 'lucky', key: 'lucky', render: v => v ? '✓' : '✗' },
                { title: '基础概率', dataIndex: 'prob', key: 'prob', render: v => `${v}%` },
              ]}
              pagination={false}
              style={{ marginBottom: 16 }}
            />

            <Title level={5}>Step 3: 应用降权系数</Title>
            <Table
              size="small"
              dataSource={CASE_EXAMPLE.step2}
              columns={[
                { title: '卡片', dataIndex: 'card', key: 'card' },
                { title: '持有数', dataIndex: 'hold', key: 'hold' },
                { title: '系数', dataIndex: 'coeff', key: 'coeff' },
                { title: '计算', dataIndex: 'calc', key: 'calc' },
                { title: '新概率', dataIndex: 'result', key: 'result', render: v => <Tag color="blue">{v}%</Tag> },
              ]}
              pagination={false}
              style={{ marginBottom: 16 }}
            />

            <Title level={5}>Step 4: 归一化处理</Title>
            <Alert
              message={`剩余概率 = 100% - ${CASE_EXAMPLE.step4.abcdSum}% = ${CASE_EXAMPLE.step4.remaining}%`}
              description="剩余概率按原始权重在其他6张卡里重新分配"
              type="warning"
              style={{ marginBottom: 8 }}
            />
            <Table
              size="small"
              dataSource={CASE_EXAMPLE.step4.distribution}
              columns={[
                { title: '卡片类型', dataIndex: 'type', key: 'type' },
                { title: '原始合计', dataIndex: 'base', key: 'base', render: v => `${v}%` },
                { title: '权重', dataIndex: 'weight', key: 'weight' },
                { title: '归一化后单张', dataIndex: 'final', key: 'final', render: v => `${v}%` },
              ]}
              pagination={false}
              style={{ marginBottom: 16 }}
            />

            <Title level={5}>Step 5: 最终概率分布</Title>
            <Table
              size="small"
              dataSource={[
                { rarity: '普通卡', cards: 'A(0.32%), C(16.08%), E(1.19%), F(16.01%), G(16.01%)', count: 5 },
                { rarity: '稀有卡', cards: 'B(8.04%), H(8.01%), I(8.01%), J(8.01%)', count: 4 },
                { rarity: '神奇卡', cards: 'D(2.30%)', count: 1 },
              ]}
              columns={[
                { title: '稀有度', dataIndex: 'rarity', key: 'rarity' },
                { title: '卡片及概率', dataIndex: 'cards', key: 'cards' },
                { title: '数量', dataIndex: 'count', key: 'count' },
              ]}
              pagination={false}
              summary={() => (
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0}><strong>合计</strong></Table.Summary.Cell>
                  <Table.Summary.Cell index={1}><strong>10张卡</strong></Table.Summary.Cell>
                  <Table.Summary.Cell index={2}><Tag color="success">100%</Tag></Table.Summary.Cell>
                </Table.Summary.Row>
              )}
            />
          </AntCard>
        </TabPane>
      </Tabs>

      {/* 底部导航 */}
      <div style={{ marginTop: 24, textAlign: 'center' }}>
        <Button type="default" size="large" icon={<ArrowLeftOutlined />} onClick={onNavigateToSelection}>
          返回卡面选择页
        </Button>
      </div>
    </div>
  );
}
