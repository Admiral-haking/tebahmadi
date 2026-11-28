import type { ManualTapinFormInput, ManualTapinPayload } from './tapin-shipment.types';

function hasNumber(value: number | '' | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Builds the only payload the manual quote/register UI is allowed to send.
 * Packaging choices stay absent until the admin explicitly enters them.
 */
export function buildManualTapinPayload(input: ManualTapinFormInput): ManualTapinPayload | null {
  if (
    !input.invoiceId ||
    !input.shopId ||
    input.provinceCode <= 0 ||
    input.cityCode <= 0 ||
    input.boxId <= 0 ||
    input.packetType === '' ||
    !hasNumber(input.packageWeight) ||
    input.packageWeight < 0 ||
    input.orderType === '' ||
    input.registerType === '' ||
    input.contentType === '' ||
    input.hasInsurance === null
  ) {
    return null;
  }

  const payload: ManualTapinPayload = {
    invoiceId: input.invoiceId,
    shopId: input.shopId,
    provinceCode: input.provinceCode,
    cityCode: input.cityCode,
    boxId: input.boxId,
    packetType: input.packetType,
    packageWeight: input.packageWeight,
    orderType: input.orderType,
    registerType: input.registerType,
    contentType: input.contentType,
    hasInsurance: input.hasInsurance,
  };

  if (input.payType !== undefined && input.payType !== '') payload.payType = input.payType;
  if (hasNumber(input.employeeCode)) payload.employeeCode = input.employeeCode;
  if (hasNumber(input.prePaidPrice)) payload.prePaidPrice = input.prePaidPrice;
  if (hasNumber(input.packagingPrice)) payload.packagingPrice = input.packagingPrice;
  if (hasNumber(input.presenterCode)) payload.presenterCode = input.presenterCode;
  if (hasNumber(input.kioskId)) payload.kioskId = input.kioskId;
  if (hasNumber(input.duration)) payload.duration = input.duration;
  if (input.parcelTurning !== undefined) payload.parcelTurning = input.parcelTurning;
  if (input.itemWeights !== undefined) payload.itemWeights = input.itemWeights;

  return payload;
}
