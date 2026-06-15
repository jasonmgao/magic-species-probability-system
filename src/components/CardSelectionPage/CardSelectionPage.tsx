/**
 * 卡面选择页 - 主页面
 */

import { useState, useCallback, useEffect } from 'react';
import { Layout, Row, Col, Card as AntCard, Button, Space, Tabs, Typography, message } from 'antd';
import { CalculatorOutlined, SettingOutlined } from '@ant-design/icons';
import type { CardCombination, Rarity, SlotPosition, SimulationResult } from '@/types';
import { BASE_CARDS, RARITY_CONFIG } from '@/constants';
import { CardPoolSelector } from './CardPoolSelector';
import { CardSlotManager } from './CardSlotManager';
import { ProbabilityCalculator } from './ProbabilityCalculator';
import { RecommendationPanel } from './RecommendationPanel';
import { ProbabilityChart } from './ProbabilityChart';

const { Content } = Layout;
const { Title, Text } = Typography;

interface CardSelectionPageProps {
  onNavigateToConfig?: () => void;
}

export function CardSelectionPage({ onNavigateToConfig }: CardSelectionPageProps) {
  // 当前卡组配置
  const [combination, setCombination] = useState<CardCombination | null>(null);

  // 模拟结果
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);

  // 初始化默认配置
  useEffect(() => {
    if (!combination) {
      // 创建默认配置：A=神奇, B=稀有, C=稀有, D=稀有
      setCombination({
        week1: {
          A: { id: 'A', rarity: 'MAGIC' },
          a: { id: 'A', rarity: 'MAGIC' },
          B: { id: 'B', rarity: 'RARE' },
        },
        week2: {
          C: { id: 'C', rarity: 'RARE' },
          c: { id: 'C', rarity: 'RARE' },
          D: { id: 'D', rarity: 'RARE' },
        },
      });
    }
  }, [combination]);

  // 获取已选中的卡片ID列表
  const selectedCardIds = useCallback(() => {
    if (!combination) return [];
    const ids: string[] = [];
    ids.push(combination.week1.A.id);
    ids.push(combination.week1.a.id);
    ids.push(combination.week1.B.id);
    ids.push(combination.week2.C.id);
    ids.push(combination.week2.c.id);
    ids.push(combination.week2.D.id);
    return ids;
  }, [combination])();

  // 处理从卡池选择卡片
  const handleSelectCard = useCallback((cardId: string) => {
    setCombination(prev => {
      if (!prev) {
        // 创建新的组合
        const card = BASE_CARDS.find(c => c.id === cardId)!;
        return {
          week1: {
            A: { id: cardId, rarity: card.rarity },
            a: { id: cardId, rarity: card.rarity },
            B: { id: '', rarity: 'COMMON' },
          },
          week2: {
            C: { id: '', rarity: 'COMMON' },
            c: { id: '', rarity: 'COMMON' },
            D: { id: '', rarity: 'COMMON' },
          },
        };
      }

      // 找到第一个空的卡槽填入
      const card = BASE_CARDS.find(c => c.id === cardId)!;

      if (!prev.week1.A.id) {
        return { ...prev, week1: { ...prev.week1, A: { id: cardId, rarity: card.rarity } } };
      }
      if (!prev.week1.a.id) {
        return { ...prev, week1: { ...prev.week1, a: { id: cardId, rarity: card.rarity } } };
      }
      if (!prev.week1.B.id) {
        return { ...prev, week1: { ...prev.week1, B: { id: cardId, rarity: card.rarity } } };
      }
      if (!prev.week2.C.id) {
        return { ...prev, week2: { ...prev.week2, C: { id: cardId, rarity: card.rarity } } };
      }
      if (!prev.week2.c.id) {
        return { ...prev, week2: { ...prev.week2, c: { id: cardId, rarity: card.rarity } } };
      }
      if (!prev.week2.D.id) {
        return { ...prev, week2: { ...prev.week2, D: { id: cardId, rarity: card.rarity } } };
      }

      message.warning('所有卡槽已填满，请先移除不需要的卡片');
      return prev;
    });
  }, []);

  // 处理卡槽点击
  const handleSlotClick = useCallback((position: SlotPosition) => {
    // 点击空卡槽时，可以打开选择器
    message.info('请从左侧卡池选择卡片');
  }, []);

  // 处理移除卡槽卡片
  const handleSlotRemove = useCallback((position: SlotPosition) => {
    setCombination(prev => {
      if (!prev) return prev;
      const emptyConfig = { id: '', rarity: 'COMMON' as Rarity };

      switch (position) {
        case 'A':
          return { ...prev, week1: { ...prev.week1, A: emptyConfig } };
        case 'a':
          return { ...prev, week1: { ...prev.week1, a: emptyConfig } };
        case 'B':
          return { ...prev, week1: { ...prev.week1, B: emptyConfig } };
        case 'C':
          return { ...prev, week2: { ...prev.week2, C: emptyConfig } };
        case 'c':
          return { ...prev, week2: { ...prev.week2, c: emptyConfig } };
        case 'D':
          return { ...prev, week2: { ...prev.week2, D: emptyConfig } };
        default:
          return prev;
      }
    });
  }, []);

  // 处理改变卡槽卡片稀有度
  const handleSlotChangeRarity = useCallback((position: SlotPosition, rarity: Rarity) => {
    setCombination(prev => {
      if (!prev) return prev;

      const updateConfig = (oldConfig: { id: string; rarity: Rarity }) => ({
        ...oldConfig,
        rarity,
      });

      switch (position) {
        case 'A':
          return { ...prev, week1: { ...prev.week1, A: updateConfig(prev.week1.A) } };
        case 'a':
          return { ...prev, week1: { ...prev.week1, a: updateConfig(prev.week1.a) } };
        case 'B':
          return { ...prev, week1: { ...prev.week1, B: updateConfig(prev.week1.B) } };
        case 'C':
          return { ...prev, week2: { ...prev.week2, C: updateConfig(prev.week2.C) } };
        case 'c':
          return { ...prev, week2: { ...prev.week2, c: updateConfig(prev.week2.c) } };
        case 'D':
          return { ...prev, week2: { ...prev.week2, D: updateConfig(prev.week2.D) } };
        default:
          return prev;
      }
    });
  }, []);

  // 模拟完成回调
  const handleSimulationComplete = useCallback((result: SimulationResult) => {
    setSimulationResult(result);
  }, []);

  return (
    <div style={{ padding: '24px', maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>🎴 卡面选择页</Title>
        <Text type="secondary">
          选择 2 周的幸运卡组（6 个卡槽），系统将自动计算集齐率并给出推荐建议
        </Text>
      </div>

      <Row gutter={[24, 24]}>
        {/* 左侧：卡池选择 */}
        <Col xs={24} lg={10}>
          <CardPoolSelector
            selectedCardIds={selectedCardIds}
            onSelectCard={handleSelectCard}
            onSelectRarity={() => {}}
          />
        </Col>

        {/* 中间：卡槽管理 */}
        <Col xs={24} lg={14}>
          <CardSlotManager
            combination={combination}
            onSlotClick={handleSlotClick}
            onSlotRemove={handleSlotRemove}
            onSlotChangeRarity={handleSlotChangeRarity}
          />
        </Col>
      </Row>

      <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
        {/* 概率测算 */}
        <Col xs={24} lg={8}>
          <ProbabilityCalculator
            combination={combination}
            onSimulationComplete={handleSimulationComplete}
          />
        </Col>

        {/* 推荐建议 */}
        <Col xs={24} lg={8}>
          <RecommendationPanel result={simulationResult} />
        </Col>

        {/* 可视化 */}
        <Col xs={24} lg={8}>
          <ProbabilityChart result={simulationResult} />
        </Col>
      </Row>

      {/* 底部导航 */}
      <div style={{ marginTop: 24, textAlign: 'center' }}>
        <Button
          type="default"
          size="large"
          icon={<SettingOutlined />}
          onClick={onNavigateToConfig}
        >
          前往概率配置页
        </Button>
      </div>
    </div>
  );
}
