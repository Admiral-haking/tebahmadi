'use client';

import { alpha, Card, CardContent, Grid, LinearProgress, Stack, Typography } from '@mui/material';
import { formatToman } from '../../orders/constants';




interface OrderMetricsProps {
    amount: number;
    name: string;
    color: string;
    count: number;
    allCount: number
}

export default function SellMetrics({ amount, color, name, count, allCount }: OrderMetricsProps) {
    const share = Math.trunc((count / allCount) * 100);
    return (
        <Card
            variant="outlined"
            sx={{
                height: '100%',
                borderColor: alpha(color, .9),
                color: color,
                minHeight: 200
            }}
        >
            <CardContent>
                <Stack spacing={1.5}>
                    <Typography variant="subtitle1" sx={{ color, fontWeight: 700 }}>
                        {name}
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 800, color }}>
                        {count.toLocaleString('fa-IR')} سفارش
                    </Typography>
                    <Typography variant="body2" sx={{ color: `${color}CC` }}>
                        {formatToman(amount)}
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
    );
}
