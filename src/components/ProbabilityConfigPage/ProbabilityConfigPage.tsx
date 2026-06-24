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
            A=2%，B/C/D/E (稀有) 各7%，F/G/H/I/J (普通) 各14%。总和100%，固定配置。
          </InfoBox>
        </StepBlock>

        {/* 第二步：理解抽签机制 */}
        <StepBlock number="二" title="理解完整抽卡流程">
          <InfoBox type="warning" title="完整的概率计算有四层">
            实际概率 = 基础概率 → 幸运卡修正 → 降权系数 → 归一化
          </InfoBox>

          <div style={{ fontSize: 14, lineHeight: 2, fontFamily: FONT_DISPLAY }}>
            <p><strong>第一层：基础概率</strong></p>
            <p style={{ color: PALETTE.textMuted, marginLeft: 20 }}>A=2%，B/C/D/E=7%，F/G/H/I/J=14%</p>

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
        <StepBlock number="三" title="幸运卡机制">
          <InfoBox type="success" title="轮换周期">
            每周按 1神奇日 : 2稀有日 : 5普通日 的周期轮换（具体周几可变）。
            神奇日固定A为幸运卡，稀有日随机选B/C/D/E中1张，普通日随机选F/G/H/I/J中1张。
          </InfoBox>

          <Table size="small" style={{ marginBottom: 20 }} dataSource={[
            { key: '1', day: '神奇日', freq: '每周1天', lucky: 'A', effect: 'A卡概率直接设为1.2%' },
            { key: '2', day: '稀有日', freq: '每周2天', lucky: 'B/C/D/E中选1张', effect: '当天1张稀有卡设为1.2%' },
            { key: '3', day: '普通日', freq: '每周5天', lucky: 'F/G/H/I/J中选1张', effect: '当天1张普通卡设为1.2%' },
          ]} columns={[
            { title: '日期类型', dataIndex: 'day', width: 100, render: (v) => <span style={{ fontFamily: FONT_DISPLAY }}>{v}</span> },
            { title: '频率', dataIndex: 'freq', width: 90, render: (v) => <span style={{ fontFamily: FONT_DISPLAY }}>{v}</span> },
            { title: '幸运卡', dataIndex: 'lucky', render: (v) => <span style={{ fontFamily: FONT_MONO }}>{v}</span> },
            { title: '效果', dataIndex: 'effect', render: (v) => <span style={{ fontFamily: FONT_DISPLAY }}>{v}</span> },
          ]} pagination={false} />

          <InfoBox type="warning" title="幸运卡也要受降权影响">
            如果玩家背包{`{A:1}`}，神奇日A设为1.2%后，还要乘以降权系数（如0.0005），最终A概率只有 0.0006%。
          </InfoBox>
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

            <p style={{ marginTop: 16 }}><strong>两周的降权系数表不同</strong></p>
            <p style={{ color: PALETTE.textMuted, marginTop: 8 }}>
              以卡组 AAB / HHI 为例：<br/>
              第一周系数表：A需要2张 → 第2张A降权；H作为跨周卡 → 第2张H也降权<br/>
              第二周系数表：H需要2张 → 第2张H降权；A不再需要 → A无降权
            </p>
            <p style={{ color: PALETTE.accent, marginTop: 8, fontSize: 13 }}>
              注意：每周有各自的降权系数表，系统输出时给出两张表，实际使用根据当前是第几周选择。
            </p>
          </div>
        </StepBlock>

        {/* 第五步：完整示例 - AAB/HHI */}
        <StepBlock number="五" title="完整计算示例（AAB/HHI，第一周神奇日）">
          <div style={{ background: '#f8f9fa', padding: 20, borderRadius: 4, fontSize: 13, lineHeight: 2, fontFamily: FONT_DISPLAY }}>
            <div style={{ fontWeight: 600, marginBottom: 16 }}>场景设定</div>
            <div style={{ marginBottom: 20, color: PALETTE.textMuted }}>
              卡组：第一周 AAB，第二周 HHI<br/>
              当前：第一周神奇日，A是幸运卡<br/>
              玩家背包：{`{A:1, H:1}`}（已有1张A，1张H）
            </div>

            <div style={{ fontWeight: 600, marginBottom: 12 }}>步骤1 - 确定天数和背包状况</div>
            <div style={{ paddingLeft: 20, marginBottom: 16, color: PALETTE.textMuted }}>
              今天是神奇日（A为幸运卡），玩家持有 A=1张（本周需要2张），H=1张（跨周卡，第二周需要2张）。
            </div>

            <div style={{ fontWeight: 600, marginBottom: 12 }}>步骤2 - 幸运卡修正（神奇日A=1.2%）</div>
            <div style={{ paddingLeft: 20, marginBottom: 16, color: PALETTE.textMuted }}>
              A卡：基础2% → 直接设为 1.2%（幸运卡）<br/>
              其他卡：保持基础概率不变
            </div>

            <div style={{ fontWeight: 600, marginBottom: 12 }}>步骤3 - 应用降权系数（使用第一周系数表）</div>
            <div style={{ paddingLeft: 20, marginBottom: 16, color: PALETTE.textMuted, fontFamily: FONT_MONO }}>
              · A（本周需要2张，已有1张）：1.2% × 0.0005 = 0.0006%（第2张降权）<br/>
              · H（跨周卡，第二周需要2张，已有1张）：14% × 0.0005 = 0.007%（跨周第2张降权）<br/>
              · B/C/D/E/F/G/I/J：保持基础概率不变
            </div>

            <div style={{ fontWeight: 600, marginBottom: 12 }}>步骤4 - 计算当前总概率（归一化前）</div>
            <div style={{ paddingLeft: 20, marginBottom: 16, fontFamily: FONT_MONO }}>
              A(0.0006) + B(7) + C(7) + D(7) + E(7) + F(14) + G(14) + H(0.007) + I(14) + J(14) = 84.0076%
            </div>

            <div style={{ fontWeight: 600, marginBottom: 12 }}>步骤5 - 归一化扩大（100 / 84.0076 ≈ 1.1904倍）</div>
          </div>

          <InfoBox type="success" title="最终概率配置表（本周实际使用）">
            <Table size="small" dataSource={[
              { card: 'A', base: '2%', lucky: '1.2%', reduced: '0.0006%', final: '0.0007%' },
              { card: 'B', base: '7%', lucky: '—', reduced: '7%', final: '8.33%' },
              { card: 'C', base: '7%', lucky: '—', reduced: '7%', final: '8.33%' },
              { card: 'D', base: '7%', lucky: '—', reduced: '7%', final: '8.33%' },
              { card: 'E', base: '7%', lucky: '—', reduced: '7%', final: '8.33%' },
              { card: 'F', base: '14%', lucky: '—', reduced: '14%', final: '16.67%' },
              { card: 'G', base: '14%', lucky: '—', reduced: '14%', final: '16.67%' },
              { card: 'H', base: '14%', lucky: '—', reduced: '0.007%', final: '0.008%' },
              { card: 'I', base: '14%', lucky: '—', reduced: '14%', final: '16.67%' },
              { card: 'J', base: '14%', lucky: '—', reduced: '14%', final: '16.67%' },
            ]} columns={[
              { title: '卡牌', dataIndex: 'card', width: 60, render: (v) => <span style={{ fontFamily: FONT_MONO }}>{v}</span> },
              { title: '基础', dataIndex: 'base', width: 70, render: (v) => <span style={{ fontFamily: FONT_MONO }}>{v}</span> },
              { title: '幸运修正', dataIndex: 'lucky', width: 80, render: (v) => <span style={{ fontFamily: FONT_MONO, color: v !== '—' ? PALETTE.success : undefined }}>{v}</span> },
              { title: '降权后', dataIndex: 'reduced', width: 90, render: (v) => <span style={{ fontFamily: FONT_MONO }}>{v}</span> },
              { title: '最终概率(归一化)', dataIndex: 'final', render: (v) => <span style={{ fontFamily: FONT_MONO, fontWeight: 600, color: parseFloat(v) < 0.01 ? PALETTE.accent : undefined }}>{v}</span> },
            ]} pagination={false} />
          </InfoBox>

          <InfoBox type="info" title="第二周的差异">
            第二周使用 HHI 系数表，此时：<br/>
            · H需要2张 → 第2张H降权<br/>
            · A不再需要 → A无降权（无论背包里有没有A，都是正常概率）<br/>
            因此同一玩家，第一周和第二周的抽卡概率表是不同的。
          </InfoBox>
        </StepBlock>

        {/* 配卡经验 */}
        <StepBlock number="六" title="配卡经验">
          <div style={{ fontSize: 14, lineHeight: 2, fontFamily: FONT_DISPLAY }}>
            <p style={{ color: PALETTE.textMuted, marginBottom: 16 }}>
              怎样的卡组配置能让完成率控制在目标范围（4%左右）？以下是系统验证过的原则：
            </p>

            <p><strong>1. 卡组总卡数控制在3-4张</strong></p>
            <p style={{ color: PALETTE.textMuted, marginLeft: 20, marginBottom: 12 }}>
              2张卡太简单，完成率会超标；5张卡以上太难，系数压到0.00001也可能达不到4%。<br/>
              推荐：AAB（3张）、AAAB（4张）、ABBC（4张）<br/>
              不推荐：HH（2张）、ABCDE（5张）
            </p>

            <p><strong>2. 单卡重复次数 ≤ 3张</strong></p>
            <p style={{ color: PALETTE.textMuted, marginLeft: 20, marginBottom: 12 }}>
              同一张卡需要4张以上（如AAAA）会导致系数压到极限（0.00001），且完成率仍可能超标。<br/>
              推荐：AAB（2张A）、HHF（2张H）<br/>
              不推荐：AAAA、HHHH
            </p>

            <p><strong>3. 跨周重叠要谨慎</strong></p>
            <p style={{ color: PALETTE.textMuted, marginLeft: 20, marginBottom: 12 }}>
              上周卡组与本周卡组有重叠卡（如第一周AAB，第二周AAF），会叠加跨周降权，使完成率偏低。<br/>
              如果希望两周难度均匀，尽量减少跨周重叠。
            </p>

            <p><strong>4. 推荐卡组组合</strong></p>
            <div style={{ marginLeft: 20, fontFamily: FONT_MONO, fontSize: 13, marginBottom: 12 }}>
              <div style={{ color: PALETTE.success, marginBottom: 4 }}>✓ 简单组合（完成率≈4%）：AAB + HHF、AAAB + IIJ、ABBC + HHI</div>
              <div style={{ color: PALETTE.warning, marginBottom: 4 }}>△ 中等难度（可能需要放宽到5%）：AAB + HHI（跨周重叠）、AAAB + HHH（3张重复）</div>
              <div style={{ color: PALETTE.accent }}>✗ 避免：AAAA（超难）、AB + CD（太简单）、AABCC + HHIIJ（卡太多）</div>
            </div>

            <p><strong>5. 完成率不达标时的调整</strong></p>
            <p style={{ color: PALETTE.textMuted, marginLeft: 20 }}>
              · 完成率 &gt; 5%（太简单）：增加单卡重复数（AAB→AAAB）或增加卡种类数<br/>
              · 完成率 &lt; 3%（太难）：减少单卡重复数（AAAB→AAB）或减少跨周重叠
            </p>

            <p><strong>6. 特殊规则（兼容处理）</strong></p>
            <p style={{ color: PALETTE.textMuted, marginLeft: 20 }}>
              · <strong>帮抽、赠送、万能卡</strong>：这些方式获得的卡牌<strong>不参与组合奖开奖</strong>，即不计入本周收集进度<br/>
              · 玩家必须通过正常抽卡获得所需卡牌才能触发组合奖结算
            </p>
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
