import { Button, Stack } from '@mui/material';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';

import { buildOperationsUrl } from '../financial-operations-utils';

type FinancialExportActionsProps = { from?: string; to?: string };

const exports = [
  ['trial-balance-csv', 'CSV تراز'],
  ['journal-csv', 'CSV روزنامه'],
  ['general-ledger-csv', 'CSV کل'],
  ['settlements-csv', 'CSV تسویه'],
  ['tax-report-csv', 'CSV مالیات'],
] as const;

export function FinancialExportActions({ from, to }: FinancialExportActionsProps) {
  return (
    <Stack direction="row" gap={1} flexWrap="wrap">
      {exports.map(([format, label]) => (
        <Button
          key={format}
          component="a"
          href={buildOperationsUrl(format, from, to)}
          startIcon={<DownloadRoundedIcon />}
        >
          {label}
        </Button>
      ))}
    </Stack>
  );
}
