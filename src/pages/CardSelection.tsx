/**
 * 卡面选择页面路由
 */

import { CardSelectionPage } from '@/components/CardSelectionPage';

interface CardSelectionProps {
  onNavigateToConfig: () => void;
}

export function CardSelection({ onNavigateToConfig }: CardSelectionProps) {
  return <CardSelectionPage onNavigateToConfig={onNavigateToConfig} />;
}
