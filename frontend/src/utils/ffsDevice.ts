export function getFfsKey(deviceName: string | null): string | null {
  const name = deviceName?.trim().toUpperCase() ?? ""

  // TS03 must be checked before the other C295.
  if (name.includes("C295") && name.includes("TS03")) return "C295 TS03"
  if (name.includes("A400M")) return "A400M"
  if (name.includes("MRTT")) return "MRTT"
  if (name.includes("C295")) return "C295"
  if (name.includes("CN235")) return "CN235"

  return null
}
