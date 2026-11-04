/** Normalizes a Kazakhstan phone to +7XXXXXXXXXX. Returns null when there are fewer than 10 digits. */
export function normalizePhone(input: string | null | undefined): string | null {
  const digits = String(input ?? '').replace(/\D/g, '')
  if (digits.length < 10) return null
  return `+7${digits.slice(-10)}`
}

/** +77012345678 → +7 701 234 56 78 */
export function formatPhone(phone: string | null | undefined): string {
  const n = normalizePhone(phone)
  if (!n) return phone ?? ''
  const d = n.slice(2)
  return `+7 ${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 8)} ${d.slice(8, 10)}`
}
