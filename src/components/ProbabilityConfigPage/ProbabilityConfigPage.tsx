/**
 * 📖 教程页面 - 完整使用指南
 * Color Palette: #E6FAFC, #9CFC97, #6BA368, #511B3A, #353D2F
 */

import { Card as AntCard, Typography, Space, Table, Tag, Steps, Alert, Divider, Button } from 'antd';
import { ArrowLeftOutlined, BookOutlined, CalculatorOutlined, ThunderboltOutlined, GiftOutlined, QuestionCircleOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

const COLORS = {
  bgLight: '#E6FAFC',
  accent: '#9CFC97',
  primary: '#6BA368',
  dark: '#511B3A',
  text: '#353D2F',
};

interface ProbabilityConfigPageProps {
  onNavigateToSelection?: () => void;
}

export function ProbabilityConfigPage({ onNavigateToSelection }: ProbabilityConfigPageProps) {
  return (
    <div style={{ padding: '32px 24px', maxWidth: 1000, margin: '0 auto', background: `linear-gradient(135deg, ${COLORS.bgLight} 0%, #fff 100%)`, minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <BookOutlined style={{ fontSize: 48, color: COLORS.dark, marginBottom: 16 }} />
        <Title level={2} style={{ color: COLORS.dark, marginBottom: 8 }}>使用指南</Title>
        <Paragraph style={{ color: COLORS.text, fontSize: 15, opacity: 0.8 }}>
          理解降权系数机制与概率计算原理
        </Paragraph>
      </div>

      {/* Core Concept */}
      <AntCard
        title={<span style={{ color: COLORS.dark }}>核心概念</span>}
        style={{
          marginBottom: 24,
          borderRadius: 16,
          boxShadow: '0 4px 20px rgba(81, 27, 58, 0.08)',
          border: 'none',
        }}
      >
        <Alert
          message="降权系数是什么？"
          description={
            <div>
              降权系数是一个<strong>惩罚乘数</strong>，当玩家已经持有某张卡的第1张后，
              再抽这张卡的第2张（及以后）时，概率会乘以这个系数（通常0.0001~0.05）。
              <br /><br />
              <strong>核心目标：</strong>让全服只有约4%的玩家能在规定时间内集齐卡组。
            </div>
          }
          type="info"
          style={{ marginBottom: 16, borderRadius: 8, border: 'none', background: COLORS.bgLight }}
        />

        <Title level={5} style={{ color: COLORS.text }}>卡组结构</Title>
        <Table
          size="small"
          dataSource={[
            { key: '1', item: '神奇卡', cards: 'A', prob: '2%', note: '最稀有，只有1张' },
            { key: '2', item: '稀有卡', cards: 'B, C, D, E', prob: '7%×4', note: '4张均分28%概率' },
            { key: '3', item: '普通卡', cards: 'F, G, H, I, J', prob: '7%×5', note: '5张均分70%概率' },
          ]}
          columns={[
            { title: '类型', dataIndex: 'item', width: 100 },
            { title: '卡牌', dataIndex: 'cards' },
            { title: '基础概率', dataIndex: 'prob', width: 100 },
            { title: '说明', dataIndex: 'note' },
          ]}
          pagination={false}
          style={{ marginBottom: 16 }}
        />
      </AntCard>

      {/* Reduction Mechanism */}
      <AntCard
        title={<span style={{ color: COLORS.dark }}>降权机制详解</span>}
        style={{
          marginBottom: 24,
          borderRadius: 16,
          boxShadow: '0 4px 20px rgba(81, 27, 58, 0.08)',
          border: 'none',
        }}
      >
        <Alert
          message={`关键规则：按"下一个副本"降权`}
          description="不是按'已经有的数量'，而是按'即将抽的是第几张'来决定是否降权。"
          type="warning"
          style={{ marginBottom: 16, borderRadius: 8, border: 'none', background: 'rgba(81, 27, 58, 0.08)' }}
        />

        <Title level={5} style={{ color: COLORS.text }}>降权触发条件</Title>
        <Table
          size="small"
          dataSource={[
            { key: '1', have: '0张', next: '第1张', reduce: '否', coeff: '1.0 (100%)', result: '正常概率' },
            { key: '2', have: '1张', next: '第2张', reduce: '是', coeff: '0.0001~0.02', result: '极难抽到' },
            { key: '3', have: '2张', next: '第3张', reduce: '是', coeff: '0.0001~0.02', result: '极难抽到' },
          ]}
          columns={[
            { title: '当前持有', dataIndex: 'have', width: 80 },
            { title: '下一个', dataIndex: 'next', width: 80 },
            { title: '是否降权', dataIndex: 'reduce', width: 90, render: (v) => v === '是' ? <Tag color="error">是</Tag> : <Tag color="success">否</Tag> },
            { title: '系数', dataIndex: 'coeff' },
            { title: '效果', dataIndex: 'result' },
          ]}
          pagination={false}
        />

        <Divider style={{ margin: '24px 0' }} />

        <Title level={5} style={{ color: COLORS.text }}>跨周压制机制</Title>
        <Paragraph>
          为了防止玩家在第一周大量囤积第二周的卡，系统引入了<strong>跨周压制</strong>：
        </Paragraph>
        <ul style={{ color: COLORS.text, lineHeight: 1.8 }}>
          <li><strong>首张跨周卡：</strong>可以正常抽到（概率100%），保证玩家有机会获得</li>
          <li><strong>第2张跨周卡：</strong>同样应用降权系数（极难抽到）</li>
          <li><strong>跨周判定：</strong>无论在第一周还是第二周，只要抽的是第2张及以后，都受系数压制</li>
        </ul>
      </AntCard>

      {/* Lucky Card Section */}
      <AntCard
        title={<span style={{ color: COLORS.dark }}><GiftOutlined /> 幸运卡兼容关系</span>}
        style={{
          marginBottom: 24,
          borderRadius: 16,
          boxShadow: '0 4px 20px rgba(81, 27, 58, 0.08)',
          border: 'none',
        }}
      >
        <Alert
          message="幸运卡也会受降权影响！"
          description="这是V6+版本的重要特性，防止玩家通过幸运日大量获取某张卡。"
          type="info"
          style={{ marginBottom: 16, borderRadius: 8, border: 'none', background: COLORS.bgLight }}
        />

        <Title level={5} style={{ color: COLORS.text }}>幸运日类型</Title>
        <Table
          size="small"
          dataSource={[
            { key: '1', day: '神奇日', freq: '1/7', lucky: 'A', note: '只有神奇卡A作为幸运卡' },
            { key: '2', day: '稀有日', freq: '1/7', lucky: 'B/C/D/E', note: '卡组内的稀有卡之一' },
            { key: '3', day: '普通日', freq: '5/7', lucky: 'F/G/H/I/J', note: '卡组内的普通卡之一' },
          ]}
          columns={[
            { title: '日期类型', dataIndex: 'day', width: 100 },
            { title: '频率', dataIndex: 'freq', width: 80 },
            { title: '幸运卡', dataIndex: 'lucky' },
            { title: '说明', dataIndex: 'note' },
          ]}
          pagination={false}
        />

        <Divider style={{ margin: '24px 0' }} />

        <Title level={5} style={{ color: COLORS.text }}>幸运卡降权规则</Title>
        <Steps
          direction="vertical"
          current={-1}
          items={[
            {
              title: '基础概率加成',
              description: '幸运卡会获得额外的1.2%固定概率加成（从所有卡均衡扣除）',
            },
            {
              title: '降权检查',
              description: '如果幸运卡已经是第2张（或更多），先应用降权系数，再加1.2%',
            },
            {
              title: '最终概率',
              description: '举例：H卡基础14%，降权系数0.001，幸运加成1.2% → 最终 = 14%×0.001 + 1.2% = 1.214%',
            },
          ]}
        />

        <Alert
          message="关键结论"
          description="即使幸运日，如果玩家已经有这张卡的第1张，那么第2张仍然极难获得。幸运加成只能提供有限的帮助。"
          type="success"
          showIcon
          style={{ marginTop: 16, borderRadius: 8 }}
        />
      </AntCard>

      {/* Calculation Example */}
      <AntCard
        title={<span style={{ color: COLORS.dark }}><CalculatorOutlined /> 具体计算示例</span>}
        style={{
          marginBottom: 24,
          borderRadius: 16,
          boxShadow: '0 4px 20px rgba(81, 27, 58, 0.08)',
          border: 'none',
        }}
      >
        <Alert
          message="案例卡组：第一周 HHF，第二周 IIJ"
          description="每日抽奖4次，目标：两周集齐率≈4%"
          type="info"
          style={{ marginBottom: 16, borderRadius: 8, border: 'none', background: COLORS.bgLight }}
        />

        <Title level={5} style={{ color: COLORS.text }}>第一周场景：玩家背包 {`{H:1, F:1}`}（差1张H完成）</Title>
        <Paragraph style={{ color: COLORS.text }}>
          当前处于<strong>普通日</strong>，幸运卡是F（已在背包中，不影响）。
        </Paragraph>

        <Table
          size="small"
          style={{ marginBottom: 16 }}
          dataSource={[
            { key: '1', card: 'H', base: '14%', have: '1张', reduce: '是', coeff: '0.0005', final: '0.007%', note: '差1张集齐，猛降！' },
            { key: '2', card: 'F', base: '14%', have: '1张', reduce: '否', coeff: '1.0', final: '14%', note: '只有1张需求，不降' },
            { key: '3', card: 'I(跨周)', base: '14%', have: '0张', reduce: '否', coeff: '1.0', final: '14%', note: '首张跨周，正常' },
            { key: '4', card: 'A(背景)', base: '2%', have: '0张', reduce: '否', coeff: '1.0', final: '2%', note: '背景卡正常' },
          ]}
          columns={[
            { title: '卡牌', dataIndex: 'card' },
            { title: '基础概率', dataIndex: 'base' },
            { title: '持有', dataIndex: 'have' },
            { title: '降权?', dataIndex: 'reduce', render: (v) => v === '是' ? <Tag color="error">是</Tag> : <Tag>否</Tag> },
            { title: '系数', dataIndex: 'coeff' },
            { title: '最终概率', dataIndex: 'final', render: (v) => <strong>{v}</strong> },
            { title: '说明', dataIndex: 'note' },
          ]}
          pagination={false}
        />

        <Alert
          message="结果分析"
          description={
            <div>
              当玩家差1张H集齐时：<br />
              • H的概率从14%骤降到0.007%（降了2000倍！）<br />
              • 此时抽到H的概率极低，只能靠持续抽奖积累<br />
              • 这就是把完成率压到4%的核心机制
            </div>
          }
          type="success"
          showIcon
          style={{ borderRadius: 8 }}
        />

        <Divider style={{ margin: '24px 0' }} />

        <Title level={5} style={{ color: COLORS.text }}>归一化计算</Title>
        <Paragraph style={{ color: COLORS.text }}>
          所有卡的加权概率之和通常不等于100%，所以最后需要<strong>归一化</strong>：
        </Paragraph>
        <pre style={{
          background: '#f5f5f5',
          padding: 12,
          borderRadius: 8,
          fontSize: 13,
          color: COLORS.text,
        }}>
{`步骤1: 计算加权概率
H: 14% × 0.0005 = 0.007%
F: 14% × 1.0 = 14%
I: 14% × 1.0 = 14%
其他卡: 正常计算...
总和 = 约 80% (因为有系数压低了部分卡)

步骤2: 归一化(让总和=100%)
H的最终概率 = 0.007 / 80 × 100% = 0.00875%
F的最终概率 = 14 / 80 × 100% = 17.5%
...以此类推`}
        </pre>
      </AntCard>

      {/* FAQ */}
      <AntCard
        title={<span style={{ color: COLORS.dark }}><QuestionCircleOutlined /> 常见问题</span>}
        style={{
          marginBottom: 24,
          borderRadius: 16,
          boxShadow: '0 4px 20px rgba(81, 27, 58, 0.08)',
          border: 'none',
        }}
      >
        <Steps
          direction="vertical"
          current={-1}
          items={[
            {
              title: '为什么3张卡和5张卡的系数差异这么大？',
              description: '3张卡（如HHF）只有3个位置需要集齐，但抽奖次数不变（28次）。如果不把系数设得极低（如0.0005），完成率会高达90%以上。5张卡有更多位置需要填满，自然更难完成，所以系数可以宽松一些。',
            },
            {
              title: '跨周卡第2张为什么也难抽？',
              description: '如果玩家第一周就囤了2张I，那么第二周IIJ几乎等于已经完成。为了防止这种"偷跑"行为，跨周卡的第2张同样应用降权系数。',
            },
            {
              title: '系数如何搜索得出？',
              description: '系统使用蒙特卡洛模拟（大量 random 抽卡实验），尝试不同的系数组合，找到让两周完成率都接近4%的最优解。',
            },
          ]}
        />
      </AntCard>

      {/* Return Button */}
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <Button
          type="primary"
          size="large"
          icon={<ArrowLeftOutlined />}
          onClick={onNavigateToSelection}
          style={{
            background: COLORS.primary,
            borderColor: COLORS.primary,
            borderRadius: 8,
            height: 48,
            padding: '0 32px',
          }}
        >
          返回配置页面
        </Button>
      </div>
    </div>
  );
}
