type BasalaamProductPhoto = {
  original?: string | null;
};

export function getBasalaamProductImageUrl(
  photos?: BasalaamProductPhoto[] | null,
): string {
  const original = photos?.find((photo) => typeof photo?.original === 'string' && photo.original.trim())?.original?.trim();
  return original || '/product-placeholder.svg';
}
