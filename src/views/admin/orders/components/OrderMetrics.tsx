'use client';

import { Card, CardContent, Grid, LinearProgress, Stack, Typography } from '@mui/material';
import PaidRoundedIcon from '@mui/icons-material/PaidRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';

import { formatToman, STATUS_LABELS, STATUS_COLORS, type InvoiceStatus } from '../constants';

export interface StatusMetric {
  status: InvoiceStatus;
  count: number;
  revenue: number;
}

interface OrderMetricsProps {
  totalCount: number;
  metrics: StatusMetric[];
}

export default function OrderMetrics({ totalCount, metrics }: OrderMetricsProps) {
  return (
    <Grid container spacing={2}>


      {metrics.map((metric) => {
        const { bg, color, border } = STATUS_COLORS[metric.status];
        const share = totalCount > 0 ? Math.round((metric.count / totalCount) * 100) : 0;
        return (
          <Grid key={metric.status} size={{ xs: 12, sm: 6, md: 4 }}>
            <Card
              variant="outlined"
              sx={{
                height: '100%',
                borderColor: border,
                bgcolor: bg,
              }}
            >
              <CardContent>
                <Stack spacing={1.5}>
                  <Typography variant="subtitle1" sx={{ color, fontWeight: 700 }}>
                    {STATUS_LABELS[metric.status]}
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, color }}>
                    {metric.count.toLocaleString('fa-IR')} سفارش
                  </Typography>
                  <Typography variant="body2" sx={{ color: `${color}CC` }}>
                    {formatToman(metric.revenue)}
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={share}
                    sx={{
                      height: 6,
                      borderRadius: 999,
                      bgcolor: `${color}22`,
                      '& .MuiLinearProgress-bar': {
                        bgcolor: color,
                        borderRadius: 999,
                      },
                    }}
                  />
                  <Typography variant="caption" sx={{ color: `${color}99` }}>
                    سهم {share}% از کل سفارش‌ها
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        );
      })}
    </Grid>
  );
}
