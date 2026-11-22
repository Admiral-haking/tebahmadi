import { NextRequest, NextResponse } from 'next/server';

import { requirePermission } from '@/lib/auth';
import { actorFromUser, logAuditLater, requestContext } from '@/observability/audit-log';
import {
  createAndPostExpense,
  createSettlement,
  closeFinancialPeriod,
  createAccount,
  createCashAccount,
  createFinancialPeriod,
  ensureDefaultChart,
  financialStatements,
  importDigikalaInvoiceSettlement,
  postJournal,
  postMarketplaceOrderSale,
  postUnpostedMarketplaceSales,
  postSettlement,
  reverseMarketplaceOrderSale,
  reverseJournal,
  updateAccountingIssue,
} from '@/services/accounting/financialService';
import { requestInvoiceRefund } from '@/services/accounting/refundService';
import { parseTehranAccountingDay } from '@/services/accounting/revenueService';

function csvCell(value: unknown) {
  const text = value == null ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function csvResponse(filename: string, rows: unknown[][]) {
  return new NextResponse('\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

const ADMIN_ACCOUNTING_ACTIONS = new Set([
  'reverse-journal',
  'post-settlement',
  'refund',
  'reverse-marketplace-sale',
  'close-period',
  'accounting-issue',
  'seed-chart',
  'account',
  'cash-account',
  'period',
  'marketplace-sale',
  'post-unposted-marketplace-sales',
  'digikala-invoice-settlement',
]);

export async function GET(request: NextRequest) {
  await requirePermission(request, 'accounting:read');
  const from = request.nextUrl.searchParams.get('from');
  const to = request.nextUrl.searchParams.get('to');
  const report = await financialStatements(
    from ? parseTehranAccountingDay(from) : undefined,
    to ? parseTehranAccountingDay(to) : undefined,
  );
  const format = request.nextUrl.searchParams.get('format');
  if (format === 'csv' || format === 'trial-balance-csv') {
    const rows: unknown[][] = [
      ['کد', 'حساب', 'بدهکار', 'بستانکار', 'مانده'],
      ...report.trialBalance.map((row) => [row.code, row.name, row.debit, row.credit, row.balance]),
    ];
    return csvResponse('accounting-trial-balance.csv', rows);
  }
  if (format === 'journal-csv') {
    const rows: unknown[][] = [
      ['شماره', 'تاریخ', 'شرح', 'وضعیت', 'منبع', 'شناسه منبع'],
      ...report.journals.map((row: any) => [
        row.number,
        row.date,
        row.description,
        row.status,
        row.sourceType,
        row.sourceId,
      ]),
    ];
    return csvResponse('accounting-journal.csv', rows);
  }
  if (format === 'general-ledger-csv' || format === 'account-statement-csv') {
    const accountCode = request.nextUrl.searchParams.get('accountCode')?.trim();
    const rows: unknown[][] = [
      [
        'کد حساب',
        'حساب',
        'شماره سند',
        'تاریخ',
        'شرح سند',
        'شرح ردیف',
        'بدهکار',
        'بستانکار',
        'مانده ردیف',
        'منبع',
        'شناسه منبع',
      ],
      ...report.journals.flatMap((journal: any) =>
        (journal.lines ?? [])
          .filter((line: any) => !accountCode || line.accountCode === accountCode)
          .map((line: any) => [
            line.accountCode,
            line.accountName,
            journal.number,
            journal.date,
            journal.description,
            line.description,
            line.debit,
            line.credit,
            (line.debit ?? 0) - (line.credit ?? 0),
            journal.sourceType,
            journal.sourceId,
          ]),
      ),
    ];
    return csvResponse(
      accountCode ? `accounting-account-${accountCode}.csv` : 'accounting-general-ledger.csv',
      rows,
    );
  }
  if (format === 'settlements-csv') {
    const rows: unknown[][] = [
      ['ارائه‌دهنده', 'مرجع', 'ناخالص', 'کارمزد', 'مالیات', 'کسورات', 'خالص', 'وضعیت'],
      ...report.settlements.map((row: any) => [
        row.provider,
        row.reference,
        row.grossAmount,
        row.feeAmount,
        row.taxAmount,
        row.otherDeduction,
        row.netAmount,
        row.status,
      ]),
    ];
    return csvResponse('accounting-settlements.csv', rows);
  }
  if (format === 'tax-report-csv') {
    const taxAccount = report.trialBalance.find((row) => row.code === '5401');
    const rows: unknown[][] = [
      ['نوع', 'ارائه‌دهنده/حساب', 'مرجع', 'تاریخ', 'مالیات', 'کسورات دیگر', 'جمع'],
      [
        'ledger',
        taxAccount?.name ?? 'مالیات و عوارض',
        '5401',
        '',
        taxAccount?.debit ?? 0,
        0,
        taxAccount?.balance ?? 0,
      ],
      ...report.settlements.map((row: any) => [
        'settlement',
        row.provider,
        row.reference,
        row.settledAt,
        row.taxAmount,
        row.otherDeduction,
        (row.taxAmount ?? 0) + (row.otherDeduction ?? 0),
      ]),
    ];
    return csvResponse('accounting-tax-report.csv', rows);
  }
  return NextResponse.json({ data: report });
}

export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'accounting:write');
  try {
    const body = (await request.json()) as Record<string, any>;
    const action = String(body.action ?? '');
    if (ADMIN_ACCOUNTING_ACTIONS.has(action)) {
      await requirePermission(request, 'accounting:admin');
    }
    let result: unknown;
    if (action === 'seed-chart') result = await ensureDefaultChart();
    else if (action === 'journal')
      result = await postJournal({
        date: new Date(body.date),
        description: String(body.description ?? ''),
        lines: Array.isArray(body.lines) ? body.lines : [],
        sourceType: body.sourceType,
        sourceId: body.sourceId,
        actorId: String(user._id),
      });
    else if (action === 'reverse-journal')
      result = await reverseJournal(String(body.id), String(user._id));
    else if (action === 'expense')
      result = await createAndPostExpense({
        title: String(body.title ?? ''),
        category: String(body.category ?? ''),
        amount: Number(body.amount),
        date: new Date(body.date),
        reference: body.reference,
        description: body.description,
        actorId: String(user._id),
      });
    else if (action === 'settlement')
      result = await createSettlement({
        provider: String(body.provider ?? ''),
        reference: String(body.reference ?? ''),
        periodFrom: new Date(body.periodFrom),
        periodTo: new Date(body.periodTo),
        settledAt: new Date(body.settledAt),
        currency: body.currency === 'rial' ? 'rial' : 'toman',
        grossAmount: Number(body.grossAmount),
        feeAmount: Number(body.feeAmount ?? 0),
        taxAmount: Number(body.taxAmount ?? 0),
        otherDeduction: Number(body.otherDeduction ?? 0),
        lines: Array.isArray(body.lines) ? body.lines : undefined,
      });
    else if (action === 'post-settlement')
      result = await postSettlement(String(body.id), String(user._id));
    else if (action === 'marketplace-sale')
      result = await postMarketplaceOrderSale({
        channel: body.channel,
        orderId: String(body.orderId),
        actorId: String(user._id),
      });
    else if (action === 'reverse-marketplace-sale')
      result = await reverseMarketplaceOrderSale({
        channel: body.channel,
        orderId: String(body.orderId),
        actorId: String(user._id),
      });
    else if (action === 'post-unposted-marketplace-sales')
      result = await postUnpostedMarketplaceSales({
        channel: body.channel || undefined,
        limit: Math.min(Math.max(Number(body.limit) || 100, 1), 500),
        actorId: String(user._id),
      });
    else if (action === 'digikala-invoice-settlement')
      result = await importDigikalaInvoiceSettlement({
        vendorId: body.vendorId ? String(body.vendorId) : undefined,
        invoice: body.invoice ?? {},
        details: body.details ?? {},
      });
    else if (action === 'accounting-issue')
      result = await updateAccountingIssue({
        id: String(body.id),
        status: body.status,
        assignedTo: body.assignedTo,
        note: body.note,
      });
    else if (action === 'refund')
      result = await requestInvoiceRefund({
        invoiceId: String(body.invoiceId),
        amount: body.amount == null ? undefined : Number(body.amount),
        reason: body.reason,
        operation: body.operation == null ? undefined : String(body.operation),
        actorId: String(user._id),
      });
    else if (action === 'account')
      result = await createAccount({
        code: String(body.code),
        name: String(body.name),
        type: body.type,
        parentId: body.parentId || undefined,
      });
    else if (action === 'cash-account')
      result = await createCashAccount({
        name: String(body.name),
        kind: body.kind,
        accountId: body.accountId,
        bankName: body.bankName,
        iban: body.iban,
        accountNumber: body.accountNumber,
      });
    else if (action === 'period')
      result = await createFinancialPeriod({
        name: String(body.name),
        startsAt: new Date(body.startsAt),
        endsAt: new Date(body.endsAt),
      });
    else if (action === 'close-period')
      result = await closeFinancialPeriod(String(body.id), String(user._id));
    else return NextResponse.json({ error: 'عملیات نامعتبر است' }, { status: 400 });
    logAuditLater({
      action: 'create',
      entity: `accounting:${action}`,
      entityId: (result as any)?._id ? String((result as any)._id) : undefined,
      summary: `عملیات حسابداری ${action}`,
      actor: actorFromUser(user),
      severity: 'high',
      ...requestContext(request),
    });
    return NextResponse.json({ data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'accounting_operation_failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
