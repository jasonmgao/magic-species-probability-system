/**
 * 概率配置页面路由
 */

import { ProbabilityConfigPage } from '@/components/ProbabilityConfigPage';

interface ProbabilityConfigProps {
  onNavigateToSelection: () => void;
}

export function ProbabilityConfig({ onNavigateToSelection }: ProbabilityConfigProps) {
  return <ProbabilityConfigPage onNavigateToSelection={onNavigateToSelection} />;
}
