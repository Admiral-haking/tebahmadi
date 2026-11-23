import type { Metadata } from "next";
import { ReactElement } from "react";
import { connectMongoose } from "@/lib/mongoose";
import { markTransactionFailed, verifyAndFinalize } from "@/payments/paymentService";
import { InvoiceModel } from "@/models/Invoice";
import { updateInvoiceStatus } from "@/orders/services/invoiceService";
import PaymentVerificationView from "@/views/payment";
import { generatePageMetadata } from "@/seo/services/metadataGenerator";
import { getPaymentVerificationDecision } from "@/payments/paymentVerificationPolicy";

interface VerifyPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

type GatewayVerifyInput = {
  gateway: "zarinpal" | "torob" | "azkivam" | "digipay" | "snapppay" | "bajetpay";
  tx: string;
  invoiceId: string;
  authority?: string;
  state?: string;
  digipay?: {
    trackingCode?: string;
    providerId?: string;
    result?: string;
    type?: string;
    amount?: string;
  };
  snapppay?: {
    transactionId?: string;
    state?: string;
    amount?: string;
  };
  bajetpay?: {
    referenceId?: string;
    amount?: string;
  };
};

function toStringValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}


function isSuccessState(value: string | undefined, accepted: string[]): boolean {
  const normalized = (value ?? '').trim().toUpperCase();
  if (!normalized) return false;
  return accepted.includes(normalized);
}

async function cancelPendingInvoice(invoiceId: string) {
  try {
    const result = await updateInvoiceStatus(invoiceId, "canceled");
    if (!result.ok && result.reason !== "invalid_transition" && result.reason !== "not_found") {
      console.warn(`Failed to cancel invoice ${invoiceId} after payment failure: ${result.reason}`);
    }
  } catch (error) {
    console.error(`Error canceling invoice ${invoiceId} after payment failure`, error);
  }
}

function parseVerifyInput(searchParams?: Record<string, string | string[] | undefined>): GatewayVerifyInput | null {
  const gatewayRaw = toStringValue(searchParams?.gateway)?.toLowerCase();
  const tx = toStringValue(searchParams?.tx) ?? toStringValue(searchParams?.transactionId) ?? toStringValue(searchParams?.paymentTransactionId);
  const invoiceId = toStringValue(searchParams?.invoiceId) ?? toStringValue(searchParams?.invoice_id) ?? toStringValue(searchParams?.orderId);
  const authority = toStringValue(searchParams?.Authority);
  const zarinStatus = toStringValue(searchParams?.Status);
  const torobState = toStringValue(searchParams?.state);
  const snappPayState = toStringValue(searchParams?.state);
  const azkivamState = toStringValue(searchParams?.state);
  const digipayState = toStringValue(searchParams?.result) ?? toStringValue(searchParams?.state);

  if (!tx || !invoiceId) return null;
  const objectIdRegex = /^[0-9a-fA-F]{24}$/;
  if (!objectIdRegex.test(tx) || !objectIdRegex.test(invoiceId)) return null;

  if (gatewayRaw === "torob" || (!gatewayRaw && !!torobState && !authority)) {
    return {
      gateway: "torob",
      tx,
      invoiceId,
      state: torobState,
    };
  }

  if (gatewayRaw === "snapppay") {
    return {
      gateway: "snapppay",
      tx,
      invoiceId,
      state: snappPayState,
      snapppay: {
        transactionId: tx,
        state: snappPayState,
        amount: toStringValue(searchParams?.amount),
      },
    };
  }

  if (gatewayRaw === "azkivam") {
    return {
      gateway: "azkivam",
      tx,
      invoiceId,
      state: azkivamState,
    };
  }

  if (gatewayRaw === "digipay") {
    return {
      gateway: "digipay",
      tx,
      invoiceId,
      state: digipayState,
      digipay: {
        trackingCode: toStringValue(searchParams?.trackingCode),
        providerId: toStringValue(searchParams?.providerId),
        result: digipayState,
        type: toStringValue(searchParams?.type),
        amount: toStringValue(searchParams?.amount),
      },
    };
  }

  if (gatewayRaw === "bajetpay") {
    return {
      gateway: "bajetpay",
      tx,
      invoiceId,
      state: toStringValue(searchParams?.state) ?? toStringValue(searchParams?.status),
      bajetpay: {
        referenceId:
          toStringValue(searchParams?.referenceId) ??
          toStringValue(searchParams?.refId) ??
          toStringValue(searchParams?.authority),
        amount: toStringValue(searchParams?.amount),
      },
    };
  }

  if (!authority || !zarinStatus) return null;
  return {
    gateway: "zarinpal",
    tx,
    invoiceId,
    authority,
    state: zarinStatus,
  };
}

