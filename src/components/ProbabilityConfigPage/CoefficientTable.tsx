/**
 * 降权系数表配置组件
 */

import { useState, useCallback } from 'react';
import { Table, Slider, InputNumber, Typography, Space, Card as AntCard, Tooltip } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { DEFAULT_COEFFICIENT_TABLE } from '@/constants';

const { Text, Title } = Typography;

interface CoefficientTableProps {
  value: Record<string, number[]>;
  onChange: (table: Record<string, number[]>) => void;
}

const CARD_LABELS: Record<string, string> = {
  A: 'A/a (第一套第1/2张)',
  a: 'A/a (第一套第1/2张)',
  B: 'B/b (第一套第1/2张)',
  b: 'B/b (第一套第1/2张)',
  C: 'C/c (第二套第1/2张)',
  c: 'C/c (第二套第1/2张)',
  D: 'D/d (第二套第1/2张)',
  d: 'D/d (第二套第1/2张)',
  E: '填充卡 E',
  F: '填充卡 F',
  G: '填充卡 G',
  H: '填充卡 H',
  I: '填充卡 I',
  J: '填充卡 J',
};

export function CoefficientTable({ value, onChange }: CoefficientTableProps) {
  const [localTable, setLocalTable] = useState<Record<string, number[]>>(value);

  // 更新系数
  const handleCoefficientChange = useCallback((
    cardId: string,
    holdCount: number,
    coefficient: number
  ) => {
    const newTable = { ...localTable };
    if (!newTable[cardId]) {
      newTable[cardId] = [1.0, 0, 0];
    }
    newTable[cardId][holdCount] = coefficient;
    setLocalTable(newTable);
    onChange(newTable);
  }, [localTable, onChange]);

  // 表格列
  const columns = [
    {
      title: '卡片类型',
      dataIndex: 'cardId',
      key: 'cardId',
      render: (cardId: string) => (
        <Text strong>{CARD_LABELS[cardId] || cardId}</Text>
      ),
    },
    {
      title: (
        <Space>
          持有 0 张
          <Tooltip title="用户背包中没有此卡时的系数">
            <InfoCircleOutlined />
          </Tooltip>
        </Space>
      ),
      dataIndex: 'coeff0',
      key: 'coeff0',
      render: (_: any, record: { cardId: string }) => (
        <CoefficientInput
          value={localTable[record.cardId]?.[0] ?? 1.0}
          onChange={(val) => handleCoefficientChange(record.cardId, 0, val)}
        />
      ),
    },
    {
      title: (
        <Space>
          持有 1 张
          <Tooltip title="用户背包中已有1张此卡时的系数，降低概率">
            <InfoCircleOutlined />
          </Tooltip>
        </Space>
      ),
      dataIndex: 'coeff1',
      key: 'coeff1',
      render: (_: any, record: { cardId: string }) => (
        <CoefficientInput
          value={localTable[record.cardId]?.[1] ?? 0}
          onChange={(val) => handleCoefficientChange(record.cardId, 1, val)}
        />
      ),
    },
    {
      title: (
        <Space>
          持有 ≥2 张
          <Tooltip title="用户背包中已有2张及以上此卡时的系数，通常为0">
            <InfoCircleOutlined />
          </Tooltip>
        </Space>
      ),
      dataIndex: 'coeff2',
      key: 'coeff2',
      render: (_: any, record: { cardId: string }) => (
        <CoefficientInput
          value={localTable[record.cardId]?.[2] ?? 0}
          onChange={(val) => handleCoefficientChange(record.cardId, 2, val)}
          max={0.5}
        />
      ),
    },
  ];

  // 表格数据
  const dataSource = Object.keys(localTable).map(cardId => ({
    key: cardId,
    cardId,
  }));

  return (
    <div>
      <Alert
        message="降权系数设计原理"
        description={
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>A/B 的第二张系数为 0.02（2%），因为第一套只有 7 天窗口</li>
            <li>C/D 的第二张系数为 0.008（0.8%），因为第二套有 14 天窗口</li>
            <li>填充卡第 2 张概率为 0，确保只掉落 1 张</li>
          </ul>
        }
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Table
        dataSource={dataSource}
        columns={columns}
        pagination={false}
        size="small"
      />
    </div>
  );
}

// 系数输入组件（滑块+输入框）
interface CoefficientInputProps {
  value: number;
  onChange: (value: number) => void;
  max?: number;
}

function CoefficientInput({ value, onChange, max = 1 }: CoefficientInputProps) {
  return (
    <Space direction="vertical" style={{ width: 200 }}>
      <Slider
        min={0}
        max={max}
        step={0.001}
        value={value}
        onChange={onChange}
        tooltip={{ formatter: (val) => `${(val! * 100).toFixed(1)}%` }}
      />
      <InputNumber
        min={0}
        max={max}
        step={0.001}
        precision={3}
        value={value}
        onChange={(val) => val !== null && onChange(val)}
        style={{ width: 100 }}
        addonAfter="%"
        formatter={(val) => `${(val! * 100).toFixed(1)}`}
        parser={(val) => parseFloat(val!.replace('%', '')) / 100}
      />
    </Space>
  );
}

// 导入 Alert
import { Alert } from 'antd';
