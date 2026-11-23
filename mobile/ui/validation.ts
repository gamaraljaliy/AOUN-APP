export function coordinateError(value: string, bound: 90 | 180) {
  if (!value.trim()) return bound === 90 ? "أدخل خط العرض." : "أدخل خط الطول.";
  if (!Number.isFinite(Number(value)) || Math.abs(Number(value)) > bound)
    return bound === 90
      ? "أدخل قيمة بين ‎−90 و90."
      : "أدخل قيمة بين ‎−180 و180.";
  return "";
}
