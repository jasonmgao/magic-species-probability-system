/**
 * 卡槽管理组件
 * 管理6个卡槽（A, a, B, C, c, D）
 */

import { Row, Col, Typography, Card as AntCard, Space, Divider } from 'antd';
import { CardSlot } from '../common';
import type { CardCombination, Rarity, SlotPosition } from '@/types';

const { Title, Text } = Typography;

interface CardSlotManagerProps {
  combination: CardCombination | null;
  onSlotClick: (position: SlotPosition) => void;
  onSlotRemove: (position: SlotPosition) => void;
  onSlotChangeRarity: (position: SlotPosition, rarity: Rarity) => void;
}

// 定义卡槽顺序
const WEEK1_SLOTS: SlotPosition[] = ['A', 'a', 'B'];
const WEEK2_SLOTS: SlotPosition[] = ['C', 'c', 'D'];

export function CardSlotManager({
  combination,
  onSlotClick,
  onSlotRemove,
  onSlotChangeRarity,
}: CardSlotManagerProps) {
  const getSlotConfig = (position: SlotPosition) => {
    if (!combination) return null;

    switch (position) {
      case 'A':
        return combination.week1.A;
      case 'a':
        return combination.week1.a;
      case 'B':
        return combination.week1.B;
      case 'C':
        return combination.week2.C;
      case 'c':
        return combination.week2.c;
      case 'D':
        return combination.week2.D;
      default:
        return null;
    }
  };

  return (
    <AntCard title="卡槽配置" bordered={false}>
      {/* Week1 卡槽 */}
      <div style={{ marginBottom: 24 }}>
        <Title level={5}>Week 1 组合（第1-7天）</Title>
        <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
          目标：A卡 × 2 + B卡 × 1
        </Text>
        <Row gutter={[16, 16]}>
          {WEEK1_SLOTS.map(position => (
            <Col key={position}>
              <CardSlot
                position={position}
                cardConfig={getSlotConfig(position)}
                onClick={() => onSlotClick(position)}
                onRemove={() => onSlotRemove(position)}
                onChangeRarity={(rarity) => onSlotChangeRarity(position, rarity)}
              />
            </Col>
          ))}
        </Row>
      </div>

      <Divider />

      {/* Week2 卡槽 */}
      <div>
        <Title level={5}>Week 2 组合（第1-14天）</Title>
        <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
          目标：C卡 × 2 + D卡 × 1
        </Text>
        <Row gutter={[16, 16]}>
          {WEEK2_SLOTS.map(position => (
            <Col key={position}>
              <CardSlot
                position={position}
                cardConfig={getSlotConfig(position)}
                onClick={() => onSlotClick(position)}
                onRemove={() => onSlotRemove(position)}
                onChangeRarity={(rarity) => onSlotChangeRarity(position, rarity)}
              />
            </Col>
          ))}
        </Row>
      </div>
    </AntCard>
  );
}