async function renderResult(input: GatewayVerifyInput | null): Promise<ReactElement> {
  if (!input) {
    return <PaymentVerificationView status={false} />;
  }

  const gatewayDecision = getPaymentVerificationDecision(input.gateway);
  if (!gatewayDecision.allowed) {
    return <PaymentVerificationView status={false} message={gatewayDecision.message} />;
  }

  if (input.gateway === "torob") {
    const state = (input.state ?? "").toUpperCase();
    if (!isSuccessState(state, ["OK", "SUCCESS", "SUCCEEDED", "VERIFIED"])) {
      await Promise.all([
        markTransactionFailed(input.tx, undefined, "canceled", `gateway_status_${state || "FAILED"}`),
        cancelPendingInvoice(input.invoiceId),
      ]);
      return <PaymentVerificationView status={false} />;
    }

    try {
      const result = await verifyAndFinalize({
        invoiceId: input.invoiceId,
        transactionId: input.tx,
      });
      if (result.ok) {
        const invoice = await InvoiceModel.findById(input.invoiceId).lean();
        return <PaymentVerificationView status invoiceNumber={invoice?.number} transactionId={result.refId} />;
      }

      await cancelPendingInvoice(input.invoiceId);
      return <PaymentVerificationView status={false} message={result.message} />;
    } catch (error) {
      const message = error instanceof Error ? error.message : "verification_failed";
      await Promise.all([
        markTransactionFailed(input.tx, undefined, "failed", message),
        cancelPendingInvoice(input.invoiceId),
      ]);
      return <PaymentVerificationView status={false} message={message} />;
    }
  }

  if (input.gateway === "snapppay") {
    const state = (input.state ?? "").toUpperCase();
    if (!isSuccessState(state, ["OK", "SUCCESS", "SUCCEEDED", "VERIFIED"])) {
      await Promise.all([
        markTransactionFailed(input.tx, undefined, "canceled", `gateway_status_${state || "FAILED"}`),
        cancelPendingInvoice(input.invoiceId),
      ]);
      return <PaymentVerificationView status={false} />;
    }

    try {
      const result = await verifyAndFinalize({
        invoiceId: input.invoiceId,
        transactionId: input.tx,
        snapppay: input.snapppay,
      });
      if (result.ok) {
        const invoice = await InvoiceModel.findById(input.invoiceId).lean();
        return <PaymentVerificationView status invoiceNumber={invoice?.number} transactionId={result.refId} />;
      }

      await cancelPendingInvoice(input.invoiceId);
      return <PaymentVerificationView status={false} message={result.message} />;
    } catch (error) {
      const message = error instanceof Error ? error.message : "verification_failed";
      await Promise.all([
        markTransactionFailed(input.tx, undefined, "failed", message),
        cancelPendingInvoice(input.invoiceId),
      ]);
      return <PaymentVerificationView status={false} message={message} />;
    }
  }

  if (input.gateway === "azkivam") {
    const state = (input.state ?? "").toLowerCase();
    if (state === "failed") {
      await Promise.all([
        markTransactionFailed(input.tx, undefined, "canceled", "gateway_status_failed"),
        cancelPendingInvoice(input.invoiceId),
      ]);
      return <PaymentVerificationView status={false} />;
    }

    try {
      const result = await verifyAndFinalize({
        invoiceId: input.invoiceId,
        transactionId: input.tx,
      });
      if (result.ok) {
        const invoice = await InvoiceModel.findById(input.invoiceId).lean();
        return <PaymentVerificationView status invoiceNumber={invoice?.number} transactionId={result.refId} />;
      }

      await cancelPendingInvoice(input.invoiceId);
      return <PaymentVerificationView status={false} message={result.message} />;
    } catch (error) {
      const message = error instanceof Error ? error.message : "verification_failed";
      await Promise.all([
        markTransactionFailed(input.tx, undefined, "failed", message),
        cancelPendingInvoice(input.invoiceId),
      ]);
      return <PaymentVerificationView status={false} message={message} />;
    }
  }

  if (input.gateway === "digipay") {
    const state = (input.state ?? "").toUpperCase();
    if (state && state !== "SUCCESS") {
      await Promise.all([
        markTransactionFailed(input.tx, undefined, "canceled", `gateway_status_${state}`),
        cancelPendingInvoice(input.invoiceId),
      ]);
      return <PaymentVerificationView status={false} />;
    }

    try {
      const result = await verifyAndFinalize({
        invoiceId: input.invoiceId,
        transactionId: input.tx,
        digipay: input.digipay,
      });
      if (result.ok) {
        const invoice = await InvoiceModel.findById(input.invoiceId).lean();
        return <PaymentVerificationView status invoiceNumber={invoice?.number} transactionId={result.refId} />;
      }

      await cancelPendingInvoice(input.invoiceId);
      return <PaymentVerificationView status={false} message={result.message} />;
    } catch (error) {
      const message = error instanceof Error ? error.message : "verification_failed";
      await Promise.all([
        markTransactionFailed(input.tx, undefined, "failed", message),
        cancelPendingInvoice(input.invoiceId),
      ]);
      return <PaymentVerificationView status={false} message={message} />;
    }
  }

  if (input.gateway === "bajetpay") {
    const state = (input.state ?? "").trim().toLowerCase();
    if (["failed", "cancel", "canceled", "cancelled", "nok"].includes(state)) {
      await Promise.all([
        markTransactionFailed(input.tx, input.bajetpay?.referenceId, "canceled", `gateway_status_${state}`),
        cancelPendingInvoice(input.invoiceId),
      ]);
      return <PaymentVerificationView status={false} />;
    }

    try {
      const result = await verifyAndFinalize({
        invoiceId: input.invoiceId,
        transactionId: input.tx,
        authority: input.bajetpay?.referenceId,
        bajetpay: input.bajetpay,
      });
      if (result.ok) {
        const invoice = await InvoiceModel.findById(input.invoiceId).lean();
        return <PaymentVerificationView status invoiceNumber={invoice?.number} transactionId={result.refId} />;
      }

      await cancelPendingInvoice(input.invoiceId);
      return <PaymentVerificationView status={false} message={result.message} />;
    } catch (error) {
      const message = error instanceof Error ? error.message : "verification_failed";
      await Promise.all([
        markTransactionFailed(input.tx, input.bajetpay?.referenceId, "failed", message),
        cancelPendingInvoice(input.invoiceId),
      ]);
      return <PaymentVerificationView status={false} message={message} />;
    }
  }

  const { authority, state, invoiceId, tx } = input;
  if (state !== "OK") {
    await Promise.all([
      markTransactionFailed(tx, authority, "canceled", `gateway_status_${state}`),
      cancelPendingInvoice(invoiceId),
    ]);
    return <PaymentVerificationView status={false} />;
  }

  try {
    const result = await verifyAndFinalize({ authority, invoiceId, transactionId: tx });
    if (result.ok) {
      const invoice = await InvoiceModel.findById(invoiceId).lean();
      return <PaymentVerificationView status invoiceNumber={invoice?.number} transactionId={result.refId} />;
    }

    await cancelPendingInvoice(invoiceId);
    return <PaymentVerificationView status={false} message={result.message} />;
  } catch (error) {
    const message = error instanceof Error ? error.message : "verification_failed";
    await Promise.all([
      markTransactionFailed(tx, authority, "failed", message),
      cancelPendingInvoice(invoiceId),
    ]);
    return <PaymentVerificationView status={false} message={message} />;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const { metadata } = await generatePageMetadata({ slug: "/payments/verify" });
  return metadata;
}

export default async function VerifyPage({ searchParams }: VerifyPageProps) {
  await connectMongoose();

  const resolvedSearchParams = await searchParams;
  const input = parseVerifyInput(resolvedSearchParams);
  return renderResult(input);
}
