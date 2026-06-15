/**
 * 稀有度徽章组件
 */

import { Tag } from 'antd';
import type { Rarity } from '@/types';
import { RARITY_CONFIG } from '@/constants';

interface RarityBadgeProps {
  rarity: Rarity;
  showLabel?: boolean;
}

export function RarityBadge({ rarity, showLabel = true }: RarityBadgeProps) {
  const config = RARITY_CONFIG[rarity];

  const colorMap = {
    MAGIC: 'gold',
    RARE: 'purple',
    COMMON: 'default',
  };

  return (
    <Tag
      color={colorMap[rarity]}
      style={{
        backgroundColor: config.bgColor,
        color: config.color,
        borderColor: config.color,
        fontWeight: 'bold',
      }}
    >
      {showLabel ? config.label : ''}
    </Tag>
  );
}
