export interface AvailabilityInterval {
  start: string;
  end: string;
  durationMinutes: number;
}

export interface DeviceAvailability {
  deviceId: number;
  deviceName: string;

  totalOccupiedMinutes: number;
  totalAvailableMinutes: number;

  occupied: AvailabilityInterval[];
  available: AvailabilityInterval[];
}