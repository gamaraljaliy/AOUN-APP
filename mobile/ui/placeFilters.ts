import { facilityNames } from "./demo";
export const categories = ["الكل", "مركز تسوق", "مقهى", "مرافق عامة", "مطعم"];

export function initialFacilities(ids?: string, legacyIndex?: string) {
  const values = ids
    ? ids.split(",").map(Number)
    : legacyIndex
      ? [Number(legacyIndex) + 1]
      : [];
  return [
    ...new Set(
      values.filter(
        (id) => Number.isInteger(id) && id >= 1 && id <= facilityNames.length,
      ),
    ),
  ];
}
