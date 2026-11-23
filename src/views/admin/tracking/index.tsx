"use client";

import {
  BSL_TRANSPORT_LABELS,
  BSL_TRANSPORTS,
} from "@/basalaam/constants/route";
import {
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  Container,
  Grid,
  LinearProgress,
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  MenuItem,
  Pagination,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ITRackServiceIdType, TrackingListResponse } from "./type";
import { useRouter, useSearchParams } from "next/navigation";
import { getTrackServiceLabel, TrackServiceIcon } from "./utils/service-utils";
import { normalizeServiceAmount } from "./utils/amount";
import { PageJumper } from "@/components/search/pagination";
import Orderly from "@/components/orderly";
import Link from "next/link";
import { RefreshButton } from "@/components/refresh";
import SellMetrics from "./components/metric";
import { blue, green, orange, pink, purple, red } from "@mui/material/colors";
import { PATCH } from "@/utils/fetch";
import { buildShippingCopyText } from "@/orders/utils/shippingText";

const dateFormatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  dateStyle: "medium",
  timeStyle: "short",
});

const orderStatusLabels: Record<string, string> = {
  draft: "پیش‌نویس",
  pending: "در انتظار پرداخت",
  paid: "پرداخت شده",
  refunded: "مرجوع شده",
  canceled: "لغو شده",
};

/** Digikala shipment/order statuses → Persian (per Digikala Open API). */
const dgkStatusLabels: Record<string, string> = {
  new: "جدید",
  received: "دریافت‌شده",
  partially_received: "دریافت ناقص",
  rejected: "رد شده",
  error: "خطا",
  deleted: "حذف‌شده",
  waiting: "در انتظار ارسال",
  pending: "در انتظار ارسال",
};

/** Map a raw status string to its Persian label, falling back to the raw value. */
function statusToFa(raw?: string): string | null {
  const key = String(raw ?? "").trim().toLowerCase();
  if (!key) return null;
  return dgkStatusLabels[key] ?? orderStatusLabels[key] ?? raw ?? null;
}

/** Distinct, non-empty tracking codes for a tracker row. */
function trackingCodesOf(item: { items: { trackingCode?: string }[] }): string[] {
  return Array.from(
    new Set(item.items.map((x) => x.trackingCode).filter((x): x is string => !!x)),
  );
}

function toEnglishDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}

function div(a: number, b: number) {
  return ~~(a / b);
}

