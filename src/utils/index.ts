/**
 * 工具函数
 */

export function generateFullSchedule(): Array<{ dayIndex: number; dayType: 'COMMON' | 'RARE' | 'MAGIC'; luckyCard: string }> {
  const weekTemplate: Array<'COMMON' | 'RARE' | 'MAGIC'> = [
    'COMMON', 'COMMON', 'COMMON', 'COMMON', 'COMMON',
    'RARE',
    'MAGIC',
  ];

  const shuffle = (arr: Array<'COMMON' | 'RARE' | 'MAGIC'>) => {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  };

  const week1 = shuffle(weekTemplate);
  const week2 = shuffle(weekTemplate);

  const allDays: Array<{ dayIndex: number; dayType: 'COMMON' | 'RARE' | 'MAGIC'; luckyCard: string }> = [];
  let dayIndex = 1;

  const getLuckyCard = (type: 'COMMON' | 'RARE' | 'MAGIC'): string => {
    switch (type) {
      case 'MAGIC': return 'A';
      case 'RARE': return ['B', 'C', 'D', 'E'][Math.floor(Math.random() * 4)];
      case 'COMMON': return ['F', 'G', 'H', 'I', 'J'][Math.floor(Math.random() * 5)];
    }
  };

  for (const type of [...week1, ...week2]) {
    allDays.push({
      dayIndex: dayIndex++,
      dayType: type,
      luckyCard: getLuckyCard(type),
    });
  }

  return allDays;
}
