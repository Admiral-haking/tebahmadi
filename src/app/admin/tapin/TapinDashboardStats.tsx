import { Card, CardContent, Grid, Typography } from '@mui/material';
import { memo } from 'react';

export const TapinDashboardStats = memo(function TapinDashboardStats({
  items,
}: {
  items: Array<[string, string]>;
}) {
  return (
    <Grid container spacing={2}>
      {items.map(([title, value]) => (
        <Grid key={title} size={{ xs: 12, sm: 6, md: 3 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography color="text.secondary" variant="body2">
                {title}
              </Typography>
              <Typography variant="h5" mt={1}>
                {value}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
});
