/**
 * 📖 教程页面 - 降权系数使用指南
 * 通俗解释两组权重系数怎么用、概率怎么配
 */

import { Card as AntCard, Typography, Space, Table, Tag, Steps, Alert, Divider, Button } from 'antd';
import { ArrowLeftOutlined, BookOutlined, CalculatorOutlined, CheckCircleOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

interface ProbabilityConfigPageProps {
  onNavigateToSelection?: () => void;
}

export function ProbabilityConfigPage({ onNavigateToSelection }: ProbabilityConfigPageProps) {
  return (
    <div style={{ padding: '24px', maxWidth: 1000, margin: '0 auto', background: '#f5f5f5', minHeight: '100vh' }}>
      {/* 标题区 */}
      <AntCard style={{ marginBottom: 24, textAlign: 'center' }}>
        <BookOutlined style={{ fontSize: 48, color: '#1890ff', marginBottom: 16 }} />
        <Title level={2}>降权系数使用指南</Title>
        <Paragraph type="secondary" style={{ fontSize: 16, maxWidth: 700, margin: '0 auto' }}>
          从零开始理解：两组权重系数是什么、怎么用、怎么配概率
        </Paragraph>
      </AntCard>

      {/* 核心概念 */}
      <AntCard title="📌 核心概念：什么是降权系数？" style={{ marginBottom: 24 }}>
        <Alert
          message="一句话理解"
          description="降权系数 = '惩罚系数'。玩家持有的某周卡牌越多，抽到该周卡牌的概率就越低，避免玩家太容易集齐。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Title level={5}>🎯 为什么要降权？</Title>
        <Paragraph>
          想象一下：如果不降权，玩家抽28次（14天×2次），很容易就能集齐3张卡。
          通过<strong>降权系数</strong>，我们把完成率控制在约<strong>4%</strong>，
          让集齐成为一件有挑战性、值得炫耀的事。
        </Paragraph>

        <Divider />

        <Title level={5}>📊 两组系数是什么？</Title>
        <Table
          size="small"
          dataSource={[
            { key: '1', name: '第一周系数', when: '第1-7天', what: '控制第一周卡牌的掉落概率', example: 'AAB组合，持1张时系数0.15' },
            { key: '2', name: '第二周系数', when: '第8-14天', what: '控制第二周卡牌的掉落概率', example: 'CDE组合，持2张时系数0.08' },
          ]}
          columns={[
            { title: '系数组', dataIndex: 'name', key: 'name', width: 120 },
            { title: '生效时间', dataIndex: 'when', key: 'when', width: 120 },
            { title: '作用', dataIndex: 'what', key: 'what' },
            { title: '举例', dataIndex: 'example', key: 'example' },
          ]}
          pagination={false}
        />
      </AntCard>

      {/* 使用步骤 */}
      <AntCard title="📝 使用步骤：系数怎么用？" style={{ marginBottom: 24 }}>
        <Steps
          direction="vertical"
          current={-1}
          items={[
            {
              title: '确定卡组组合',
              description: (
                <div style={{ marginTop: 8 }}>
                  <Text>先决定两周分别用什么卡。例如：</Text>
                  <ul>
                    <li>第一周：AAB（需要2张A + 1张B，共3个位置）</li>
                    <li>第二周：CCC（需要3张C，共3个位置）</li>
                  </ul>
                  <Tag color="blue">提示：卡越少越难集齐，需要更高的每日抽奖次数</Tag>
                </div>
              ),
            },
            {
              title: '系统自动计算系数',
              description: (
                <div style={{ marginTop: 8 }}>
                  <Text>点击【开始测算】，系统会：</Text>
                  <ol>
                    <li>模拟成千上万次玩家抽卡过程</li>
                    <li>调整系数让第一周完成率 ≈ 4%</li>
                    <li>调整系数让第二周完成率 ≈ 4%</li>
                  </ol>
                  <Text type="warning">系数会自动显示在结果页，不需要手算！</Text>
                </div>
              ),
            },
            {
              title: '按持有数应用系数',
              description: (
                <div style={{ marginTop: 8 }}>
                  <Text>系统每一天抽卡时，会检查玩家<strong>背包里总共持有几张该周卡</strong>（不是单种卡）：</Text>
                  <Table
                    size="small"
                    style={{ marginTop: 8, maxWidth: 500 }}
                    dataSource={[
                      { hold: 0, coeff: '1.0', desc: '还没该周卡，正常概率' },
                      { hold: 1, coeff: '0.1~0.5', desc: '有1张了，概率降到10%~50%' },
                      { hold: 2, coeff: '0.05~0.3', desc: '有2张了，概率再降' },
                      { hold: '≥3', coeff: '0', desc: '已集齐，该周卡不出' },
                    ]}
                    columns={[
                      { title: '持有数', dataIndex: 'hold', key: 'hold', width: 80 },
                      { title: '系数示例', dataIndex: 'coeff', key: 'coeff', width: 100 },
                      { title: '效果', dataIndex: 'desc', key: 'desc' },
                    ]}
                    pagination={false}
                  />
                </div>
              ),
            },
            {
              title: '跨周关联（V5新特性）',
              description: (
                <div style={{ marginTop: 8 }}>
                  <Text>关键设计：<strong>两周卡牌互相压制</strong></Text>
                  <ul>
                    <li>第一周时，如果玩家背包里有很多C（下周卡），C的概率也会降</li>
                    <li>这是为了防止玩家第一周"偷跑"存太多下周卡，导致第二周太容易完成</li>
                  </ul>
                  <Tag color="green">结果：两周完成率都被控在4%左右，公平且有挑战性</Tag>
                </div>
              ),
            },
          ]}
        />
      </AntCard>

      {/* 概率计算原理 */}
      <AntCard title="🔢 概率是怎么算的？（选读）" style={{ marginBottom: 24 }}>
        <Alert
          message="不需要手动计算！系统每天自动执行以下步骤"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Title level={5}>Step 1：基础概率</Title>
        <Paragraph>每张卡有固定的"稀有度"和基础概率：</Paragraph>
        <Table
          size="small"
          style={{ maxWidth: 400, marginBottom: 16 }}
          dataSource={[
            { card: '神奇卡（A）', base: '2%', note: '最稀有' },
            { card: '稀有卡（B,C,D,E）', base: '7%', note: '4张均分' },
            { card: '普通卡（F,G,H,I,J）', base: '14%', note: '5张均分' },
          ]}
          columns={[
            { title: '卡类型', dataIndex: 'card', key: 'card' },
            { title: '基础概率', dataIndex: 'base', key: 'base' },
            { title: '说明', dataIndex: 'note', key: 'note' },
          ]}
          pagination={false}
        />

        <Divider style={{ margin: '12px 0' }} />

        <Title level={5}>Step 2：应用降权系数</Title>
        <Paragraph>
          <Text code>加权概率 = 基础概率 × 降权系数</Text>
        </Paragraph>
        <Text type="secondary">举例：A卡基础2%，持有1张时系数0.15 → 加权概率 = 2% × 0.15 = 0.3%</Text>

        <Divider style={{ margin: '12px 0' }} />

        <Title level={5}>Step 3：归一化</Title>
        <Paragraph>
          所有卡的加权概率加起来可能不等于100%，所以需要按比例缩放，让最终概率总和严格等于100%。
        </Paragraph>
        <Alert
          message="关键效果"
          description="当A/B被大幅降权时，C/D/E等的相对概率会上升，但它们之间保持原来的比例关系。"
          type="warning"
          showIcon
        />
      </AntCard>

      {/* 完整案例 */}
      <AntCard title="📚 完整案例：AAB / CCC 组合" style={{ marginBottom: 24 }}>
        <Alert
          message="案例配置"
          description="每日抽奖4次 | 第一周AAB（2张A+1张B）| 第二周CCC（3张C）"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Title level={5}>🎴 场景：第3天，背包 {'{A:1, C:1}'}</Title>
        <Paragraph>
          <Tag color="blue">当日类型：普通日</Tag>
          <Tag color="purple">幸运卡：F（普通卡，1.2%固定）</Tag>
        </Paragraph>

        <Title level={5}>计算过程</Title>
        <Table
          size="small"
          dataSource={[
            { key: '1', card: 'A', type: '第一周', base: '2%', held: 1, coeff: 0.12, weighted: '0.24%' },
            { key: '2', card: 'B', type: '第一周', base: '7%', held: 0, coeff: 1.0, weighted: '7.00%' },
            { key: '3', card: 'C', type: '第二周', base: '7%', held: 1, coeff: 0.18, weighted: '1.26%' },
            { key: '4', card: 'D/E', type: '填充卡', base: '7%×2', held: '-', coeff: 1.0, weighted: '14.00%' },
            { key: '5', card: 'F(幸运)', type: '幸运卡', base: '-', held: '-', coeff: '-', weighted: '1.20%' },
            { key: '6', card: 'G/H/I/J', type: '填充卡', base: '14%×4', held: '-', coeff: 1.0, weighted: '56.00%' },
          ]}
          columns={[
            { title: '卡', dataIndex: 'card', key: 'card', width: 100 },
            { title: '归属', dataIndex: 'type', key: 'type', width: 100 },
            { title: '基础概率', dataIndex: 'base', key: 'base', width: 100 },
            { title: '持有数', dataIndex: 'held', key: 'held', width: 80 },
            { title: '系数', dataIndex: 'coeff', key: 'coeff', width: 80 },
            { title: '加权后', dataIndex: 'weighted', key: 'weighted', render: v => <Tag>{v}</Tag> },
          ]}
          pagination={false}
        />

        <Divider style={{ margin: '16px 0' }} />

        <Title level={5}>📊 最终概率（归一化后）</Title>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text><Tag color="purple">A</Tag> 0.24 / 79.7 = <strong>0.30%</strong>（极难出，因为已有1张A）</Text>
          <Text><Tag color="blue">B</Tag> 7.0 / 79.7 = <strong>8.78%</strong></Text>
          <Text><Tag color="blue">C</Tag> 1.26 / 79.7 = <strong>1.58%</strong>（跨周降权，已有1张C）</Text>
          <Text><Tag>D/E</Tag> 14.0 / 79.7 = <strong>17.56%</strong></Text>
          <Text><Tag color="green">F(幸运)</Tag> 1.2 / 79.7 = <strong>1.51%</strong></Text>
          <Text><Tag color="green">G-J</Tag> 56.0 / 79.7 = <strong>70.27%</strong>（瓜分大部分概率）</Text>
        </Space>

        <Alert
          message="结果分析"
          description="虽然只有1张A和1张C，但跨周关联让两者都被压制。玩家此时很难抽到想要的卡，必须等到下一天再试。这正是4%完成率的核心机制！"
          type="success"
          showIcon
          style={{ marginTop: 16 }}
        />
      </AntCard>

      {/* 配置建议 */}
      <AntCard title="💡 配置建议表" style={{ marginBottom: 24 }}>
        <Table
          size="small"
          dataSource={[
            { slots: '2张(如AB)', days: 7, draws: '6-8次', note: '卡很少，需要频繁抽奖才有机会集齐' },
            { slots: '3张(如AAB)', days: 7, draws: '4-6次', note: '标准配置，AAB是经典选择' },
            { slots: '4张(如AABB)', days: 7, draws: '3-5次', note: '卡稍多，可以适当减少抽奖次数' },
            { slots: '5张(如AABBC)', days: 7, draws: '3-4次', note: '卡很多，很容易集齐，可保持低抽奖' },
            { slots: '3张(如CCC)', days: 14, draws: '3-4次', note: '14天窗口已足够，不需要太高抽奖频率' },
          ]}
          columns={[
            { title: '卡组大小', dataIndex: 'slots', key: 'slots' },
            { title: '天数', dataIndex: 'days', key: 'days' },
            { title: '建议每日抽奖', dataIndex: 'draws', key: 'draws' },
            { title: '说明', dataIndex: 'note', key: 'note' },
          ]}
          pagination={false}
        />
      </AntCard>

      {/* 底部返回 */}
      <div style={{ textAlign: 'center' }}>
        <Button type="primary" size="large" icon={<ArrowLeftOutlined />} onClick={onNavigateToSelection}>
          返回卡面选择页
        </Button>
      </div>
    </div>
  );
}
