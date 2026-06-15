/**
 * 卡片展示组件
 */

import { Card as AntCard, Typography, Space } from 'antd';
import { StarFilled, StarOutlined } from '@ant-design/icons';
import type { Card as CardType } from '@/types';
import { RARITY_CONFIG } from '@/constants';
import { RarityBadge } from './RarityBadge';

const { Text } = Typography;

interface CardProps {
  card: CardType;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  size?: 'small' | 'medium' | 'large';
}

export function Card({
  card,
  selected = false,
  disabled = false,
  onClick,
  size = 'medium',
}: CardProps) {
  const config = RARITY_CONFIG[card.rarity];

  const sizeStyles = {
    small: { width: 80, height: 100, fontSize: 12 },
    medium: { width: 100, height: 130, fontSize: 14 },
    large: { width: 140, height: 180, fontSize: 16 },
  };

  const style = sizeStyles[size];

  return (
    <AntCard
      hoverable={!disabled}
      onClick={disabled ? undefined : onClick}
      style={{
        width: style.width,
        height: style.height,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        border: selected ? `2px solid ${config.color}` : '1px solid #d9d9d9',
        backgroundColor: selected ? config.bgColor : '#fff',
        transition: 'all 0.3s',
      }}
      bodyStyle={{
        padding: '12px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      {/* 卡片 ID */}
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          backgroundColor: config.color,
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: style.fontSize + 4,
          fontWeight: 'bold',
        }}
      >
        {card.id}
      </div>

      {/* 稀有度 */}
      <RarityBadge rarity={card.rarity} />

      {/* 概率 */}
      <Text type="secondary" style={{ fontSize: style.fontSize }}>
        {card.baseProb}%
      </Text>

      {/* 选中标记 */}
      {selected && (
        <StarFilled style={{ color: config.color, fontSize: 16 }} />
      )}
    </AntCard>
  );
}
