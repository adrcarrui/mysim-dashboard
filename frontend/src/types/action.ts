// src/types/action.ts

export interface Action {
  id?: number | null;
  actionId?: string | null;
  date?: string | null;
  actionDescription?: string | null;

  performedBy?: number | null;
  asignedTo?: number | null;

  status?: number | null;
  device?: number | null;

  performedDatetime?: string | null;
  lastUpdated?: string | null;

  deviceName?: string | null;
}