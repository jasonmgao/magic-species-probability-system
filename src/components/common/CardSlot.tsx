/**
 * 卡槽组件
 */

import { Card, Typography, Space, Button, Tooltip } from 'antd';
import { CloseOutlined, PlusOutlined } from '@ant-design/icons';
import type { CardRarityConfig, Rarity, SlotPosition } from '@/types';
import { RARITY_CONFIG, SLOT_CONFIG } from '@/constants';

const { Text } = Typography;

interface CardSlotProps {
  position: SlotPosition;
  cardConfig?: CardRarityConfig | null;
  onClick?: () => void;
  onRemove?: () => void;
  onChangeRarity?: (rarity: Rarity) => void;
  disabled?: boolean;
}

export function CardSlot({
  position,
  cardConfig,
  onClick,
  onRemove,
  onChangeRarity,
  disabled = false,
}: CardSlotProps) {
  const config = SLOT_CONFIG[position];

  if (!cardConfig) {
    // 空卡槽
    return (
      <Card
        hoverable={!disabled}
        onClick={disabled ? undefined : onClick}
        style={{
          width: 120,
          height: 160,
          cursor: disabled ? 'not-allowed' : 'pointer',
          border: '2px dashed #d9d9d9',
          backgroundColor: '#fafafa',
        }}
        bodyStyle={{
          padding: '16px',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <PlusOutlined style={{ fontSize: 24, color: '#d9d9d9' }} />
        <Text type="secondary" style={{ marginTop: 8 }}>
          {config.label}
        </Text>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Week{config.week}
        </Text>
      </Card>
    );
  }

  // 有卡片
  const rarityConfig = RARITY_CONFIG[cardConfig.rarity];

  return (
    <Card
      style={{
        width: 120,
        height: 160,
        border: `2px solid ${rarityConfig.color}`,
        backgroundColor: rarityConfig.bgColor,
      }}
      bodyStyle={{
        padding: '12px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'relative',
      }}
    >
      {/* 删除按钮 */}
      {onRemove && (
        <Button
          type="text"
          icon={<CloseOutlined />}
          size="small"
          danger
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
          }}
        />
      )}

      {/* 卡片 ID */}
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          backgroundColor: rarityConfig.color,
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
          fontWeight: 'bold',
          marginTop: 8,
        }}
      >
        {cardConfig.id}
      </div>

      {/* 卡槽信息 */}
      <div style={{ textAlign: 'center' }}>
        <Text strong>{config.label}</Text>
        <br />
        <Text type="secondary" style={{ fontSize: 12 }}>
          Week{config.week}
        </Text>
      </div>

      {/* 稀有度选择 */}
      {onChangeRarity && (
        <Space size={4}>
          {(['MAGIC', 'RARE', 'COMMON'] as Rarity[]).map((r) => (
            <Tooltip key={r} title={RARITY_CONFIG[r].label}>
              <Button
                type={cardConfig.rarity === r ? 'primary' : 'default'}
                size="small"
                style={{
                  width: 28,
                  height: 28,
                  padding: 0,
                  backgroundColor: cardConfig.rarity === r ? RARITY_CONFIG[r].color : undefined,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onChangeRarity(r);
                }}
              >
                {r[0]}
              </Button>
            </Tooltip>
          ))}
        </Space>
      )}
    </Card>
  );
}
