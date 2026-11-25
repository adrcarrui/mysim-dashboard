export function taskDuration(type: string, row: Record<string, unknown>) {
  const minutes = row.estimated_duration_minutes;
  if (type !== "task" || typeof minutes !== "number" ||
      !Number.isInteger(minutes) || minutes < 1 || minutes > 10080) {
    return { estimated_duration_minutes: null, duration_reference: "" };
  }
  return {
    estimated_duration_minutes: minutes,
    duration_reference: typeof row.duration_reference === "string" ? row.duration_reference : "",
  };
}
