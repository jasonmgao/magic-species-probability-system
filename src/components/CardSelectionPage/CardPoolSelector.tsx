/**
 * 卡池选择器组件
 * 展示10张卡，供用户选择填入卡槽
 */

import { Row, Col, Typography, Card as AntCard } from 'antd';
import { Card } from '../common';
import { BASE_CARDS } from '@/constants';
import type { Rarity } from '@/types';

const { Title, Text } = Typography;

interface CardPoolSelectorProps {
  selectedCardIds: string[];
  onSelectCard: (cardId: string) => void;
  onSelectRarity: (cardId: string, rarity: Rarity) => void;
}

export function CardPoolSelector({
  selectedCardIds,
  onSelectCard,
  onSelectRarity,
}: CardPoolSelectorProps) {
  // 分组卡片：神奇卡、稀有卡、普通卡
  const magicCards = BASE_CARDS.filter(c => c.rarity === 'MAGIC');
  const rareCards = BASE_CARDS.filter(c => c.rarity === 'RARE');
  const commonCards = BASE_CARDS.filter(c => c.rarity === 'COMMON');

  return (
    <AntCard title="卡池选择" bordered={false}>
      {/* 神奇卡 */}
      <div style={{ marginBottom: 16 }}>
        <Title level={5}>🟡 神奇卡</Title>
        <Row gutter={[16, 16]}>
          {magicCards.map(card => (
            <Col key={card.id}>
              <Card
                card={card}
                selected={selectedCardIds.includes(card.id)}
                onClick={() => onSelectCard(card.id)}
              />
            </Col>
          ))}
        </Row>
      </div>

      {/* 稀有卡 */}
      <div style={{ marginBottom: 16 }}>
        <Title level={5}>🟣 稀有卡</Title>
        <Row gutter={[16, 16]}>
          {rareCards.map(card => (
            <Col key={card.id}>
              <Card
                card={card}
                selected={selectedCardIds.includes(card.id)}
                onClick={() => onSelectCard(card.id)}
              />
            </Col>
          ))}
        </Row>
      </div>

      {/* 普通卡 */}
      <div style={{ marginBottom: 16 }}>
        <Title level={5}>⚪ 普通卡</Title>
        <Row gutter={[16, 16]}>
          {commonCards.map(card => (
            <Col key={card.id}>
              <Card
                card={card}
                selected={selectedCardIds.includes(card.id)}
                onClick={() => onSelectCard(card.id)}
              />
            </Col>
          ))}
        </Row>
      </div>

      <Text type="secondary" style={{ display: 'block', marginTop: 16 }}>
        提示：点击卡片可自动填入第一个空卡槽。每个卡槽可以独立设置稀有度。
      </Text>
    </AntCard>
  );
}
