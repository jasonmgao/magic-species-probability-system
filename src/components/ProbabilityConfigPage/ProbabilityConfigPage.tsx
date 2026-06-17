/**
 * 使用指南 - 完整版：从0到1教会研发概率配置
 */

import { Table, Tag, Divider } from 'antd';

const FONT_DISPLAY = "'Noto Serif SC', 'Source Han Serif SC', 'SimSun', serif";
const FONT_MONO = "'IBM Plex Mono', 'SF Mono', monospace";

const PALETTE = {
  bg: '#F7F9F7', surface: '#FFFFFF', text: '#1a1a2e', textMuted: '#6b6b7b',
  border: '#e5e7eb', borderLight: '#f0f0f2', accent: '#511B3A',
  accentLight: '#f4f0f3', success: '#3d6b4a', warning: '#d4a72c',
};

interface ProbabilityConfigPageProps {
  onNavigateToSelection?: () => void;
}

// 顶部导航
function TopNav({ onNavigateToSelection, title }: { onNavigateToSelection?: () => void; title: string }) {
  return (
    <div style={{
      background: PALETTE.surface,
      borderBottom: `1px solid ${PALETTE.border}`,
      padding: '16px 24px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    }}>
      <div style={{ fontSize: 18, fontWeight: 600, color: PALETTE.text, fontFamily: FONT_DISPLAY }}>
        {title}
      </div>
      <button onClick={onNavigateToSelection} style={{ color: PALETTE.textMuted, background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT_DISPLAY, fontSize: 14 }}>
        《 返回配置
      </button>
    </div>
  );
}

// 步骤区块
function StepBlock({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: PALETTE.surface, borderRadius: 4, border: `1px solid ${PALETTE.border}`, padding: '28px 32px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: PALETTE.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontFamily: FONT_DISPLAY }}>{number}</div>
        <span style={{ fontSize: 18, fontWeight: 600, color: PALETTE.text, fontFamily: FONT_DISPLAY }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

// 信息框
function InfoBox({ type, title, children }: { type: 'info' | 'warning' | 'success'; title: string; children: React.ReactNode }) {
  const colors = {
    info: { bg: PALETTE.accentLight, border: PALETTE.accent, icon: PALETTE.accent },
    warning: { bg: '#fff8e6', border: PALETTE.warning, icon: PALETTE.warning },
    success: { bg: '#e8f5e9', border: PALETTE.success, icon: PALETTE.success },
  };
  const c = colors[type];
  return (
    <div style={{ padding: '16px 20px', background: c.bg, borderLeft: `3px solid ${c.border}`, borderRadius: '0 4px 4px 0', marginBottom: 20 }}>
      <span style={{ color: c.icon, fontSize: 13, display: 'block', marginBottom: 8, fontWeight: 600, fontFamily: FONT_DISPLAY }}>{title}</span>
      <div style={{ fontSize: 13, color: PALETTE.text, lineHeight: 1.7, fontFamily: FONT_DISPLAY }}>{children}</div>
    </div>
  );
}

// 代码块
function CodeBlock({ children }: { children: string }) {
  return (
    <div style={{ background: '#f8f9fa', padding: 16, borderRadius: 4, fontFamily: FONT_MONO, fontSize: 12, lineHeight: 1.6, overflow: 'auto' }}>
      <pre style={{ margin: 0 }}>{children}</pre>
    </div>
  );
}

export function ProbabilityConfigPage({ onNavigateToSelection }: ProbabilityConfigPageProps) {
  return (
    <div style={{ minHeight: '100vh', background: PALETTE.bg, fontFamily: FONT_DISPLAY }}>
      <TopNav onNavigateToSelection={onNavigateToSelection} title="使用指南" />

      {/* 标题区 */}
      <div style={{ padding: '32px 24px', textAlign: 'center' }}>
        <h1 style={{ margin: 0, fontSize: 32, fontWeight: 700, color: PALETTE.text, letterSpacing: '0.08em', fontFamily: FONT_DISPLAY }}>
          从零开始配置概率系统
        </h1>
        <p style={{ margin: '12px 0 0', fontSize: 15, color: PALETTE.textMuted, fontFamily: FONT_DISPLAY }}>
          完整机制说明与技术实现指南
        </p>
      </div>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 24px 48px' }}>

        {/* 第一步：理解卡牌结构 */}
        <StepBlock number="一" title="理解基础卡牌结构">
          <InfoBox type="info" title="卡牌基础概率">
            A=2%，B/C/D/E/F/G/H/I/J 各7%，总和72%（剩余28%为其他保底机制）。
            不需要配置，系统固定。
          </InfoBox>
        </StepBlock>

        {/* 第二步：理解抽签机制 */}
        <StepBlock number="二" title="理解完整抽卡流程">
          <InfoBox type="warning" title="完整的概率计算有四层">
            实际概率 = 基础概率 → 幸运卡修正 → 降权系数 → 归一化
          </InfoBox>

          <div style={{ fontSize: 14, lineHeight: 2, fontFamily: FONT_DISPLAY }}>
            <p><strong>第一层：基础概率</strong></p>
            <p style={{ color: PALETTE.textMuted, marginLeft: 20 }}>每张卡有个预设概率（A=2%，B=7%等）</p>

            <p style={{ marginTop: 16 }}><strong>第二层：幸运卡修正（运营配置）</strong></p>
            <p style={{ color: PALETTE.textMuted, marginLeft: 20 }}>
              每周有特定的"幸运日"，幸运卡概率<strong>直接设为1.2%</strong>（不是加成）。<br/>
              神奇日A=1.2%，稀有日某稀有卡=1.2%，普通日某普通卡=1.2%。<br/>
              非幸运卡保持基础概率，最后一起归一化。
            </p>

            <p style={{ marginTop: 16 }}><strong>第三层：降权系数（核心机制）</strong></p>
            <p style={{ color: PALETTE.textMuted, marginLeft: 20 }}>
              如果某张卡本周需要多张（如AAB需要2张A），第2张及以后乘以"降权系数"（如0.0005）。<br/>
              跨周的卡如果重复，第2张也要降权。<br/>
              注意：幸运卡也需先设为1.2%，再在此基础上降权。<br/>
              本系统<strong>自动计算</strong>最优降权系数。
            </p>

            <p style={{ marginTop: 16 }}><strong>第四层：归一化</strong></p>
            <p style={{ color: PALETTE.textMuted, marginLeft: 20 }}>
              所有概率计算后，总和可能不等于100%，需要按比例调整让所有卡加起来=100%。
            </p>
          </div>
        </StepBlock>

        {/* 第三步：幸运卡机制详解 */}
        <StepBlock number="三" title="幸运卡机制（运营配置）">
          <InfoBox type="success" title="幸运日是固定的轮换">
            幸运日不是随机，而是固定轮换。运营只需要确认这个机制，不需要每次配置。
          </InfoBox>

          <Table size="small" style={{ marginBottom: 20 }} dataSource={[
            { key: '1', day: '神奇日', freq: '每周1天（如周一）', lucky: 'A', effect: 'A卡概率直接设为1.2%' },
            { key: '2', day: '稀有日', freq: '每周1天（如周三）', lucky: 'B/C/D/E中1张', effect: '当天随机1张稀有卡设为1.2%' },
            { key: '3', day: '普通日', freq: '每周5天', lucky: 'F/G/H/I/J中1张', effect: '当天随机1张普通卡设为1.2%' },
          ]} columns={[
            { title: '日期类型', dataIndex: 'day', width: 100, render: (v) => <span style={{ fontFamily: FONT_DISPLAY }}>{v}</span> },
            { title: '频率', dataIndex: 'freq', render: (v) => <span style={{ fontFamily: FONT_DISPLAY }}>{v}</span> },
            { title: '幸运卡', dataIndex: 'lucky', width: 120, render: (v) => <span style={{ fontFamily: FONT_MONO }}>{v}</span> },
            { title: '效果', dataIndex: 'effect', render: (v) => <span style={{ fontFamily: FONT_DISPLAY }}>{v}</span> },
          ]} pagination={false} />

          <InfoBox type="warning" title="重要：幸运卡也要受降权影响">
            如果玩家已经有A的第1张，即使在神奇日（A是幸运卡），抽到第2张A的概率是：<br/>
            <code style={{ fontFamily: FONT_MONO }}>1.2% × 0.0005 = 0.0006%</code><br/>
            先设A=1.2%，再在此基础上乘以降权系数0.0005。
          </InfoBox>

          <div style={{ background: PALETTE.bg, padding: 16, borderRadius: 4, fontSize: 13, lineHeight: 1.8 }}>
            <div style={{ fontWeight: 600, marginBottom: 8, fontFamily: FONT_DISPLAY }}>幸运日计算示例（神奇日，A是幸运卡）</div>
            <div style={{ fontFamily: FONT_MONO }}>
              <div>场景：玩家背包{`{A:1}`}，卡组需要AAB</div>
              <div>——</div>
              <div>步骤1：先把A设为幸运概率 → A=1.2%</div>
              <div>步骤2：应用降权（已有1张，下一张是第2张）→ 1.2% × 0.0005 = 0.0006%</div>
              <div>步骤3：其他卡保持基础概率（B=7%，C/D/E=7%...）</div>
              <div>步骤4：归一化 → 最终A的实际概率 ≈ 0.001%</div>
            </div>
          </div>
        </StepBlock>

        {/* 第四步：降权系数详解 */}
        <StepBlock number="四" title="降权系数机制（本系统自动计算）">
          <InfoBox type="info" title="怎么判断是否降权？">
            看"下一张是第几张"，不是看"已经有多少张"。
          </InfoBox>

          <Table size="small" dataSource={[
            { key: '1', hold: '没有（0张）', next: '第1张', reduce: '否', coeff: '1.0', desc: '正常概率' },
            { key: '2', hold: '有1张', next: '第2张', reduce: '是', coeff: '0.00001~0.05', desc: '极难抽到' },
            { key: '3', hold: '有2张', next: '第3张', reduce: '是', coeff: '0.00001~0.05', desc: '继续极难' },
          ]} columns={[
            { title: '当前持有', dataIndex: 'hold', width: 120, render: (v) => <span style={{ fontFamily: FONT_DISPLAY }}>{v}</span> },
            { title: '下一张', dataIndex: 'next', width: 80, render: (v) => <span style={{ fontFamily: FONT_DISPLAY }}>{v}</span> },
            { title: '是否降权', dataIndex: 'reduce', width: 90, render: (v) => v === '是' ? <Tag color="error" style={{ fontFamily: FONT_DISPLAY }}>降权</Tag> : <Tag color="success" style={{ fontFamily: FONT_DISPLAY }}>正常</Tag> },
            { title: '系数', dataIndex: 'coeff', width: 120, render: (v) => <span style={{ fontFamily: FONT_MONO }}>{v}</span> },
            { title: '说明', dataIndex: 'desc', render: (v) => <span style={{ fontFamily: FONT_DISPLAY }}>{v}</span> },
          ]} pagination={false} />

          <Divider style={{ margin: '20px 0', borderColor: PALETTE.borderLight }} />

          <div style={{ fontSize: 14, lineHeight: 1.8, fontFamily: FONT_DISPLAY }}>
            <p><strong>跨周压制</strong></p>
            <ul style={{ color: PALETTE.textMuted, marginTop: 8 }}>
              <li>首张跨周卡：正常概率（让玩家有机会获得）</li>
              <li>第2张跨周卡：同样降权（防止第一周囤太多）</li>
            </ul>
          </div>
        </StepBlock>

        {/* 第五步：完整示例 */}
        <StepBlock number="五" title="完整计算示例">
          <div style={{ background: '#f8f9fa', padding: 20, borderRadius: 4, fontSize: 13, lineHeight: 2 }}>
            <div style={{ fontWeight: 600, marginBottom: 12, fontFamily: FONT_DISPLAY }}>场景：第一周 AAB，神奇日，玩家背包{`{A:1}`}</div>
            <div style={{ fontFamily: FONT_MONO }}>
              <div>步骤1 - 基础概率 & 幸运卡修正：</div>
              <div style={{ paddingLeft: 20 }}>今天是神奇日，A是幸运卡，直接设A=1.2%（不再用基础2%）</div>
              <div style={{ paddingLeft: 20 }}>B的基础=7%，其他卡各7%</div>
              <div>——</div>
              <div>步骤2 - 应用降权系数：</div>
              <div style={{ paddingLeft: 20 }}>A已有1张，下一张是第2张 → 系数=0.0005</div>
              <div style={{ paddingLeft: 20 }}>A的概率 = 1.2% × 0.0005 = 0.0006%（先设1.2%，再降权）</div>
              <div style={{ paddingLeft: 20 }}>B只需要1张 → 系数=1.0</div>
              <div style={{ paddingLeft: 20 }}>B的概率 = 7% × 1.0 = 7%</div>
              <div style={{ paddingLeft: 20 }}>其他卡 = 7% × 1.0 = 7%</div>
              <div>——</div>
              <div>步骤3 - 归一化前总和 ≈ 72%（除A外9张×7% + A的0.0006%）</div>
              <div>步骤4 - 归一化后A的概率 ≈ 0.0008%</div>
            </div>
          </div>

          <InfoBox type="info" title="关键理解">
            虽然今天是神奇日A是幸运卡，但玩家已有1张A，第2张A要先设为1.2%再降权×0.0005，<br/>
            最终概率只有约0.0008%。这才是"幸运日也救不了第2张"的正确逻辑。
          </InfoBox>
        </StepBlock>

        {/* 常见问题 */}
        <StepBlock number="六" title="常见问题">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <span style={{ fontSize: 15, fontWeight: 600, color: PALETTE.text, display: 'block', marginBottom: 8, fontFamily: FONT_DISPLAY }}>问：神奇卡A永远只需要1张，为什么系数表里还有A？</span>
              <span style={{ fontSize: 13, color: PALETTE.textMuted, lineHeight: 1.7, fontFamily: FONT_DISPLAY }}>
                虽然卡组只需要1张A，但跨周时（如第二周卡组也有A），A可能成为"跨周卡"需要第2张。所以系数表里要预留A的第2张系数。
              </span>
            </div>
            <Divider style={{ margin: 0, borderColor: PALETTE.borderLight }} />
            <div>
              <span style={{ fontSize: 15, fontWeight: 600, color: PALETTE.text, display: 'block', marginBottom: 8, fontFamily: FONT_DISPLAY }}>问：完成率达不到4%怎么办？</span>
              <span style={{ fontSize: 13, color: PALETTE.textMuted, lineHeight: 1.7, fontFamily: FONT_DISPLAY }}>
                1) 放宽误差接受5%或3%；2) 调整卡组组合（如AAB→AAAB增加难度）；3) 调整每日抽奖次数。
              </span>
            </div>
            <Divider style={{ margin: 0, borderColor: PALETTE.borderLight }} />
            <div>
              <span style={{ fontSize: 15, fontWeight: 600, color: PALETTE.text, display: 'block', marginBottom: 8, fontFamily: FONT_DISPLAY }}>问：玩家投诉抽不到卡怎么办？</span>
              <span style={{ fontSize: 13, color: PALETTE.textMuted, lineHeight: 1.7, fontFamily: FONT_DISPLAY }}>
                这是设计预期。运营需要在活动说明里明确"本活动具有挑战性，只有少数玩家能完成"。这不是BUG，是机制。
              </span>
            </div>
          </div>
        </StepBlock>

        {/* 返回按钮 */}
        <div style={{ textAlign: 'center', padding: '20px 0 40px' }}>
          <button onClick={onNavigateToSelection} style={{ background: PALETTE.accent, color: '#fff', border: 'none', borderRadius: 4, height: 48, padding: '0 40px', fontWeight: 500, cursor: 'pointer', fontFamily: FONT_DISPLAY, fontSize: 15 }}>
            《 返回配置页面
          </button>
        </div>
      </div>
    </div>
  );
}
