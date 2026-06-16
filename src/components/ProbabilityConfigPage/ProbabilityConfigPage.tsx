/**
 * 使用指南 - 研发入门版
 */

import { Typography, Space, Table, Tag, Divider, Button, Steps } from 'antd';
import { ArrowLeftOutlined, PlayCircleOutlined, SettingOutlined, CheckCircleOutlined, CalculatorOutlined, QuestionCircleOutlined, BookOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const PALETTE = {
  bg: '#F7F9F7', surface: '#FFFFFF', text: '#1a1a2e', textMuted: '#6b6b7b',
  border: '#e5e7eb', borderLight: '#f0f0f2', accent: '#511B3A',
  accentLight: '#f4f0f3', success: '#3d6b4a',
};

interface ProbabilityConfigPageProps {
  onNavigateToSelection?: () => void;
}

export function ProbabilityConfigPage({ onNavigateToSelection }: ProbabilityConfigPageProps) {
  return (
    <div style={{ minHeight: '100vh', background: PALETTE.bg }}>
      {/* 标题 */}
      <div style={{ padding: '48px 24px 32px', textAlign: 'center' }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={onNavigateToSelection} style={{ position: 'absolute', left: 24, top: 48, color: PALETTE.textMuted }}>返回</Button>
        <div style={{ display: 'inline-block', padding: '0 32px 16px', borderBottom: `2px solid ${PALETTE.accent}` }}>
          <h1 className="font-display" style={{ margin: 0, fontSize: 36, fontWeight: 700, color: PALETTE.text, letterSpacing: '0.08em' }}>
            使用指南
          </h1>
        </div>
        <p style={{ margin: '16px 0 0', fontSize: 15, color: PALETTE.textMuted }}>
          五分钟上手概率系数调控系统
        </p>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px 48px' }}>

        {/* ========== 第一步：为什么要用这个系统 ========== */}
        <div style={{ background: PALETTE.surface, borderRadius: 4, border: `1px solid ${PALETTE.border}`, padding: '28px 32px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: PALETTE.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>1</div>
            <span className="font-display" style={{ fontSize: 18, fontWeight: 600, color: PALETTE.text }}>这个系统是做什么的？</span>
          </div>

          <div style={{ fontSize: 14, color: PALETTE.text, lineHeight: 1.8 }}>
            <p style={{ marginBottom: 16 }}>
              运营想做一个两周的集卡活动，要求<strong>全服只有约4%的玩家能完成</strong>。但直接抽卡的话：
            </p>
            <ul style={{ paddingLeft: 24, marginBottom: 16 }}>
              <li>如果卡牌太简单 → 完成率90%，玩家觉得没挑战</li>
              <li>如果卡牌太难 → 完成率0.1%，玩家觉得被骗</li>
            </ul>
            <p>
              这个系统帮你<strong>自动算出"降权系数"</strong>——当玩家已经有一张卡后，再抽第二张的概率会被乘以一个很小的数（比如0.0005），从而把完成率精准控制在4%左右。
            </p>
          </div>
        </div>

        {/* ========== 第二步：怎么用 ========== */}
        <div style={{ background: PALETTE.surface, borderRadius: 4, border: `1px solid ${PALETTE.border}`, padding: '28px 32px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: PALETTE.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>2</div>
            <span className="font-display" style={{ fontSize: 18, fontWeight: 600, color: PALETTE.text }}>操作流程（3步走）</span>
          </div>

          <Steps direction="vertical" current={-1} style={{ marginTop: 16 }} items={[
            {
              title: <span style={{ fontWeight: 600 }}>配置卡组</span>,
              description: (
                <div style={{ color: PALETTE.textMuted, lineHeight: 1.8 }}>
                  选择第一周的卡（比如 AAB）和第二周的卡（比如 CCD）。
                  <br/>
                  每张卡有基础概率：神奇卡(A) 2%，稀有卡(B-E) 各7%，普通卡(F-J) 各7%。
                </div>
              ),
            },
            {
              title: <span style={{ fontWeight: 600 }}>点击"开始求解"</span>,
              description: (
                <div style={{ color: PALETTE.textMuted, lineHeight: 1.8 }}>
                  系统自动跑蒙特卡洛模拟（约200次试验），尝试不同的降权系数组合。
                  <br/>
                  等待约10-30秒，系统会显示"已收敛"或结果。
                </div>
              ),
            },
            {
              title: <span style={{ fontWeight: 600 }}>查看系数并配置</span>,
              description: (
                <div style={{ color: PALETTE.textMuted, lineHeight: 1.8 }}>
                  系统给出每张卡的降权系数表（第2张起应用）。
                  <br/>
                  把这些系数填到游戏配置里，就完成了！
                </div>
              ),
            },
          ]} />
        </div>

        {/* ========== 第三步：理解降权系数的含义 ========== */}
        <div style={{ background: PALETTE.surface, borderRadius: 4, border: `1px solid ${PALETTE.border}`, padding: '28px 32px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: PALETTE.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>3</div>
            <span className="font-display" style={{ fontSize: 18, fontWeight: 600, color: PALETTE.text }}>核心原理：什么是"降权系数"？</span>
          </div>

          <div style={{ background: PALETTE.accentLight, padding: 20, borderRadius: 4, marginBottom: 20 }}>
            <p style={{ margin: 0, fontSize: 14, color: PALETTE.accent, fontWeight: 500 }}>
              核心规则：如果一张卡需要抽多张（比如HHF需要2张H），玩家抽第1张时概率正常，抽第2张起概率会被乘以"降权系数"（比如0.0005）。
            </p>
          </div>

          <Table size="small" dataSource={[
            { key: '1', hold: '0张', next: '第1张', reduce: false, desc: '正常概率，不降权' },
            { key: '2', hold: '1张', next: '第2张', reduce: true, desc: '概率 × 0.00001~0.05，极难抽到' },
            { key: '3', hold: '2张', next: '第3张', reduce: true, desc: '继续用极低系数' },
          ]} columns={[
            { title: '当前持有', dataIndex: 'hold', width: 100 },
            { title: '下一个副本', dataIndex: 'next', width: 100 },
            { title: '是否降权', dataIndex: 'reduce', width: 100, render: (v) => v ? <Tag color="error">降权</Tag> : <Tag color="success">正常</Tag> },
            { title: '说明', dataIndex: 'desc' },
          ]} pagination={false} />
        </div>

        {/* ========== 第四步：概率计算示例（正确版） ========== */}
        <div style={{ background: PALETTE.surface, borderRadius: 4, border: `1px solid ${PALETTE.border}`, padding: '28px 32px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: PALETTE.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>4</div>
            <span className="font-display" style={{ fontSize: 18, fontWeight: 600, color: PALETTE.text }}>概率计算示例（重点理解）</span>
          </div>

          <div style={{ background: '#f8f9fa', padding: 16, borderRadius: 4, marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: PALETTE.textMuted, marginBottom: 8 }}>场景设定</div>
            <div style={{ fontSize: 14, color: PALETTE.text }}>
              第一周卡组：<strong>HHF</strong>（需要2张H，1张F）<br/>
              当前背包：<strong>{'{H:1, F:1}'}</strong>（已经有了1张H和1张F，差1张H完成）<br/>
              降权系数：<strong>0.0005</strong>（系统计算得出）
            </div>
          </div>

          <span className="font-display" style={{ fontSize: 15, fontWeight: 600, color: PALETTE.text, display: 'block', marginBottom: 12 }}>步骤1：计算原始加权概率</span>
          <div style={{ padding: 16, background: PALETTE.bg, borderRadius: 4, fontSize: 13, fontFamily: "'IBM Plex Mono', monospace", lineHeight: 2, marginBottom: 20 }}>
            <div>H（当前持有1张，下一个是第2张→降权）: 14% × 0.0005 = <span style={{ color: PALETTE.accent, fontWeight: 600 }}>0.007%</span></div>
            <div>F（当前持有1张，只需要1张→不用降权）: 14% × 1 = 14%</div>
            <div>I（第二周卡，首次抽取→不用降权）: 14% × 1 = 14%</div>
            <div>A（背景卡，无特殊需求）: 2% × 1 = 2%</div>
            <div>B/C/D/E/G/J（其他背景卡）: 各 × 1 = 正常概率</div>
            <Divider style={{ margin: '12px 0', borderColor: PALETTE.border }} />
            <div>所有卡原始概率之和 = 99.907%（接近100%，因为H被压低了一点点）</div>
          </div>

          <span className="font-display" style={{ fontSize: 15, fontWeight: 600, color: PALETTE.text, display: 'block', marginBottom: 12 }}>步骤2：归一化（让总和精确等于100%）</span>
          <div style={{ padding: 16, background: PALETTE.bg, borderRadius: 4, fontSize: 13, fontFamily: "'IBM Plex Mono', monospace", lineHeight: 2, marginBottom: 20 }}>
            <div style={{ color: PALETTE.textMuted, marginBottom: 8 }}>公式：最终概率 = 原始概率 ÷ 原始总和 × 100%</div>
            <div>H最终 = 0.007 ÷ 99.907 × 100% = <span style={{ color: PALETTE.accent, fontWeight: 600 }}>0.007%</span>（基本不变，本来就很小）</div>
            <div>F最终 = 14 ÷ 99.907 × 100% = 14.013%（略微上升）</div>
            <div>A最终 = 2 ÷ 99.907 × 100% = 2.002%（略微上升）</div>
            <div>...</div>
          </div>

          <div style={{ background: PALETTE.success + '15', padding: 16, borderRadius: 4, borderLeft: `3px solid ${PALETTE.success}` }}>
            <span className="font-display" style={{ color: PALETTE.success, fontWeight: 600, fontSize: 14 }}>关键结论</span>
            <p style={{ margin: '8px 0 0', color: PALETTE.text, lineHeight: 1.8 }}>
              H的概率从14%骤降到0.007%（降幅2000倍），而玩家背包里已经有H和F了，只差这一张H就完成第一周。<br/>
              但这时候抽到H的概率几乎为0，只能一直抽一直抽，靠运气慢慢积累。<br/>
              <strong>这就是把完成率压到4%的核心机制。</strong>
            </p>
          </div>
        </div>

        {/* ========== 第五步：配表后怎么用 ========== */}
        <div style={{ background: PALETTE.surface, borderRadius: 4, border: `1px solid ${PALETTE.border}`, padding: '28px 32px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: PALETTE.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>5</div>
            <span className="font-display" style={{ fontSize: 18, fontWeight: 600, color: PALETTE.text }}>拿到系数后怎么配到游戏里？</span>
          </div>

          <div style={{ fontSize: 14, color: PALETTE.text, lineHeight: 1.8 }}>
            <p style={{ marginBottom: 16 }}>
              系统会给出类似这样的系数表：
            </p>

            <div style={{ background: PALETTE.bg, padding: 16, borderRadius: 4, marginBottom: 20, fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>
              <div style={{ color: PALETTE.textMuted, marginBottom: 8 }}>第一周系数</div>
              <div>H: 第1张=1.0, 第2张=0.0005</div>
              <div>F: 第1张=1.0</div>
              <div>A: 第1张=1.0, 第2张=0.0005, 第3张=0.0005</div>
              <div>...</div>
            </div>

            <p style={{ marginBottom: 16 }}>
              你需要把这张表交给<strong>后端开发</strong>，让他们在抽卡逻辑里加入这个系数判断：
            </p>

            <div style={{ background: '#f8f9fa', padding: 20, borderRadius: 4, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, lineHeight: 1.6 }}>
              <div style={{ color: PALETTE.textMuted }}>伪代码：</div>
              <div style={{ marginTop: 8 }}>
                <div><span style={{ color: '#0066cc' }}>function</span> <span style={{ color: PALETTE.accent }}>drawCard</span>(playerBackpack, targetCard) {'{'}</div>
                <div style={{ paddingLeft: 16 }}>baseProb = getBaseProbability(targetCard) <span style={{ color: PALETTE.textMuted }}>// H=14%</span></div>
                <div style={{ paddingLeft: 16 }}>holdCount = playerBackpack[targetCard] <span style={{ color: PALETTE.textMuted }}>// 玩家有几张</span></div>
                <div style={{ paddingLeft: 16 }}>nextCopyIndex = holdCount <span style={{ color: PALETTE.textMuted }}>// 下一个是第几张（0=第1张）</span></div>
                <div style={{ paddingLeft: 16 }}>coeff = coefficientTable[targetCard][nextCopyIndex] <span style={{ color: PALETTE.textMuted }}>// 查系数表</span></div>
                <div style={{ paddingLeft: 16 }}>finalProb = baseProb * coeff <span style={{ color: PALETTE.textMuted }}>// H第2张=14%*0.0005</span></div>
                <div style={{ paddingLeft: 16 }}><span style={{ color: '#0066cc' }}>return</span> weightedRandomDraw(finalProb)</div>
                <div>{'}'}</div>
              </div>
            </div>
          </div>
        </div>

        {/* ========== 第六步：常见问题 ========== */}
        <div style={{ background: PALETTE.surface, borderRadius: 4, border: `1px solid ${PALETTE.border}`, padding: '28px 32px', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: PALETTE.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>6</div>
            <span className="font-display" style={{ fontSize: 18, fontWeight: 600, color: PALETTE.text }}>常见问题</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <span className="font-display" style={{ fontSize: 15, fontWeight: 600, color: PALETTE.text, display: 'block', marginBottom: 8 }}>Q: 为什么3张卡的系数比5张卡低那么多？</span>
              <Text style={{ fontSize: 13, color: PALETTE.textMuted, lineHeight: 1.8 }}>
                3张卡组（如HHF）只有3个格子要填满，玩家有28次抽奖机会。如果不把系数压得极低（如0.0005），完成率会高达90%。5张卡有更多格子要填，自然更难完成，系数可以宽松一些。
              </Text>
            </div>
            <Divider style={{ margin: 0, borderColor: PALETTE.borderLight }} />
            <div>
              <span className="font-display" style={{ fontSize: 15, fontWeight: 600, color: PALETTE.text, display: 'block', marginBottom: 8 }}>Q: 系数0.0005是什么意思？玩家能感知到吗？</span>
              <Text style={{ fontSize: 13, color: PALETTE.textMuted, lineHeight: 1.8 }}>
                意思是抽到第2张H的概率是正常情况下的0.05%（二百分之一）。玩家可能会觉得"怎么老是抽不到最后一张"，但不会觉得不正常（本来就是随机抽卡）。设计目的就是让他感觉"差一点就集齐了"，但其实概率已经被大幅压低了。
              </Text>
            </div>
            <Divider style={{ margin: 0, borderColor: PALETTE.borderLight }} />
            <div>
              <span className="font-display" style={{ fontSize: 15, fontWeight: 600, color: PALETTE.text, display: 'block', marginBottom: 8 }}>Q: 跨周卡首张为什么可以正常抽？</span>
              <Text style={{ fontSize: 13, color: PALETTE.textMuted, lineHeight: 1.8 }}>
                如果第二周的Ⅰ卡在第一周就抽不到，那么第二周开始时就有一部分玩家根本没法参与。所以首张跨周卡概率是正常的，但第2张就极难（防止第一周囤太多）。
              </Text>
            </div>
            <Divider style={{ margin: 0, borderColor: PALETTE.borderLight }} />
            <div>
              <span className="font-display" style={{ fontSize: 15, fontWeight: 600, color: PALETTE.text, display: 'block', marginBottom: 8 }}>Q: 系统显示"未收敛"怎么办？</span>
              <Text style={{ fontSize: 13, color: PALETTE.textMuted, lineHeight: 1.8 }}>
                说明这个卡组组合很难同时让两周都接近4%。尝试更换卡组组合（比如第一周AAB，第二周CCF），或者放宽要求（接受3%或5%的完成率）。
              </Text>
            </div>
          </div>
        </div>

        {/* 返回按钮 */}
        <div style={{ textAlign: 'center', padding: '20px 0 40px' }}>
          <Button type="primary" size="large" icon={<ArrowLeftOutlined />} onClick={onNavigateToSelection} style={{ background: PALETTE.accent, borderColor: PALETTE.accent, borderRadius: 4, height: 48, padding: '0 40px', fontWeight: 500 }}>
            返回配置页面
          </Button>
        </div>
      </div>
    </div>
  );
}