function jalaliToGregorian(
  jy: number,
  jm: number,
  jd: number,
): [number, number, number] {
  jy += 1595;
  let days = -355668 + 365 * jy + div(jy, 33) * 8 + div((jy % 33) + 3, 4) + jd;
  days += jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186;
  let gy = 400 * div(days, 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * div(--days, 36524);
    days %= 36524;
    if (days >= 365) days += 1;
  }
  gy += 4 * div(days, 1461);
  days %= 1461;
  if (days > 365) {
    gy += div(days - 1, 365);
    days = (days - 1) % 365;
  }
  const gd = days + 1;
  const salA = [
    0,
    31,
    (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  let gm = 0;
  while (gm < 13 && gd > salA[gm]) {
    gm += 1;
  }
  let day = gd;
  for (let i = 1; i < gm; i += 1) day -= salA[i];
  return [gy, gm, day];
}

function parseJalaliDateToIso(value: string): string | null {
  const normalized = toEnglishDigits(value.trim()).replace(/[-.]/g, "/");
  if (!normalized) return "";
  const match = normalized.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!match) return null;
  const jy = Number(match[1]);
  const jm = Number(match[2]);
  const jd = Number(match[3]);
  if (
    !Number.isFinite(jy) ||
    !Number.isFinite(jm) ||
    !Number.isFinite(jd) ||
    jm < 1 ||
    jm > 12 ||
    jd < 1 ||
    jd > 31
  ) {
    return null;
  }
  const [gy, gm, gd] = jalaliToGregorian(jy, jm, jd);
  return `${gy}-${String(gm).padStart(2, "0")}-${String(gd).padStart(2, "0")}`;
}

function formatJalaliQueryDate(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(date)
    .replace(/\u200e/g, "");
}

type IStatistic = {
  _id: ITRackServiceIdType | "other";
  amount: number;
  count: number;
};

const colors: Record<ITRackServiceIdType | "other", string> = {
  basalaam: orange[600],
  dgk: red[600],
  snapp: pink[600],
  website: green[500],
  other: blue[500],
};

const names: Record<ITRackServiceIdType | "other", string> = {
  basalaam: "باسلام",
  dgk: "دیجی کالا",
  snapp: "اسنپ‌شاپ",
  website: "وب‌سایت",
  other: "متفرقه",
};
const amounts: Record<ITRackServiceIdType | "other", number> = {
  basalaam: 10,
  dgk: 10,
  snapp: 10,
  website: 1,
  other: 1,
};

export default function Tracking() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const q = searchParams?.get("q") ?? "";
  const from = searchParams?.get("from") ?? "";
  const to = searchParams?.get("to") ?? "";
  const serviceId = searchParams?.get("serviceId") ?? "";
  const orderStatus = searchParams?.get("orderStatus") ?? "";
  const progressState = searchParams?.get("progressState") ?? "";
  const shippingServiceName = searchParams?.get("shippingServiceName") ?? "";
  const location = searchParams?.get("location") ?? "";
  const hasTrackingCode = searchParams?.get("hasTrackingCode") ?? "";
  const [loading, setLoading] = useState(false);
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  const [response, setResponse] = useState<TrackingListResponse>();
  const [statistics, setStatistics] = useState<IStatistic[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [searchDraft, setSearchDraft] = useState(q);
  const [fromDraft, setFromDraft] = useState(formatJalaliQueryDate(from));
  const [toDraft, setToDraft] = useState(formatJalaliQueryDate(to));
  const [serviceDraft, setServiceDraft] = useState(serviceId);
  const [orderStatusDraft, setOrderStatusDraft] = useState(orderStatus);
  const [progressStateDraft, setProgressStateDraft] = useState(progressState);
  const [shippingServiceDraft, setShippingServiceDraft] =
    useState(shippingServiceName);
  const [locationDraft, setLocationDraft] = useState(location);
  const [trackingCodeDraft, setTrackingCodeDraft] = useState(hasTrackingCode);
  const [actionLoading, setActionLoading] = useState(false);
  const trackingAbortRef = useRef<AbortController | null>(null);
  const metricsAbortRef = useRef<AbortController | null>(null);

  const statAll = statistics.reduce((t, c) => t + c.count, 0);

  const [page, setPage] = useState(1);

  function handleLoadMetrics() {
    metricsAbortRef.current?.abort();
    const controller = new AbortController();
    metricsAbortRef.current = controller;
    setLoadingMetrics(true);

    fetch(`/api/admin/tracking/statistics`, {
      credentials: "include",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(await response.text());
        return response.json() as Promise<{ overall: IStatistic[] }>;
      })
      .then((res) => {
        setStatistics(
          res.overall.map((x) => ({ ...x, amount: x.amount / amounts[x._id] })),
        );
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        toast.error("خطا در بارگیری آمار فروش");
      })
      .finally(() => {
        if (metricsAbortRef.current === controller) setLoadingMetrics(false);
      });
  }

  function handleLoadTracking(enrich = false) {
    trackingAbortRef.current?.abort();
    const controller = new AbortController();
    trackingAbortRef.current = controller;
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (serviceId) params.set("serviceId", serviceId);
    if (orderStatus) params.set("orderStatus", orderStatus);
    if (progressState) params.set("progressState", progressState);
    if (shippingServiceName) params.set("shippingServiceName", shippingServiceName);
    if (location) params.set("location", location);
    if (hasTrackingCode) params.set("hasTrackingCode", hasTrackingCode);
    if (enrich) params.set("enrich", "1");
    params.set("page", `${page}`);
    params.set("limit", "50");

    fetch(`/api/admin/tracking?${params.toString()}`, {
      credentials: "include",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(await response.text());
        return response.json() as Promise<TrackingListResponse>;
      })
      .then((res) => {
        setResponse(res);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        toast.error("خطا در بارگیری سفارش‌ها");
      })
      .finally(() => {
        if (trackingAbortRef.current === controller) setLoading(false);
      });
  }

  function handleLiveRefresh() {
    handleLoadTracking(true);
  }

  function handleApplyFilters() {
    const fromIso = parseJalaliDateToIso(fromDraft);
    const toIso = parseJalaliDateToIso(toDraft);
    if (fromIso === null || toIso === null) {
      toast.error("تاریخ را به شمسی و با فرمت ۱۴۰۳/۰۱/۱۵ وارد کنید.");
      return;
    }
    const params = new URLSearchParams();
    if (searchDraft.trim()) params.set("q", searchDraft.trim());
    if (fromIso) params.set("from", fromIso);
    if (toIso) params.set("to", toIso);
    if (serviceDraft) params.set("serviceId", serviceDraft);
    if (orderStatusDraft) params.set("orderStatus", orderStatusDraft);
    if (progressStateDraft) params.set("progressState", progressStateDraft);
    if (shippingServiceDraft.trim()) params.set("shippingServiceName", shippingServiceDraft.trim());
    if (locationDraft.trim()) params.set("location", locationDraft.trim());
    if (trackingCodeDraft) params.set("hasTrackingCode", trackingCodeDraft);
    router.push(`/admin/tracking?${params.toString()}`);
    setPage(1);
  }

  function handleClearFilters() {
    setSearchDraft("");
    setFromDraft("");
    setToDraft("");
    setServiceDraft("");
    setOrderStatusDraft("");
    setProgressStateDraft("");
    setShippingServiceDraft("");
    setLocationDraft("");
    setTrackingCodeDraft("");
    setPage(1);
    router.push("/admin/tracking");
  }

  function formatShippingText(item: TrackingListResponse["items"][number]) {
    return buildShippingCopyText({
      customerName: item.customerName,
      customerPhone: item.customerPhone,
      postalCode: item.customerPostalCode,
      state: item.customerState,
      city: item.customerCity,
      address: item.customerAddress,
      houseNumber: item.customerHouseNumber,
      houseUnit: item.customerHouseUnit,
      items: item.items,
    });
  }

  function handleToggleSelected(id: string) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  function handleCopySelected() {
    const rows =
      response?.items.filter((item) => selected.includes(item._id)) || [];
    const text = rows.map(formatShippingText).join("\n");
    if (!text) return toast.error("هیچ سفارشی انتخاب نشده است.");

    navigator.clipboard
      .writeText(text)
      .then(() => toast.success("متن سفارش‌ها کپی شد."))
      .catch(() => toast.error("کپی کردن متن سفارش‌ها انجام نشد."));
  }

  function handleCopyOne(item: TrackingListResponse["items"][number]) {
    navigator.clipboard
      .writeText(formatShippingText(item))
      .then(() => toast.success("متن سفارش کپی شد."))
      .catch(() => toast.error("کپی کردن متن سفارش انجام نشد."));
  }

  function handleBasalaamAction(
    item: TrackingListResponse["items"][number],
    action: "basalaam-accept" | "basalaam-send",
    trackingCode?: string,
    shippingServiceId?: string,
  ) {
    setActionLoading(true);
    PATCH("/api/admin/tracking", {
      id: item._id,
      action,
      trackingCode,
      shippingServiceId,
    })
      .then(() => {
        toast.success("درخواست با موفقیت ثبت شد.");
        handleLoadTracking(true);
      })
      .catch(() => toast.error("ثبت درخواست با خطا مواجه شد."))
      .finally(() => setActionLoading(false));
  }

  function handleWebsiteAction(
    item: TrackingListResponse["items"][number],
    payload: Record<string, string>,
  ) {
    setActionLoading(true);
    PATCH("/api/admin/tracking", {
      id: item._id,
      action: "website-update",
      ...payload,
    })
      .then(() => {
        toast.success("سفارش وب‌سایت بروزرسانی شد.");
        handleLoadTracking(true);
      })
      .catch(() => toast.error("بروزرسانی سفارش وب‌سایت انجام نشد."))
      .finally(() => setActionLoading(false));
  }

  useEffect(() => {
    handleLoadTracking();
  }, [page, q, from, to, serviceId, orderStatus, progressState, shippingServiceName, location, hasTrackingCode]);
  useEffect(() => {
    handleLoadMetrics();
    return () => metricsAbortRef.current?.abort();
  }, []);
  useEffect(() => () => trackingAbortRef.current?.abort(), []);
  useEffect(() => {
    setSearchDraft(q);
    setFromDraft(formatJalaliQueryDate(from));
    setToDraft(formatJalaliQueryDate(to));
    setServiceDraft(serviceId);
    setOrderStatusDraft(orderStatus);
    setProgressStateDraft(progressState);
    setShippingServiceDraft(shippingServiceName);
    setLocationDraft(location);
    setTrackingCodeDraft(hasTrackingCode);
  }, [q, from, to, serviceId, orderStatus, progressState, shippingServiceName, location, hasTrackingCode]);

  return (
    <Container maxWidth="lg" sx={{ my: 4 }}>
      <Grid container spacing={1} sx={{ mb: 4 }}>
        {statistics.length === 0 && loadingMetrics
          ? [1, 2, 3].map((x) => (
              <Grid
                size={{ xs: 12, sm: 6, md: 4, lg: x === 1 ? 3 : 2 }}
                key={x}
              >
                <Skeleton variant="rounded" width="100%" height={200} />
              </Grid>
            ))
          : statistics
              .sort((a, b) => b.amount - a.amount)
              .map((x, i) => (
                <Grid
                  size={{ xs: 12, sm: 6, md: 4, lg: i === 0 ? 3 : 2 }}
                  key={x._id}
                >
                  <SellMetrics
                    allCount={statAll}
                    amount={x.amount}
                    color={colors[x._id]}
                    count={x.count}
                    name={names[x._id]}
                  />
                </Grid>
              ))}
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
          <SellMetrics
            allCount={statAll}
            amount={statistics.reduce(
              (t, c) =>
                t +
                (c._id !== "website" && c._id === "other"
                  ? c.amount / 10
                  : c.amount),
              0,
            )}
            color={purple[800]}
            count={statAll}
            name={"جمع همه"}
          />
        </Grid>
      </Grid>
      <Stack direction="row" gap={2} alignItems="center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={48}
          height={48}
          viewBox="0 0 24 24"
        >
          <path
            fill="currentColor"
            fillRule="evenodd"
            d="M12.75 2a.75.75 0 0 0-1.5 0v1.5H6.704c-.658 0-.986 0-1.288.098a2 2 0 0 0-.383.17c-.274.16-.494.404-.933.894c-.85.947-1.276 1.42-1.379 1.974a2 2 0 0 0 0 .728c.103.553.528 1.027 1.379 1.974c.44.49.659.734.933.893q.183.105.383.17c.302.099.63.099 1.288.099h4.546v2H6.5c-1.404 0-2.107 0-2.611.337a2 2 0 0 0-.552.552C3 13.893 3 14.596 3 16s0 2.107.337 2.611a2 2 0 0 0 .552.552c.504.337 1.207.337 2.611.337h4.75v1.75H10a.75.75 0 0 0 0 1.5h4a.75.75 0 0 0 0-1.5h-1.25V19.5h4.546c.658 0 .986 0 1.288-.098q.2-.066.383-.17c.274-.16.494-.404.933-.894c.85-.947 1.276-1.42 1.379-1.974a2 2 0 0 0 0-.728c-.103-.553-.528-1.027-1.379-1.974c-.44-.49-.659-.734-.933-.893a2 2 0 0 0-.383-.17c-.302-.099-.63-.099-1.288-.099H12.75v-2h4.75c1.404 0 2.107 0 2.611-.337a2 2 0 0 0 .552-.552C21 9.107 21 8.404 21 7s0-2.107-.337-2.611a2 2 0 0 0-.552-.552C19.607 3.5 18.904 3.5 17.5 3.5h-4.75z"
            clipRule="evenodd"
          ></path>
        </svg>
        <Stack>
          <Typography variant="h4">رهگیری مرسوله</Typography>
          <Typography variant="caption">
            پیگیری سفارش‌ها و مرسوله‌ها در همه پلتفرم‌ها
          </Typography>
        </Stack>
        <Box flex="1 1 auto" />
        <Button variant="contained">ایجاد فاکتور دستی</Button>
      </Stack>

      <Box
        sx={{
          mb: 3,
          p: 2,
          border: 1,
          borderColor: "divider",
          borderRadius: 2,
          bgcolor: "background.paper",
        }}
      >
        <Grid container spacing={1.25} alignItems="center">
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              label="جستجو"
              placeholder="شماره سفارش، نام، تلفن، کالا، کد رهگیری..."
              size="small"
              fullWidth
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <TextField
              select
              value={serviceDraft}
              onChange={(event) => setServiceDraft(event.target.value)}
              label="پلتفرم"
              size="small"
              fullWidth
            >
              <MenuItem value="">همه</MenuItem>
              <MenuItem value="website">وب‌سایت</MenuItem>
              <MenuItem value="dgk">دیجی کالا</MenuItem>
              <MenuItem value="basalaam">باسلام</MenuItem>
              <MenuItem value="snapp">اسنپ‌شاپ</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <TextField
              select
              value={orderStatusDraft}
              onChange={(event) => setOrderStatusDraft(event.target.value)}
              label="وضعیت سفارش"
              size="small"
              fullWidth
            >
              <MenuItem value="">همه وضعیت‌ها</MenuItem>
              <MenuItem value="draft">پیش‌نویس</MenuItem>
              <MenuItem value="pending">در انتظار پرداخت</MenuItem>
              <MenuItem value="paid">پرداخت شده</MenuItem>
              <MenuItem value="refunded">مرجوع شده</MenuItem>
              <MenuItem value="canceled">لغو شده</MenuItem>
              <MenuItem value="new">جدید</MenuItem>
              <MenuItem value="accepted">پذیرفته شده</MenuItem>
              <MenuItem value="processing">در حال پردازش</MenuItem>
              <MenuItem value="shipped">ارسال شده</MenuItem>
              <MenuItem value="delivered">تحویل شده</MenuItem>
              <MenuItem value="cancelled">کنسل شده</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <TextField
              select
              value={progressStateDraft}
              onChange={(event) => setProgressStateDraft(event.target.value)}
              label="مرحله ارسال"
              size="small"
              fullWidth
            >
              <MenuItem value="">همه مراحل</MenuItem>
              <MenuItem value="in_progress">در حال آماده‌سازی</MenuItem>
              <MenuItem value="packaged_posted">بسته‌بندی/ارسال شده</MenuItem>
              <MenuItem value="order_finished">تمام شده</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <TextField
              select
              value={trackingCodeDraft}
              onChange={(event) => setTrackingCodeDraft(event.target.value)}
              label="کد رهگیری"
              size="small"
              fullWidth
            >
              <MenuItem value="">همه</MenuItem>
              <MenuItem value="yes">دارای کد رهگیری</MenuItem>
              <MenuItem value="no">بدون کد رهگیری</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <TextField
              value={shippingServiceDraft}
              onChange={(event) => setShippingServiceDraft(event.target.value)}
              label="روش ارسال"
              placeholder="پست، تیپاکس، پیک..."
              size="small"
              fullWidth
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <TextField
              value={locationDraft}
              onChange={(event) => setLocationDraft(event.target.value)}
              label="شهر/استان/کدپستی"
              placeholder="تهران، اصفهان..."
              size="small"
              fullWidth
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 1.7 }}>
            <TextField
              value={fromDraft}
              onChange={(event) => setFromDraft(event.target.value)}
              label="از تاریخ"
              placeholder="۱۴۰۳/۰۱/۱۵"
              size="small"
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 1.7 }}>
            <TextField
              value={toDraft}
              onChange={(event) => setToDraft(event.target.value)}
              label="تا تاریخ"
              placeholder="۱۴۰۳/۰۱/۱۵"
              size="small"
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Grid>
          <Grid size={{ xs: 12, md: 1.6 }}>
            <Stack
              direction="row"
              gap={1}
              justifyContent={{ xs: "stretch", md: "flex-end" }}
            >
              <Button
                variant="contained"
                onClick={handleApplyFilters}
                fullWidth
              >
                اعمال
              </Button>
            </Stack>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Stack direction={{ xs: "column", sm: "row" }} gap={1}>
              <Button
                variant="outlined"
                disabled={!selected.length}
                onClick={handleCopySelected}
              >
                کپی متن {selected.length ? `(${selected.length})` : ""}
              </Button>
              <Button variant="text" onClick={handleClearFilters}>
                پاک کردن فیلترها
              </Button>
              <Button variant="outlined" color="warning" onClick={handleLiveRefresh} disabled={loading}>
                بروزرسانی زنده سرویس‌ها
              </Button>
              <RefreshButton onClick={() => handleLoadTracking()} />
            </Stack>
          </Grid>
        </Grid>
      </Box>
      {(loading || actionLoading) && <LinearProgress />}

      <TableContainer>
        <Table sx={{ minWidth: 1024 }}>
          <TableHead>
            <TableRow>
              <TableCell>#</TableCell>
              <TableCell padding="checkbox"></TableCell>
              <TableCell>سفارش</TableCell>
              <TableCell>گیرنده</TableCell>
              <TableCell>رهگیری</TableCell>
              <TableCell>مبلغ</TableCell>
              <TableCell></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && !response ? (
              Array.from({ length: 6 }).map((_, index) => (
                <TableRow key={`loading-${index}`}>
                  <TableCell colSpan={7}>
                    <Skeleton variant="rounded" height={56} />
                  </TableCell>
                </TableRow>
              ))
            ) : null}
            {response?.items.map((item, i) => (
              <TableRow key={item._id}>
                <TableCell>{i + 1 + (page - 1) * 50}</TableCell>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={selected.includes(item._id)}
                    onChange={() => handleToggleSelected(item._id)}
                  />
                </TableCell>
                <TableCell>
                  <Stack gap={1}>
                    <Stack direction="row" alignItems="center" gap={1}>
                      <Chip
                        variant="filled"
                        label={getTrackServiceLabel(item.serviceId)}
                        icon={<TrackServiceIcon serviceId={item.serviceId} />}
                      />
                      <Chip
                        variant="filled"
                        color="primary"
                        label={item.orderId}
                      />
                      {item.orderStatus ? (
                        <Chip
                          variant="outlined"
                          color={
                            item.orderStatus === "paid"
                              ? "success"
                              : item.orderStatus === "canceled"
                                ? "error"
                                : "default"
                          }
                          label={
                            orderStatusLabels[item.orderStatus] ||
                            item.orderStatus
                          }
                        />
                      ) : null}
                    </Stack>
                    <Stack direction="row" alignItems="center" gap={1}>
                      <Chip
                        variant="outlined"
                        color="info"
                        size="small"
                        label={`ایجاد ${dateFormatter.format(new Date(item.createdAt))}`}
                      />
                      <Chip
                        variant="filled"
                        color="warning"
                        size="small"
                        label={`اپدیت ${dateFormatter.format(new Date(item.updatedAt))}`}
                      />
                    </Stack>
                  </Stack>
                </TableCell>

                <TableCell>
                  <Stack gap={0.5}>
                    <Typography variant="body2">
                      {item.customerName || "-"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.customerPhone || "-"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {[item.customerState, item.customerCity]
                        .filter(Boolean)
                        .join("، ") || "-"}
                    </Typography>
                  </Stack>
                </TableCell>

                <TableCell>
                  {(() => {
                    const codes = trackingCodesOf(item);
                    const hasCodes = codes.length > 0;
                    // Real status: prefer the marketplace progressState, then orderStatus.
                    const statusFa = statusToFa(item.progressState) ?? statusToFa(item.orderStatus);
                    const isDgk = item.serviceId === "dgk";
                    return (
                      <Stack gap={1}>
                        <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                          {/* Shipping service, when known */}
                          {item.shippingServiceName && (
                            <Chip variant="outlined" color="secondary" label={item.shippingServiceName} />
                          )}
                          {/* Status: only "در انتظار ارسال" when there's truly no code and no real status */}
                          {!hasCodes && (
                            <Chip
                              variant="filled"
                              color={statusFa ? "info" : "secondary"}
                              label={statusFa || "در انتظار ارسال"}
                            />
                          )}
                        </Stack>
                        {hasCodes && (
                          <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                            {codes.map((code) => (
                              <Chip
                                key={code}
                                label={`کد رهگیری: ${code}`}
                                color="primary"
                                size="small"
                                {...(isDgk
                                  ? {
                                      component: Link,
                                      href: `https://www.digikala.com/order-tracking/${code}/`,
                                      target: "_blank",
                                      clickable: true,
                                    }
                                  : {})}
                              />
                            ))}
                          </Stack>
                        )}
                      </Stack>
                    );
                  })()}
                </TableCell>

                <TableCell>
                  {normalizeServiceAmount(item.serviceId, item.amount)}
                </TableCell>
                <TableCell>
                  <Stack direction="row" gap={1}>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => handleCopyOne(item)}
                    >
                      کپی متن
                    </Button>
                    <TrackingDetailsDialog
                      item={item}
                      onCopy={() => handleCopyOne(item)}
                      onBasalaamAction={handleBasalaamAction}
                      onWebsiteAction={handleWebsiteAction}
                    />
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
            {response && response.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <Stack alignItems="center" spacing={1.25} sx={{ py: 5 }}>
                    <Typography variant="h6">سفارشی با این فیلترها پیدا نشد</Typography>
                    <Typography variant="body2" color="text.secondary">
                      فیلترها را کمتر کنید یا بروزرسانی زنده سرویس‌ها را بزنید.
                    </Typography>
                  </Stack>
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </TableContainer>
      <Stack direction="row" alignItems="center" gap={2} flexWrap="wrap">
        <Pagination
          page={page}
          count={response?.pagination.pages}
          onChange={(_, n) => setPage(n)}
        />
        <PageJumper pages={response?.pagination.pages ?? 1} onJump={setPage} />
      </Stack>
    </Container>
  );
}

function TrackingDetailsDialog({
  item,
  onCopy,
  onBasalaamAction,
  onWebsiteAction,
}: {
  item: TrackingListResponse["items"][number];
  onCopy: VoidFunction;
  onBasalaamAction: (
    item: TrackingListResponse["items"][number],
    action: "basalaam-accept" | "basalaam-send",
    trackingCode?: string,
    shippingServiceId?: string,
  ) => void;
  onWebsiteAction: (
    item: TrackingListResponse["items"][number],
    payload: Record<string, string>,
  ) => void;
}) {
  const [trackingCode, setTrackingCode] = useState(
    item.items.find((row) => row.trackingCode)?.trackingCode || "",
  );
  const [shippingServiceId, setShippingServiceId] = useState(
    item.shippingServiceId || "",
  );
  const [websiteStatus, setWebsiteStatus] = useState(item.orderStatus || "");
  const [websiteProgress, setWebsiteProgress] = useState(
    item.progressState || "",
  );
  const [websiteTrackingCode, setWebsiteTrackingCode] = useState(
    item.items.find((row) => row.trackingCode)?.trackingCode || "",
  );
  const [customerName, setCustomerName] = useState(item.customerName || "");
  const [customerPhone, setCustomerPhone] = useState(item.customerPhone || "");
  const [customerPostalCode, setCustomerPostalCode] = useState(
    item.customerPostalCode || "",
  );
  const [customerAddress, setCustomerAddress] = useState(
    item.customerAddress || "",
  );
  const [customerCity, setCustomerCity] = useState(item.customerCity || "");
  const [customerState, setCustomerState] = useState(item.customerState || "");
  const transportOptions = Object.values(BSL_TRANSPORTS).filter(
    (value): value is BSL_TRANSPORTS => typeof value === "number",
  );
  const [customerFirstName, customerLastName] = splitCustomerName(customerName);

  return (
    <Orderly
      buttonProps={{
        children: `جزئیات (${item.items.length})`,
      }}
      title={`جزئیات ${item.orderId}`}
      dialogProps={{
        maxWidth: "md",
      }}
    >
      <Stack gap={2}>
        <Stack direction="row" gap={1} flexWrap="wrap">
          <Chip label={`گیرنده: ${item.customerName || "-"}`} />
          <Chip label={`موبایل: ${item.customerPhone || "-"}`} />
          <Chip label={`کد پستی: ${item.customerPostalCode || "-"}`} />
          <Chip
            label={`مقصد: ${[item.customerState, item.customerCity].filter(Boolean).join("، ") || "-"}`}
          />
        </Stack>
        <Typography variant="body2" color="text.secondary">
          {item.customerAddress || "-"}
        </Typography>
        <Button variant="outlined" onClick={onCopy}>
          کپی متن ارسال
        </Button>

        {item.serviceId === "basalaam" && (
          <Stack
            gap={1}
            sx={{ p: 2, border: 1, borderColor: "divider", borderRadius: 1 }}
          >
            <Typography variant="subtitle2">عملیات باسلام</Typography>
            <Stack direction={{ xs: "column", sm: "row" }} gap={1}>
              <Button
                variant="contained"
                color="success"
                onClick={() => onBasalaamAction(item, "basalaam-accept")}
              >
                تایید سفارش
              </Button>
              <TextField
                select
                label="روش ارسال"
                value={shippingServiceId}
                onChange={(event) => setShippingServiceId(event.target.value)}
                size="small"
                sx={{ minWidth: 160 }}
              >
                {transportOptions.map((transport) => (
                  <MenuItem key={transport} value={`${transport}`}>
                    {BSL_TRANSPORT_LABELS[transport]}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="کد رهگیری"
                value={trackingCode}
                onChange={(event) => setTrackingCode(event.target.value)}
                size="small"
              />
              <Button
                variant="contained"
                onClick={() =>
                  onBasalaamAction(
                    item,
                    "basalaam-send",
                    trackingCode,
                    shippingServiceId,
                  )
                }
              >
                ثبت ارسال
              </Button>
            </Stack>
          </Stack>
        )}

        {item.serviceId === "website" && (
          <Stack
            gap={1.5}
            sx={{ p: 2, border: 1, borderColor: "divider", borderRadius: 1 }}
          >
            <Typography variant="subtitle2">ویرایش سفارش وب‌سایت</Typography>
            <Stack direction={{ xs: "column", sm: "row" }} gap={1}>
              <TextField
                select
                label="وضعیت سفارش"
                value={websiteStatus}
                onChange={(event) => setWebsiteStatus(event.target.value)}
                size="small"
                sx={{ minWidth: 140 }}
              >
                <MenuItem value="">بدون تغییر</MenuItem>
                <MenuItem value="pending">در انتظار پرداخت</MenuItem>
                <MenuItem value="paid">پرداخت شده</MenuItem>
                <MenuItem value="refunded">مرجوع شده</MenuItem>
                <MenuItem value="canceled">لغو شده</MenuItem>
              </TextField>
              <TextField
                select
                label="مرحله پردازش"
                value={websiteProgress}
                onChange={(event) => setWebsiteProgress(event.target.value)}
                size="small"
                sx={{ minWidth: 150 }}
              >
                <MenuItem value="">بدون تغییر</MenuItem>
                <MenuItem value="in-progress">در حال آماده سازی</MenuItem>
                <MenuItem value="packaged-posted">ارسال شده</MenuItem>
                <MenuItem value="order-finished">تحویل/تکمیل شده</MenuItem>
              </TextField>
              <TextField
                label="کد رهگیری"
                value={websiteTrackingCode}
                onChange={(event) => setWebsiteTrackingCode(event.target.value)}
                size="small"
              />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} gap={1}>
              <TextField
                label="نام گیرنده"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                size="small"
              />
              <TextField
                label="موبایل"
                value={customerPhone}
                onChange={(event) => setCustomerPhone(event.target.value)}
                size="small"
              />
              <TextField
                label="کد پستی"
                value={customerPostalCode}
                onChange={(event) => setCustomerPostalCode(event.target.value)}
                size="small"
              />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} gap={1}>
              <TextField
                label="استان"
                value={customerState}
                onChange={(event) => setCustomerState(event.target.value)}
                size="small"
              />
              <TextField
                label="شهر"
                value={customerCity}
                onChange={(event) => setCustomerCity(event.target.value)}
                size="small"
              />
              <TextField
                label="آدرس"
                value={customerAddress}
                onChange={(event) => setCustomerAddress(event.target.value)}
                size="small"
                fullWidth
              />
            </Stack>
            <Button
              variant="contained"
              onClick={() =>
                onWebsiteAction(item, {
                  status: websiteStatus,
                  progress: websiteProgress,
                  trackingCode: websiteTrackingCode,
                  customerFirstName,
                  customerLastName,
                  customerPhone,
                  customerPostalCode,
                  customerAddress,
                  customerCity,
                  customerState,
                })
              }
            >
              ذخیره تغییرات سفارش
            </Button>
          </Stack>
        )}

        {/* کالاها و کدهای پیگیری مرتبط */}
        <Stack gap={0.75}>
          <Typography variant="subtitle2" fontWeight={700}>
            کالاهای سفارش — اتصال کد پیگیری
          </Typography>
          {item.items.map((row) => {
            const hasCode = Boolean(row.trackingCode);
            return (
              <Stack
                key={row.serviceVariantId}
                direction={{ xs: "column", sm: "row" }}
                alignItems={{ sm: "center" }}
                gap={1}
                sx={{
                  p: 1.25,
                  border: 1,
                  borderColor: hasCode ? "success.light" : "divider",
                  borderRadius: 1.5,
                  bgcolor: hasCode ? "rgba(var(--mui-palette-success-mainChannel) / 0.06)" : "action.hover",
                  transition: "border-color 0.2s",
                }}
              >
                <Avatar
                  src={row.src}
                  alt={row.title}
                  variant="rounded"
                  sx={{ width: 48, height: 48, flexShrink: 0 }}
                />
                <Stack flex={1} minWidth={0}>
                  <Typography
                    variant="body2"
                    fontWeight={600}
                    component={Link}
                    href={row.url || "#"}
                    target="_blank"
                    sx={{ textDecoration: "none", color: "text.primary", "&:hover": { color: "primary.main" } }}
                  >
                    {row.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    مقصد: {[row.state || item.customerState, row.city || item.customerCity].filter(Boolean).join(" — ") || "—"}
                  </Typography>
                </Stack>
                <Stack direction="row" alignItems="center" gap={1} flexShrink={0}>
                  <Chip
                    size="small"
                    label={`×${row.quantity}`}
                    variant="outlined"
                  />
                  {hasCode ? (
                    <Chip
                      size="small"
                      color="success"
                      label={row.trackingCode}
                      icon={<Box component="span" sx={{ fontSize: 12 }}>📦</Box>}
                    />
                  ) : (
                    <Chip
                      size="small"
                      color="warning"
                      variant="outlined"
                      label="کد پیگیری ندارد"
                    />
                  )}
                </Stack>
              </Stack>
            );
          })}
        </Stack>
      </Stack>
    </Orderly>
  );
}

function splitCustomerName(value: string): [string, string] {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return ["", ""];
  if (parts.length === 1) return [parts[0], ""];
  return [parts.slice(0, -1).join(" "), parts.at(-1) || ""];
}
