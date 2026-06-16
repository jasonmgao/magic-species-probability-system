/**
 * 📖 教程页面 - V6降权系数使用指南
 * 通俗解释V6新版：强制基础卡x2 + 按槽位降权机制
 */

import { Card as AntCard, Typography, Space, Table, Tag, Steps, Alert, Divider, Button } from 'antd';
import { ArrowLeftOutlined, BookOutlined, CalculatorOutlined, CheckCircleOutlined, ThunderboltOutlined, StarOutlined } from '@ant-design/icons';

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
        <Title level={2}>V6 降权系数使用指南</Title>
        <Paragraph type="secondary" style={{ fontSize: 16, maxWidth: 700, margin: '0 auto' }}>
          V6新版机制：强制基础卡x2 + 按槽位精准降权（只对超过第1张的卡生效）
        </Paragraph>
        <Tag color="blue" style={{ fontSize: 14, padding: '4px 12px' }}>当前版本：V6（2024年6月）</Tag>
      </AntCard>

      {/* V6核心改版说明 */}
      <AntCard title="🆕 V6核心改版" style={{ marginBottom: 24 }}>
        <Alert
          message="V6相比V5的三大变化"
          description={
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              <li><strong>强制基础x2</strong>：每个卡组必须有张卡是x2起步（只能修改类型，数量固定）</li>
              <li><strong>按槽位降权</strong>：只对卡组中【超过第1张】的卡应用降权（不是按持有总数）</li>
              <li><strong>幸运卡降权</strong>：幸运卡如果属于某周卡组，同样受降权影响</li>
            </ul>
          }
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Title level={5}>为什么这样设计？</Title>
        <Paragraph>
          旧版本按"持有总数"统一降权，导致卡组设计受限（比如AAB和AAA的影响范围不同）。
          V6通过"按槽位降权"，让<strong>每张卡从第2张副本开始</strong>才受影响，
          这样AAA（对第2、3张A降权）和AAB（只对第2张A降权）就有明显不同的难度曲线，
          设计者可以更灵活地调整卡组成。
        </Paragraph>
      </AntCard>

      {/* 卡组规则 */}
      <AntCard title="🎴 卡组配置规则" style={{ marginBottom: 24 }}>
        <Table
          size="small"
          dataSource={[
            { key: '1', rule: '总卡数', desc: '3-5张（含基础卡x2 + 扩展卡1-3张）', note: '最少3张才能满足"至少有2张相同"' },
            { key: '2', rule: '基础卡', desc: '必须选1张卡作为"基础"，该卡固定x2', note: '界面中有⚡标记，可改类型但数量固定' },
            { key: '3', rule: '扩展卡', desc: '1-3张可选，每张可调整类型和数量（1x/2x/3x）', note: '点击 +/- 调整同一卡的数量' },
            { key: '4', rule: '同卡限制', desc: '同一卡组内，一张卡最多可5张（A×5或C×3等）', note: '总卡数不超过5张即可' },
          ]}
          columns={[
            { title: '类别', dataIndex: 'rule', key: 'rule', width: 120 },
            { title: '说明', dataIndex: 'desc', key: 'desc' },
            { title: '备注', dataIndex: 'note', key: 'note' },
          ]}
          pagination={false}
        />
      </AntCard>

      {/* 降权机制详解 */}
      <AntCard title="⚡ V6降权机制详解" style={{ marginBottom: 24 }}>
        <Alert
          message="核心原则：只对【超额副本】降权"
          description="每张卡的第一张（第1个副本）永远不占降权槽，从第2张开始才计入降权计算。"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Title level={5}>不同卡组的降权点</Title>
        <Table
          size="small"
          dataSource={[
            { key: '1', combo: 'AAB (基础A+扩展B)', slots: '1个降权点', detail: '第2张A需要降权，B只有1张无降权', impact: '单点难度' },
            { key: '2', combo: 'AAA (基础A+扩展A×2)', slots: '2个降权点', detail: '第2张A和第3张A都需要降', impact: '双重压制' },
            { key: '3', combo: 'AABB (基础A+扩展A+扩展B)', slots: '2个降权点', detail: '第2张A和第2张B各自降权', impact: '均衡难度' },
            { key: '4', combo: 'AAAA (基础A+扩展A×3)', slots: '3个降权点', detail: '第2/3/4张A全部降权', impact: '极高难度' },
          ]}
          columns={[
            { title: '组合示例', dataIndex: 'combo', key: 'combo', width: 240 },
            { title: '降权槽位', dataIndex: 'slots', key: 'slots', width: 120 },
            { title: '具体说明', dataIndex: 'detail', key: 'detail' },
            { title: '难度特征', dataIndex: 'impact', key: 'impact', width: 100 },
          ]}
          pagination={false}
        />

        <Divider style={{ margin: '16px 0' }} />

        <Title level={5}>降权系数的应用逻辑</Title>
        <Steps
          direction="vertical"
          current={-1}
          items={[
            {
              title: '确认卡组需求',
              description: '例如 AAA 表示需要3张A卡，第2、3张是降权点',
            },
            {
              title: '检查背包持有',
              description: '玩家当前有2张A，超过第1张的1个副本',
            },
            {
              title: '计算超额数',
              description: '超额数 = max(0, 持有数 - 1) = 1，但至少不超过该卡的降权槽位总数',
            },
            {
              title: '应用降权系数',
              description: '超额数 > 0 时，该卡应用降权系数（否则系数1.0）',
            },
          ]}
        />
      </AntCard>

      {/* 幸运卡规则 */}
      <AntCard title="🌟 幸运卡规则（V6新版）" style={{ marginBottom: 24 }}>
        <Alert
          message="幸运卡也受降权影响！"
          description={
            <div>
              V6之前，幸运卡固定1.2%概率，不受持有数影响。<br/>
              V6开始，如果幸运卡属于某周的卡组，那么在计算其概率加成前，<strong>先应用该周的降权系数</strong>。
            </div>
          }
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Paragraph>
          <strong>示例场景：</strong>第二周卡组是 AAA，今天是魔法日（幸运卡=A）。<br/>
          - V5旧版：无论背包里有多少A，幸运卡的A都固定1.2%额外加成。<br/>
          - V6新版：如果背包已有3张A（超额降权），幸运卡的A在加1.2%之前先应用0.1x系数，
          导致实际加成变成0.12%，大幅降低第一天补给的价值。
        </Paragraph>

        <Tag color="orange">平衡性影响</Tag>
        <Text>这让"偷跑屯卡"的磨肯再痛苦一些，需要更高技巧才能控制节奏。</Text>
      </AntCard>

      {/* 跨周关联 */}
      <AntCard title="🔗 跨周关联（保留）" style={{ marginBottom: 24 }}>
        <Paragraph>
          V6保留V5的跨周压制机制：
        </Paragraph>
        <ul>
          <li>第一周抽卡时，如果背包里有很多第二周的卡（如C×3），这些C同样占用降权槽位</li>
          <li>第二周抽卡时，第一周的卡虽然已经"完成"，但持有数仍然计入降权计算</li>
        </ul>
        <Alert
          message="设计目标"
          description="防止玩家通过第一周疯狂抽第二周卡，导致第二周过于容易完成。两周之间需要取舍。"
          type="success"
          showIcon
        />
      </AntCard>

      {/* 完整案例 */}
      <AntCard title="📚 完整案例：AAB / AAA 组合" style={{ marginBottom: 24 }}>
        <Alert
          message="案例配置"
          description="每日抽奖4次 | 第一周 AAB（基础Ax2 + 扩展Bx1）| 第二周 AAA（基础Ax2 + 扩展Ax2）"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Title level={5}>🎴 场景：第3天，背包 {'{A:2, 来自第一周的A完成, B:1}'}</Title>
        <Paragraph>
          <Tag color="blue">当日类型：普通日</Tag>
          <Tag color="purple">幸运卡：无</Tag>
        </Paragraph>

        <Title level={5}>第一周抽卡计算（以A为例）</Title>
        <Table
          size="small"
          style={{ marginBottom: 16 }}
          dataSource={[
            { key: '1', card: 'A(第1张)', config: '基础卡第1张', held: 1, excess: 0, coeff: '1.0(不降)', base: '2%', final: '2%' },
            { key: '2', card: 'A(第2张)', config: '基础卡第2张（超额位）', held: 2, excess: 1, coeff: '0.08x', base: '2%', final: '0.16%' },
          ]}
          columns={[
            { title: '副本', dataIndex: 'config', key: 'config', width: 180 },
            { title: '持有数', dataIndex: 'held', key: 'held', width: 80, align: 'center' },
            { title: '超额数', dataIndex: 'excess', key: 'excess', width: 80, align: 'center' },
            { title: '系数', dataIndex: 'coeff', key: 'coeff', width: 100 },
            { title: '基础概率', dataIndex: 'base', key: 'base', width: 90 },
            { title: '降权后', dataIndex: 'final', key: 'final', render: v => <Tag color="warning">{v}</Tag> },
          ]}
          pagination={false}
        />
        <Text type="secondary">注意：虽然总持有2张A，但只有1张A处于"超额"状态需要降权。</Text>

        <Divider style={{ margin: '16px 0' }} />

        <Title level={5}>第二周抽卡计算（以获得A卡为例）</Title>
        <Table
          size="small"
          dataSource={[
            { key: '1', desc: '背包跨周资源', detail: '已有2张A（来自第一周完成）' },
            { key: '2', desc: '第二周需求', detail: 'AAA = 第1张A(不降) + 第2张A(降) + 第3张A(降) = 2个降权槽位' },
            { key: '3', desc: '实际计算', detail: '已持2张 → 2个超额副本全部占用 → 所有新A卡都应用0.05x系数' },
            { key: '4', desc: '结果', detail: '此时抽到A的概率极低（0.1%），必须靠天数累积' },
          ]}
          columns={[
            { title: '步骤', dataIndex: 'desc', key: 'desc', width: 150 },
            { title: '详情', dataIndex: 'detail', key: 'detail' },
          ]}
          pagination={false}
        />

        <Alert
          message="关键结论"
          description="第一周的A超额也会压制第二周的A获得，跨周屯卡策略被有效遏制。"
          type="success"
          showIcon
          style={{ marginTop: 16 }}
        />
      </AntCard>

      {/* 配置建议 */}
      <AntCard title="💡 V6配置建议表" style={{ marginBottom: 24 }}>
        <Table
          size="small"
          dataSource={[
            { combo: 'AAB（基础A+扩展B）', slots: '3张', reduction: '1点', draws: '4-6次', difficulty: '★★☆☆☆' },
            { combo: 'AAB B（基础A+扩展B×2）', slots: '4张', reduction: '2点(2张B的第2张)', draws: '3-5次', difficulty: '★★★☆☆' },
            { combo: 'AAA（基础A+扩展A×2）', slots: '3张', reduction: '2点(A#2和A#3)', draws: '4-5次', difficulty: '★★★★☆' },
            { combo: 'AABB（基础A+扩展A+扩展B）', slots: '4张', reduction: '2点(A#2, B#2)', draws: '3-5次', difficulty: '★★★☆☆' },
            { combo: 'AAAA（基础A+扩展A×3）', slots: '4张', reduction: '3点(A#2/#3/#4)', draws: '3-4次', difficulty: '★★★★★' },
          ]}
          columns={[
            { title: '组合', dataIndex: 'combo', key: 'combo', width: 260 },
            { title: '卡数', dataIndex: 'slots', key: 'slots', width: 70 },
            { title: '降权点', dataIndex: 'reduction', key: 'reduction', width: 100 },
            { title: '建议日抽', dataIndex: 'draws', key: 'draws', width: 100 },
            { title: '难度', dataIndex: 'difficulty', key: 'difficulty' },
          ]}
          pagination={false}
        />

        <Text type="secondary" style={{ marginTop: 8, display: 'block' }}>
          <strong>经验：</strong>越多超额槽位（reduction slots），集齐难度越大。
          AAA虽然只有3张卡，但有2个降权点，实际难度接近4张卡的AABB。
        </Text>
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
