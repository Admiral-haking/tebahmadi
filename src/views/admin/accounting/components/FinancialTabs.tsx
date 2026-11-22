import { Tab, Tabs } from '@mui/material';

export type FinancialTab = 'statements' | 'journal' | 'expense' | 'settlement' | 'cash' | 'period';

type FinancialTabsProps = {
  value: FinancialTab;
  onChange: (value: FinancialTab) => void;
};

export function FinancialTabs({ value, onChange }: FinancialTabsProps) {
  return (
    <Tabs
      value={value}
      onChange={(_, nextValue: FinancialTab) => onChange(nextValue)}
      variant="scrollable"
    >
      <Tab value="statements" label="صورت‌های مالی" />
      <Tab value="journal" label="دفتر روزنامه" />
      <Tab value="expense" label="هزینه‌ها" />
      <Tab value="settlement" label="تسویه‌ها" />
      <Tab value="cash" label="بانک و صندوق" />
      <Tab value="period" label="دوره مالی" />
    </Tabs>
  );
}
