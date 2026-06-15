/**
 * 基础概率表配置组件
 */

import { useState, useCallback } from 'react';
import { Table, InputNumber, Button, Typography, Alert, Space, Tag } from 'antd';
import { ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import type { Card } from '@/types';
import { BASE_CARDS, DEFAULT_BASE_PROB_TABLE, RARITY_CONFIG } from '@/constants';

const { Text } = Typography;

interface BaseProbTableProps {
  value: Record<string, number>;
  onChange: (table: Record<string, number>) => void;
}

export function BaseProbTable({ value, onChange }: BaseProbTableProps) {
  const [localTable, setLocalTable] = useState<Record<string, number>>(value);

  // 计算总和
  const total = Object.values(localTable).reduce((sum, prob) => sum + prob, 0);
  const isValid = Math.abs(total - 100) < 0.01;

  // 更新概率
  const handleProbChange = useCallback((cardId: string, prob: number | null) => {
    if (prob === null) return;
    const newTable = { ...localTable, [cardId]: prob };
    setLocalTable(newTable);
    onChange(newTable);
  }, [localTable, onChange]);

  // 重置为默认值
  const handleReset = useCallback(() => {
    setLocalTable({ ...DEFAULT_BASE_PROB_TABLE });
    onChange({ ...DEFAULT_BASE_PROB_TABLE });
  }, [onChange]);

  // 表格列
  const columns = [
    {
      title: '卡片 ID',
      dataIndex: 'id',
      key: 'id',
      render: (id: string, record: Card) => (
        <Space>
          <span style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            backgroundColor: RARITY_CONFIG[record.rarity].color,
            color: '#fff',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
          }}>
            {id}
          </span>
        </Space>
      ),
    },
    {
      title: '稀有度',
      dataIndex: 'rarity',
      key: 'rarity',
      render: (rarity: string) => (
        <Tag color={rarity === 'MAGIC' ? 'gold' : rarity === 'RARE' ? 'purple' : 'default'}>
          {RARITY_CONFIG[rarity as keyof typeof RARITY_CONFIG].label}
        </Tag>
      ),
    },
    {
      title: '基础概率 (%)',
      dataIndex: 'baseProb',
      key: 'baseProb',
      render: (baseProb: number, record: Card) => (
        <InputNumber
          min={0}
          max={100}
          step={0.1}
          precision={1}
          value={localTable[record.id]}
          onChange={(val) => handleProbChange(record.id, val)}
          style={{ width: 100 }}
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Card) => (
        <Button
          size="small"
          onClick={() => handleProbChange(record.id, DEFAULT_BASE_PROB_TABLE[record.id])}
        >
          重置
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Text strong>概率总和:</Text>
          <Text style={{ fontSize: 18, color: isValid ? '#52c41a' : '#f5222d' }}>
            {total.toFixed(1)}%
          </Text>
          {isValid ? (
            <CheckCircleOutlined style={{ color: '#52c41a' }} />
          ) : (
            <CloseCircleOutlined style={{ color: '#f5222d' }} />
          )}
        </Space>
        <Button icon={<ReloadOutlined />} onClick={handleReset}>
          一键重置
        </Button>
      </div>

      {!isValid && (
        <Alert
          message="概率总和必须为 100%"
          description={`当前总和为 ${total.toFixed(1)}%，请调整各卡片概率使其总和为 100%`}
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Table
        dataSource={BASE_CARDS}
        columns={columns}
        rowKey="id"
        pagination={false}
        size="small"
        summary={() => (
          <Table.Summary fixed>
            <Table.Summary.Row>
              <Table.Summary.Cell index={0}><Text strong>合计</Text></Table.Summary.Cell>
              <Table.Summary.Cell index={1}>-</Table.Summary.Cell>
              <Table.Summary.Cell index={2}>
                <Text strong style={{ color: isValid ? '#52c41a' : '#f5222d' }}>
                  {total.toFixed(1)}%
                </Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={3}>-</Table.Summary.Cell>
            </Table.Summary.Row>
          </Table.Summary>
        )}
      />
    </div>
  );
}
