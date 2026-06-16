/**
 * 📖 教程页面 - Financial/Scientific Aesthetic
 */

import { Card, Typography, Space, Table, Tag, Divider, Button } from 'antd';
import {
  ArrowLeftOutlined,
  BookOutlined,
  CalculatorOutlined,
  ThunderboltOutlined,
  GiftOutlined,
  QuestionCircleOutlined,
  CheckCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;

const PALETTE = {
  bg: '#F7F9F7',
  surface: '#FFFFFF',
  text: '#1a1a2e',
  textMuted: '#6b6b7b',
  border: '#e5e7eb',
  borderLight: '#f0f0f2',
  accent: '#511B3A',
  accentLight: '#f4f0f3',
  success: '#3d6b4a',
  highlight: '#7fb069',
};

interface ProbabilityConfigPageProps {
  onNavigateToSelection?: () => void;
}

function SectionTitle({ icon: Icon, title, subtitle }: { icon: any, title: string, subtitle?: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Icon style={{ color: PALETTE.accent, fontSize: 16 }} />
        <Text style={{
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: PALETTE.accent,
          fontWeight: 600,
        }}>
          {title}
        </Text>
      </div>
      {subtitle && (
        <Text style={{ fontSize: 14, color: PALETTE.textMuted }}>{subtitle}</Text>
      )}
    </div>
  );
}

function InfoBox({ type, title, children }: { type: 'info' | 'warning' | 'success', title: string, children: React.ReactNode }) {
  const colors = {
    info: { bg: PALETTE.accentLight, border: PALETTE.accent, icon: PALETTE.accent },
    warning: { bg: '#fff8e6', border: '#d4a72c', icon: '#d4a72c' },
    success: { bg: '#e8f5e9', border: PALETTE.success, icon: PALETTE.success },
  };
  const c = colors[type];

  return (
    <div style={{
      padding: '16px 20px',
      background: c.bg,
      borderLeft: `3px solid ${c.border}`,
      borderRadius: '0 4px 4px 0',
      marginBottom: 20,
    }}>
      <Text strong style={{ color: c.icon, fontSize: 13, display: 'block', marginBottom: 8 }}>
        {title}
      </Text>
      <div style={{ fontSize: 13, color: PALETTE.text, lineHeight: 1.7 }}>
        {children}
      </div>
    </div>
  );
}

export function ProbabilityConfigPage({ onNavigateToSelection }: ProbabilityConfigPageProps) {
  return (
    <div style={{ minHeight: '100vh', background: PALETTE.bg, padding: '40px 24px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={onNavigateToSelection}
            style={{ padding: 0, color: PALETTE.textMuted, marginBottom: 16 }}
          >
            返回配置
          </Button>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <Title level={2} style={{
              margin: 0,
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: PALETTE.text,
            }}>
              使用指南
            </Title>
          </div>
          <Text style={{ color: PALETTE.textMuted, fontSize: 14 }}>
            理解降权系数机制与概率计算原理
          </Text>
        </div>

        {/* Core Concept */}
        <div style={{
          background: PALETTE.surface,
          borderRadius: 4,
          border: `1px solid ${PALETTE.border}`,
          padding: '28px 32px',
          marginBottom: 16,
        }}>
          <SectionTitle
            icon={BookOutlined}
            title="Core Concept"
            subtitle="降权系数是什么？"
          />

          <InfoBox type="info" title="核心机制">
            降权系数是一个<strong>惩罚乘数</strong>，当玩家已经持有某张卡的第1张后，
            再抽这张卡的第2张（及以后）时，概率会乘以这个系数（通常 0.00001~0.05）。
            核心目标：让全服只有约 4% 的玩家能在规定时间内集齐卡组。
          </InfoBox>

          <Table
            size="small"
            dataSource={[
              { key: '1', type: '神奇', cards: 'A', prob: '2%', note: '最稀有' },
              { key: '2', type: '稀有', cards: 'B, C, D, E', prob: '7% × 4', note: '4张均分28%' },
              { key: '3', type: '普通', cards: 'F, G, H, I, J', prob: '7% × 5', note: '5张均分70%' },
            ]}
            columns={[
              { title: '类型', dataIndex: 'type', width: 80 },
              { title: '卡牌', dataIndex: 'cards' },
              { title: '基础概率', dataIndex: 'prob', width: 100 },
              { title: '说明', dataIndex: 'note' },
            ]}
            pagination={false}
            style={{ marginTop: 16 }}
          />
        </div>

        {/* Reduction Mechanism */}
        <div style={{
          background: PALETTE.surface,
          borderRadius: 4,
          border: `1px solid ${PALETTE.border}`,
          padding: '28px 32px',
          marginBottom: 16,
        }}>
          <SectionTitle
            icon={ThunderboltOutlined}
            title="Reduction Logic"
            subtitle={`按"下一个副本"降权`}
          />

          <InfoBox type="warning" title="关键规则">
            {`不是按"已经有的数量"，而是按"即将抽的是第几张"来决定是否降权。`}
          </InfoBox>

          <Table
            size="small"
            dataSource={[
              { key: '1', have: '0张', next: '第1张', reduce: 'no', coeff: '1.0', result: '正常' },
              { key: '2', have: '1张', next: '第2张', reduce: 'yes', coeff: '0.00001~0.02', result: '困难' },
              { key: '3', have: '2张', next: '第3张', reduce: 'yes', coeff: '0.00001~0.02', result: '困难' },
            ]}
            columns={[
              { title: '持有', dataIndex: 'have', width: 80 },
              { title: '下一个', dataIndex: 'next', width: 80 },
              {
                title: '降权',
                dataIndex: 'reduce',
                width: 80,
                render: (v) => v === 'yes' ?
                  <Tag style={{ background: PALETTE.accent, color: '#fff', border: 'none' }}>是</Tag> :
                  <Tag style={{ background: PALETTE.borderLight, color: PALETTE.textMuted, border: 'none' }}>否</Tag>
              },
              { title: '系数', dataIndex: 'coeff', render: (v) => (
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>{v}</span>
              )},
              { title: '效果', dataIndex: 'result' },
            ]}
            pagination={false}
          />

          <Divider style={{ margin: '24px 0', borderColor: PALETTE.borderLight }} />

          <Text strong style={{ fontSize: 14, color: PALETTE.text, display: 'block', marginBottom: 12 }}>
            跨周压制机制
          </Text>
          <ul style={{ color: PALETTE.text, lineHeight: 1.8, paddingLeft: 20, margin: 0 }}>
            <li><strong>首张跨周卡：</strong>可以正常抽到（概率 100%），保证玩家有机会获得</li>
            <li><strong>第2张跨周卡：</strong>同样应用降权系数（极难抽到）</li>
            <li><strong>跨周判定：</strong>无论在第一周还是第二周，只要抽的是第2张及以后，都受系数压制</li>
          </ul>
        </div>

        {/* Lucky Card */}
        <div style={{
          background: PALETTE.surface,
          borderRadius: 4,
          border: `1px solid ${PALETTE.border}`,
          padding: '28px 32px',
          marginBottom: 16,
        }}>
          <SectionTitle
            icon={GiftOutlined}
            title="Lucky Card Compatibility"
            subtitle="幸运卡也会受降权影响"
          />

          <InfoBox type="success" title="重要特性">
            这是 V6.5 的重要特性，防止玩家通过幸运日大量获取某张卡。
            即使幸运日，如果玩家已经有这张卡的第1张，那么第2张仍然极难获得。
          </InfoBox>

          <Table
            size="small"
            dataSource={[
              { key: '1', day: '神奇日', freq: '1/7', lucky: 'A' },
              { key: '2', day: '稀有日', freq: '1/7', lucky: 'B/C/D/E' },
              { key: '3', day: '普通日', freq: '5/7', lucky: 'F/G/H/I/J' },
            ]}
            columns={[
              { title: '日期类型', dataIndex: 'day', width: 100 },
              { title: '频率', dataIndex: 'freq', width: 80 },
              { title: '幸运卡', dataIndex: 'lucky' },
            ]}
            pagination={false}
            style={{ marginBottom: 20 }}
          />

          <Text strong style={{ fontSize: 14, color: PALETTE.text, display: 'block', marginBottom: 12 }}>
            幸运卡计算流程
          </Text>
          <div style={{
            padding: '16px 20px',
            background: PALETTE.bg,
            borderRadius: 4,
            fontSize: 13,
            lineHeight: 2,
            color: PALETTE.text,
            fontFamily: "'IBM Plex Mono', monospace",
          }}>
            <div>1. 基础概率 × 降权系数（如果需要）</div>
            <div>2. + 1.2% 幸运加成（从所有卡均衡扣除）</div>
            <div>3. = 最终概率</div>
            <Divider style={{ margin: '12px 0', borderColor: PALETTE.border }} />
            <div style={{ color: PALETTE.textMuted }}>举例：H卡 14% × 0.001 + 1.2% = 1.214%</div>
          </div>
        </div>

        {/* Calculation Example */}
        <div style={{
          background: PALETTE.surface,
          borderRadius: 4,
          border: `1px solid ${PALETTE.border}`,
          padding: '28px 32px',
          marginBottom: 16,
        }}>
          <SectionTitle
            icon={CalculatorOutlined}
            title="Calculation Example"
            subtitle="具体计算示例"
          />

          <InfoBox type="info" title="案例卡组">
            第一周 HHF，第二周 IIJ，每日抽奖4次，目标：两周集齐率 ≈ 4%
          </InfoBox>

          <Text strong style={{ fontSize: 14, color: PALETTE.text, display: 'block', marginBottom: 12 }}>
            场景：玩家背包 {`{H:1, F:1}`}（差1张H完成第一周）
          </Text>

          <Table
            size="small"
            style={{ marginBottom: 20 }}
            dataSource={[
              { key: '1', card: 'H', base: '14%', have: '1', reduce: 'yes', coeff: '0.0005', final: '0.007%' },
              { key: '2', card: 'F', base: '14%', have: '1', reduce: 'no', coeff: '1.0', final: '14%' },
              { key: '3', card: 'I', base: '14%', have: '0', reduce: 'no', coeff: '1.0', final: '14%' },
              { key: '4', card: 'A', base: '2%', have: '0', reduce: 'no', coeff: '1.0', final: '2%' },
            ]}
            columns={[
              { title: '卡牌', dataIndex: 'card', width: 60, render: (v) => (
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 }}>{v}</span>
              )},
              { title: '基础概率', dataIndex: 'base', width: 90 },
              { title: '持有', dataIndex: 'have', width: 60 },
              {
                title: '降权',
                dataIndex: 'reduce',
                width: 70,
                render: (v) => v === 'yes' ?
                  <Tag style={{ background: PALETTE.accent, color: '#fff', border: 'none' }}>是</Tag> :
                  <Tag style={{ background: PALETTE.borderLight, color: PALETTE.textMuted, border: 'none' }}>否</Tag>
              },
              { title: '系数', dataIndex: 'coeff', render: (v) => (
                <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{v}</span>
              )},
              { title: '最终概率', dataIndex: 'final', render: (v, r) => (
                <span style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontWeight: r.reduce === 'yes' ? 600 : 400,
                  color: r.reduce === 'yes' ? PALETTE.accent : PALETTE.text,
                }}>{v}</span>
              )},
            ]}
            pagination={false}
          />

          <InfoBox type="success" title="结果分析">
            当玩家差1张H集齐时，H的概率从 14% 骤降到 0.007%（降了2000倍！）。
            这就是把完成率压到 4% 的核心机制。
          </InfoBox>

          <Divider style={{ margin: '24px 0', borderColor: PALETTE.borderLight }} />

          <Text strong style={{ fontSize: 14, color: PALETTE.text, display: 'block', marginBottom: 12 }}>
            归一化计算
          </Text>
          <div style={{
            padding: '20px 24px',
            background: PALETTE.bg,
            borderRadius: 4,
            fontSize: 13,
            fontFamily: "'IBM Plex Mono', monospace",
            lineHeight: 1.8,
            color: PALETTE.text,
          }}>
            <div style={{ color: PALETTE.textMuted, marginBottom: 8 }}>步骤1: 计算加权概率</div>
            <div>H: 14% × 0.0005 = 0.007%</div>
            <div>F: 14% × 1.0 = 14%</div>
            <div>I: 14% × 1.0 = 14%</div>
            <div style={{ marginTop: 4 }}>总和 = 约 80% (部分卡被压低)</div>
            <Divider style={{ margin: '12px 0', borderColor: PALETTE.border }} />
            <div style={{ color: PALETTE.textMuted, marginBottom: 8 }}>步骤2: 归一化(让总和=100%)</div>
            <div>H的最终 = 0.007 / 80 × 100% = 0.00875%</div>
            <div>F的最终 = 14 / 80 × 100% = 17.5%</div>
          </div>
        </div>

        {/* FAQ */}
        <div style={{
          background: PALETTE.surface,
          borderRadius: 4,
          border: `1px solid ${PALETTE.border}`,
          padding: '28px 32px',
          marginBottom: 24,
        }}>
          <SectionTitle
            icon={QuestionCircleOutlined}
            title="FAQ"
            subtitle="常见问题"
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <Text strong style={{ fontSize: 14, color: PALETTE.text, display: 'block', marginBottom: 4 }}>
                为什么3张卡和5张卡的系数差异这么大？
              </Text>
              <Text style={{ fontSize: 13, color: PALETTE.textMuted, lineHeight: 1.7 }}>
                3张卡（如HHF）只有3个位置需要集齐，但抽奖次数不变（28次）。
                如果不把系数设得极低（如0.0005），完成率会高达90%以上。
                5张卡有更多位置需要填满，自然更难完成。
              </Text>
            </div>

            <Divider style={{ margin: 0, borderColor: PALETTE.borderLight }} />

            <div>
              <Text strong style={{ fontSize: 14, color: PALETTE.text, display: 'block', marginBottom: 4 }}>
                跨周卡第2张为什么也难抽？
              </Text>
              <Text style={{ fontSize: 13, color: PALETTE.textMuted, lineHeight: 1.7 }}>
                如果玩家第一周就囤了2张I，那么第二周IIJ几乎等于已经完成。
                为了防止这种"偷跑"行为，跨周卡的第2张同样应用降权系数。
              </Text>
            </div>

            <Divider style={{ margin: 0, borderColor: PALETTE.borderLight }} />

            <div>
              <Text strong style={{ fontSize: 14, color: PALETTE.text, display: 'block', marginBottom: 4 }}>
                系数如何搜索得出？
              </Text>
              <Text style={{ fontSize: 13, color: PALETTE.textMuted, lineHeight: 1.7 }}>
                系统使用蒙特卡洛模拟（大量 random 抽卡实验），尝试不同的系数组合，
                找到让两周完成率都接近4%的最优解。粗网格约140次模拟，细网格约64次。
              </Text>
            </div>
          </div>
        </div>

        {/* Return Button */}
        <div style={{ textAlign: 'center', padding: '20px 0 40px' }}>
          <Button
            type="primary"
            size="large"
            icon={<ArrowLeftOutlined />}
            onClick={onNavigateToSelection}
            style={{
              background: PALETTE.accent,
              borderColor: PALETTE.accent,
              borderRadius: 4,
              height: 48,
              padding: '0 40px',
              fontWeight: 500,
            }}
          >
            返回配置页面
          </Button>
        </div>
      </div>
    </div>
  );
}
