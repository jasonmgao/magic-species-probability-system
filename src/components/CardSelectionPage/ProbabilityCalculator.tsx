/**
 * 概率计算器组件
 * 运行蒙特卡洛模拟并显示结果
 */

import { useState, useCallback } from 'react';
import { Button, Progress, Typography, Card as AntCard, Space, Alert, Statistic, Row, Col, Card } from 'antd';
import { PlayCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import type { CardCombination, SimulationResult } from '@/types';
import { runSimulationInChunks } from '@/services';
import { DEFAULT_SIMULATION_PARAMS } from '@/constants';

const { Title, Text } = Typography;

interface ProbabilityCalculatorProps {
  combination: CardCombination | null;
  onSimulationComplete: (result: SimulationResult) => void;
}

export function ProbabilityCalculator({
  combination,
  onSimulationComplete,
}: ProbabilityCalculatorProps) {
  const [isCalculating, setIsCalculating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<SimulationResult | null>(null);

  const handleCalculate = useCallback(async () => {
    if (!combination) return;

    setIsCalculating(true);
    setProgress(0);

    try {
      const simulationResult = await runSimulationInChunks(
        combination,
        DEFAULT_SIMULATION_PARAMS,
        (p) => setProgress(p)
      );

      setResult(simulationResult);
      onSimulationComplete(simulationResult);
    } catch (error) {
      console.error('Simulation error:', error);
    } finally {
      setIsCalculating(false);
    }
  }, [combination, onSimulationComplete]);

  const getRecommendationColor = (level: string) => {
    switch (level) {
      case '推荐':
        return 'success';
      case '可接受':
        return 'warning';
      case '不推荐':
        return 'error';
      default:
        return 'info';
    }
  };

  if (!combination) {
    return (
      <AntCard title="概率测算" bordered={false}>
        <Alert
          message="请先配置卡槽"
          description="选择卡池中的卡片填入6个卡槽，然后点击计算按钮"
          type="info"
          showIcon
        />
      </AntCard>
    );
  }

  return (
    <AntCard title="概率测算" bordered={false}>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* 计算按钮 */}
        <Button
          type="primary"
          size="large"
          icon={isCalculating ? <LoadingOutlined /> : <PlayCircleOutlined />}
          onClick={handleCalculate}
          disabled={isCalculating}
          block
        >
          {isCalculating ? '计算中...' : '开始测算（10万次模拟）'}
        </Button>

        {/* 进度条 */}
        {isCalculating && (
          <div>
            <Progress percent={Math.round(progress * 100)} status="active" />
            <Text type="secondary">正在运行蒙特卡洛模拟...</Text>
          </div>
        )}

        {/* 结果展示 */}
        {result && !isCalculating && (
          <div>
            <Alert
              message={result.recommendation}
              description={result.recommendationReason}
              type={getRecommendationColor(result.recommendation) as any}
              showIcon
              style={{ marginBottom: 16 }}
            />

            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Card title="Week 1 集齐率" bordered>
                  <Statistic
                    value={result.week1CompletionRate}
                    precision={2}
                    suffix="%"
                    valueStyle={{
                      color: result.week1CompletionRate >= 95 ? '#3f8600' :
                             result.week1CompletionRate >= 80 ? '#faad14' : '#cf1322',
                    }}
                  />
                  <Text type="secondary">目标：{result.week1TargetRate}%</Text>
                </Card>
              </Col>
              <Col span={12}>
                <Card title="Week 2 集齐率" bordered>
                  <Statistic
                    value={result.week2CompletionRate}
                    precision={2}
                    suffix="%"
                    valueStyle={{
                      color: result.week2CompletionRate >= 95 ? '#3f8600' :
                             result.week2CompletionRate >= 80 ? '#faad14' : '#cf1322',
                    }}
                  />
                  <Text type="secondary">目标：{result.week2TargetRate}%</Text>
                </Card>
              </Col>
            </Row>

            <Text type="secondary" style={{ display: 'block', marginTop: 16 }}>
              基于 {DEFAULT_SIMULATION_PARAMS.iterations.toLocaleString()} 次蒙特卡洛模拟
            </Text>
          </div>
        )}
      </Space>
    </AntCard>
  );
}
