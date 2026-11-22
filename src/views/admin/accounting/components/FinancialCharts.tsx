import { Box, Stack, Typography } from '@mui/material';
import { money, percent } from '../financial-operations-utils';

export type FinancialSlice = { key: string; label: string; value: number; color: string };

export function DonutChart({ slices }: { slices: FinancialSlice[] }) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  let cursor = 0;
  const gradient =
    total > 0
      ? slices
          .map((slice) => {
            const start = cursor;
            const end = cursor + (slice.value / total) * 100;
            cursor = end;
            return `${slice.color} ${start}% ${end}%`;
          })
          .join(', ')
      : '#e5e7eb 0% 100%';
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} alignItems="center">
      <Box
        sx={{
          width: 142,
          height: 142,
          borderRadius: '50%',
          background: `conic-gradient(${gradient})`,
          position: 'relative',
          boxShadow: 'none',
          '&:after': {
            content: '""',
            position: 'absolute',
            inset: 28,
            borderRadius: '50%',
            bgcolor: 'background.paper',
          },
        }}
      >
        <Stack
          alignItems="center"
          justifyContent="center"
          sx={{ position: 'absolute', inset: 0, zIndex: 1 }}
        >
          <Typography fontSize={12} color="text.secondary">
            مجموع
          </Typography>
          <Typography fontSize={18} fontWeight={800}>
            {money(total)}
          </Typography>
        </Stack>
      </Box>
      <Stack gap={0.75} sx={{ flex: 1, width: '100%' }}>
        {slices.length ? (
          slices.map((slice) => (
            <Stack key={slice.key} direction="row" justifyContent="space-between" gap={1}>
              <Stack direction="row" gap={1} alignItems="center">
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: slice.color }} />
                <Typography fontSize={13}>{slice.label}</Typography>
              </Stack>
              <Typography fontSize={13} color="text.secondary">
                {percent((slice.value / total) * 100)}
              </Typography>
            </Stack>
          ))
        ) : (
          <Typography fontSize={13} color="text.secondary">
            داده‌ای برای نمایش نیست.
          </Typography>
        )}
      </Stack>
    </Stack>
  );
}

export function FloatingTrendChart({
  rows,
}: {
  rows: Array<{ _id: { month: string; code: string }; credit?: number; debit?: number }>;
}) {
  const points = rows.map((row, index) => ({
    key: `${row._id.month}-${row._id.code}-${index}`,
    label: row._id.month,
    code: row._id.code,
    value: Math.abs((row.credit ?? 0) - (row.debit ?? 0)),
  }));
  const max = Math.max(1, ...points.map((point) => point.value));
  const width = 520;
  const height = 190;
  const step = points.length > 1 ? width / (points.length - 1) : width;
  const path = points
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'} ${index * step} ${height - 18 - (point.value / max) * 142}`,
    )
    .join(' ');
  return (
    <Box sx={{ width: '100%', overflow: 'hidden' }}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="220" role="img">
        <defs>
          <linearGradient id="accountingTrendFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.26" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((line) => (
          <line
            key={line}
            x1="0"
            x2={width}
            y1={30 + line * 38}
            y2={30 + line * 38}
            stroke="#e5e7eb"
            strokeWidth="1"
          />
        ))}
        {points.length ? (
          <>
            <path
              d={`${path} L ${width} ${height} L 0 ${height} Z`}
              fill="url(#accountingTrendFill)"
            />
            <path d={path} fill="none" stroke="#2563eb" strokeWidth="4" strokeLinecap="round" />
            {points.map((point, index) => {
              const x = index * step;
              const y = height - 18 - (point.value / max) * 142;
              return (
                <g key={point.key}>
                  <circle
                    cx={x}
                    cy={y}
                    r="7"
                    fill={point.code === '4101' ? '#16a34a' : '#dc2626'}
                    stroke="#fff"
                    strokeWidth="3"
                  />
                  <title>{`${point.label}: ${money(point.value)}`}</title>
                </g>
              );
            })}
          </>
        ) : null}
      </svg>
    </Box>
  );
}
