/**
 * 概率配置页 - 主页面（简化版）
 */

import { useState } from 'react';
import { Card as AntCard, Typography, Space, Button, Alert, Row, Col, Slider, Tag } from 'antd';
import { SettingOutlined, ArrowLeftOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

interface ProbabilityConfigPageProps {
  onNavigateToSelection?: () => void;
}

export function ProbabilityConfigPage({ onNavigateToSelection }: ProbabilityConfigPageProps) {
  // 降权系数
  const [coeffA, setCoeffA] = useState<number>(0.02);
  const [coeffC, setCoeffC] = useState<number>(0.008);

  return (
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>⚙️ 降权系数配置</Title>
        <Text type="secondary">
          调整A卡和C卡第二张的降权系数，控制组合中奖率在目标范围内（≤4%）
        </Text>
      </div>

      <Row gutter={[24, 24]}>
        <Col xs={24} md={12}>
          <AntCard title="A卡第2张降权系数" bordered={false}>
            <Text>第一套（AaB）需要在7天内完成，窗口期短，系数相对较高</Text>
            <div style={{ marginTop: 16 }}>
              <Slider
                min={0}
                max={0.1}
                step={0.001}
                value={coeffA}
                onChange={setCoeffA}
                tooltip={{ formatter: (v) => `${((v as number) * 100).toFixed(1)}%` }}
              />
              <div style={{ textAlign: 'center', marginTop: 8 }}>
                <Tag color="blue" style={{ fontSize: 16 }}>
                  当前值：{(coeffA * 100).toFixed(1)}%
                </Tag>
              </div>
            </div>
            <Alert
              message="推荐值：0.02（2%）"
              description="第一套只有7天窗口，需要适当提高第2张A的掉率"
              type="info"
              style={{ marginTop: 16 }}
            />
          </AntCard>
        </Col>

        <Col xs={24} md={12}>
          <AntCard title="C卡第2张降权系数" bordered={false}>
            <Text>第二套（CcD）需要在14天内完成，窗口期长，系数相对较低</Text>
            <div style={{ marginTop: 16 }}>
              <Slider
                min={0}
                max={0.05}
                step={0.0001}
                value={coeffC}
                onChange={setCoeffC}
                tooltip={{ formatter: (v) => `${((v as number) * 100).toFixed(2)}%` }}
              />
              <div style={{ textAlign: 'center', marginTop: 8 }}>
                <Tag color="purple" style={{ fontSize: 16 }}>
                  当前值：{(coeffC * 100).toFixed(2)}%
                </Tag>
              </div>
            </div>
            <Alert
              message="推荐值：0.008（0.8%）"
              description="第二套有14天累积效应，第2张C的掉率需要严格控制"
              type="info"
              style={{ marginTop: 16 }}
            />
          </AntCard>
        </Col>
      </Row>

      <AntCard title="设计原理" style={{ marginTop: 24 }} bordered={false}>
        <Space direction="vertical">
          <Text>
            <strong>第一套（AaB）：</strong> 窗口期只有7天，如果第2张A掉率太低，
            用户很难在7天内收集完成。推荐系数 0.02（2%）可以平衡中奖率和用户完成率。
          </Text>
          <Text>
            <strong>第二套（CcD）：</strong> 窗口期有14天，累积效应更强。
            如果第2张C掉率过高，会导致第二套中奖率超标。推荐系数 0.008（0.8%）
            可以将中奖率控制在4%以内。
          </Text>
          <Text type="secondary">
            注：B和D只需要1张，获取后不再掉落，无需降权系数。
          </Text>
        </Space>
      </AntCard>

      {/* 底部导航 */}
      <div style={{ marginTop: 24, textAlign: 'center' }}>
        <Button
          type="default"
          size="large"
          icon={<ArrowLeftOutlined />}
          onClick={onNavigateToSelection}
        >
          返回卡面选择页
        </Button>
      </div>
    </div>
  );
}
