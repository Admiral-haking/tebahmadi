import {
  Alert,
  Card,
  CardContent,
  Chip,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { TAPIN_TASK_STATUSES, TAPIN_TASK_TYPES, type TapinOverview } from './tapin-dashboard.types';

type Props = { data?: TapinOverview; loading: boolean; onTaskClick: (id: string) => void };

export function TapinDashboardDataSections({ data, loading, onTaskClick }: Props) {
  return (
    <>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" mb={2}>
                آخرین تراکنش‌های افزایش اعتبار
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>مبلغ</TableCell>
                      <TableCell>روش</TableCell>
                      <TableCell>وضعیت</TableCell>
                      <TableCell>تاریخ</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(data?.transactions.list ?? []).map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          {Math.round(item.price / 10).toLocaleString('fa-IR')} تومان
                        </TableCell>
                        <TableCell>{item.pay_type_description}</TableCell>
                        <TableCell>{item.status_description}</TableCell>
                        <TableCell>{item.create_at}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              {!loading && !data?.transactions.list.length ? (
                <Alert severity="info" sx={{ mt: 2 }}>
                  تراکنشی ثبت نشده است.
                </Alert>
              ) : null}
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" mb={2}>
                کارهای گروهی تاپین
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>نوع</TableCell>
                      <TableCell>وضعیت</TableCell>
                      <TableCell>تاریخ</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(data?.tasks.list ?? []).map((item) => (
                      <TableRow
                        key={item.id}
                        hover
                        onClick={() => onTaskClick(item.id)}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell>
                          {TAPIN_TASK_TYPES[item.task_type] ?? `نوع ${item.task_type}`}
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            color={
                              item.task_status === 4
                                ? 'error'
                                : item.task_status === 3
                                  ? 'success'
                                  : 'default'
                            }
                            label={
                              TAPIN_TASK_STATUSES[item.task_status] ?? `کد ${item.task_status}`
                            }
                          />
                        </TableCell>
                        <TableCell>{item.created_at}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              {!loading && !data?.tasks.list.length ? (
                <Alert severity="info" sx={{ mt: 2 }}>
                  کاری در صف نیست.
                </Alert>
              ) : null}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" mb={2}>
                آخرین مشتریان تاپین
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>نام</TableCell>
                      <TableCell>موبایل</TableCell>
                      <TableCell>تاریخ عضویت</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(data?.customers.list ?? []).map((item) => (
                      <TableRow key={item.customer_id}>
                        <TableCell>
                          {item.first_name} {item.last_name}
                        </TableCell>
                        <TableCell dir="ltr">{item.mobile}</TableCell>
                        <TableCell>{item.created_at}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              {!loading && !data?.customers.list.length ? (
                <Alert severity="info" sx={{ mt: 2 }}>
                  مشتری‌ای در دفترچه تاپین نیست.
                </Alert>
              ) : null}
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" mb={2}>
                کارکنان فروشگاه تاپین
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>نام</TableCell>
                      <TableCell>نام کاربری</TableCell>
                      <TableCell>کد</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(data?.employees.list ?? []).map((item) => (
                      <TableRow key={`${item.username}-${item.employee_code}`}>
                        <TableCell>
                          {item.first_name} {item.last_name}
                        </TableCell>
                        <TableCell dir="ltr">{item.username}</TableCell>
                        <TableCell>{item.employee_code}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </>
  );
}
