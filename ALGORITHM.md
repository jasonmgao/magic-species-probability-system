# 概率计算算法详细说明

## 一、核心概念

### 1.1 卡池结构

```
卡池共 10 张卡：

┌────────────┬──────────┬─────────────┬──────────────┐
│ 卡片 ID    │ 稀有度   │ 卡片数量    │ 基础概率     │
├────────────┼──────────┼─────────────┼──────────────┤
│ A          │ 神奇卡   │ 1 张        │ 2%           │
│ B/C/D/E    │ 稀有卡   │ 4 张        │ 7% × 4 = 28% │
│ F/G/H/I/J  │ 普通卡   │ 5 张        │ 14% × 5 = 70%│
└────────────┴──────────┴─────────────┴──────────────┘

合计：2% + 28% + 70% = 100% ✓
```

### 1.2 幸运卡机制

- **每周日程**: 5 个普通日 + 1 个稀有日 + 1 个神奇日（顺序随机打乱）
- **普通日**: 5 张普通卡中随机 1 张为幸运卡，概率变为 **1.2%**
- **稀有日**: 4 张稀有卡中随机 1 张为幸运卡，概率变为 **1.2%**
- **神奇日**: 1 张神奇卡为幸运卡，概率变为 **1.2%**

### 1.3 两套组合卡机制

```
┌──────────┬──────────┬──────────┬──────────┐
│ 组合     │ 构成     │ 完成条件 │ 时间窗口 │
├──────────┼──────────┼──────────┼──────────┤
│ 第一套   │ AaB      │ A×2+B×1  │ 第 1-7 天│
│ 第二套   │ CcD      │ C×2+D×1  │ 第 1-14天│
└──────────┴──────────┴──────────┴──────────┘
```

**字母含义**:
- **大写字母**（A、B、C、D）= 该卡的第 1 张
- **小写字母**（a、c）= 该卡的第 2 张

## 二、归一化计算流程

### 2.1 输入参数

1. **基础概率表** `baseProbs`: 10 张卡的基础概率
2. **降权系数表** `coefficients`: 每张卡在不同持有数量下的系数
3. **当前背包** `backpack`: 用户当前持有的各卡数量
4. **今日状态** `dayState`: 日期类型和幸运卡 ID

### 2.2 计算步骤

#### Step 1: 设置幸运卡概率

```typescript
const adjustedProbs = { ...baseProbs };
adjustedProbs[dayState.luckyCard] = 1.2; // 固定为 1.2%
```

#### Step 2: 应用降权系数（A/B/C/D）

```typescript
for (const cardId of ['A', 'B', 'C', 'D']) {
  const holdCount = backpack[cardId] || 0;
  const coefficient = getCoefficient(cardId, holdCount);
  adjustedProbs[cardId] = adjustedProbs[cardId] * coefficient;
}
```

**降权系数表**:

| 卡片类型 | 持有 0 张 | 持有 1 张 | 持有≥2 张 |
|---------|----------|----------|----------|
| A/a     | 1.0      | **0.02** | 0        |
| B/b     | 1.0      | **0.02** | 0        |
| C/c     | 1.0      | **0.008**| 0        |
| D/d     | 1.0      | **0.008**| 0        |
| E-J     | 1.0      | 0        | -        |

#### Step 3: 填充卡第 2 张概率为 0

```typescript
for (const cardId of ['E', 'F', 'G', 'H', 'I', 'J']) {
  if (cardId !== dayState.luckyCard && backpack[cardId] >= 1) {
    adjustedProbs[cardId] = 0;
  }
}
```

#### Step 4: 计算 A/B/C/D 和幸运卡之外的概率

```typescript
// A/B/C/D 新概率之和
const abcdProb = ['A', 'B', 'C', 'D'].reduce((sum, card) => 
  sum + adjustedProbs[card], 0
);

// 剩余概率分配给 F-J（不含幸运卡）
const remainingProb = 100 - abcdProb - 1.2; // 1.2 是幸运卡概率
```

#### Step 5: 归一化分配剩余概率

```typescript
// 其他卡片（不含幸运卡）的原始概率总和
const otherCards = ['E', 'F', 'G', 'H', 'I', 'J'].filter(c => c !== luckyCard);
const otherCardsTotalBaseProb = otherCards.reduce((sum, card) => 
  sum + baseProbs[card], 0
);

// 按权重分配
for (const card of otherCards) {
  const weight = baseProbs[card] / otherCardsTotalBaseProb;
  finalProbs[card] = weight * remainingProb;
}
```

#### Step 6: 验证总和

```typescript
const total = Object.values(finalProbs).reduce((sum, p) => sum + p, 0);
assert(Math.abs(total - 100) < 0.0001); // 误差小于 0.01%
```

## 三、蒙特卡洛模拟算法

### 3.1 单次模拟流程

```
1. 初始化空背包
2. 生成 14 天随机日程
3. For day = 1 to 7:  // Week 1
     For draw = 1 to 4:
       card = simulateSingleDraw()
       backpack[card]++
4. Check: backpack[A] >= 2 && backpack[B] >= 1 ? 
   week1Complete = true : week1Complete = false
5. For day = 8 to 14:  // Week 2
     For draw = 1 to 4:
       card = simulateSingleDraw()
       backpack[card]++
6. Check: backpack[C] >= 2 && backpack[D] >= 1 ?
   week2Complete = true : week2Complete = false
7. Return { week1Complete, week2Complete }
```

### 3.2 单次抽卡模拟

```typescript
function simulateSingleDraw(backpack, dayState, baseProbs) {
  // 1. 根据当前背包状态和今日类型计算最终概率
  const finalProbs = calculateFinalProbability(backpack, dayState, baseProbs);
  
  // 2. 轮盘赌随机选择
  const random = Math.random() * 100;
  let cumulative = 0;
  
  for (const [cardId, prob] of Object.entries(finalProbs)) {
    cumulative += prob;
    if (random <= cumulative) {
      return cardId;
    }
  }
}
```

### 3.3 批量模拟统计

```typescript
const ITERATIONS = 100000;
let week1Success = 0;
let week2Success = 0;

for (let i = 0; i < ITERATIONS; i++) {
  const result = simulateFullGame();
  if (result.week1Complete) week1Success++;
  if (result.week2Complete) week2Success++;
}

const week1Rate = (week1Success / ITERATIONS) * 100;
const week2Rate = (week2Success / ITERATIONS) * 100;
```

## 四、推荐算法

### 4.1 推荐等级判定

```typescript
function getRecommendation(week1Rate, week2Rate) {
  const minRate = Math.min(week1Rate, week2Rate);
  
  if (minRate < 80) return '不推荐';
  if (minRate < 95) return '可接受';
  return '推荐';
}
```

### 4.2 推荐原因生成

```typescript
function getRecommendationReason(week1Rate, week2Rate) {
  const minRate = Math.min(week1Rate, week2Rate);
  
  if (minRate < 80) {
    return `集齐率过低 (${minRate.toFixed(1)}%)，用户难以完成收集`;
  }
  if (minRate < 95) {
    return `集齐率可接受 (${minRate.toFixed(1)}%)，但有优化空间`;
  }
  return `集齐率理想 (${minRate.toFixed(1)}%)，推荐此配置`;
}
```

## 五、期望抽卡次数估算

### 5.1 单卡期望

基于几何分布：

```
E[获得1张概率为p的卡] = 1/p 次抽卡
```

### 5.2 组合期望

```typescript
// Week 1 组合：A×2 + B×1
function estimateWeek1Draws(probs) {
  const eA = 2 * (100 / probs.A);  // 需要2张A
  const eB = 1 * (100 / probs.B);  // 需要1张B
  return Math.max(eA, eB);  // 近似
}
```

## 六、性能优化建议

### 6.1 Web Worker

蒙特卡洛模拟在后台线程运行，避免阻塞UI：

```typescript
// main.ts
const worker = new Worker(new URL('./simulation.worker.ts', import.meta.url));
worker.postMessage({ combination, iterations: 100000 });
worker.onmessage = (e) => {
  setSimulationResult(e.data);
};
```

### 6.2 分块计算

将10万次模拟分成1000次×100块，每块计算后让出控制权：

```typescript
async function runInChunks(combination, iterations, onProgress) {
  const chunkSize = 1000;
  let success = 0;
  
  for (let i = 0; i < iterations; i += chunkSize) {
    // 运行一块
    for (let j = 0; j < chunkSize; j++) {
      if (simulate(combination)) success++;
    }
    
    // 更新进度
    onProgress(i / iterations);
    
    // 让出控制权
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  
  return success / iterations;
}
```

## 七、精度保证

### 7.1 概率精度

- 计算过程使用 `number` 类型，保留 4 位小数
- 最终展示保留 2 位小数（百分比格式）
- 验证总和时使用 `Math.abs(total - 100) < 0.0001`

### 7.2 模拟精度

10万次蒙特卡洛模拟的精度：

```
95% 置信区间宽度 ≈ 2 × 1.96 × sqrt(p(1-p)/n)

当 p = 90% 时，n = 100000:
误差 ≈ 2 × 1.96 × sqrt(0.9×0.1/100000)
    ≈ 0.4%
```

因此10万次模拟可以将误差控制在 0.5% 以内。
