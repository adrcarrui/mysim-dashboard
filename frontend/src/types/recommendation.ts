export interface RecommendationReason {
  code: string;
  label: string;
  score: number;
}


export interface RecommendedWindow {
  start: string;
  end: string;

  durationMinutes: number;

  score: number;

  fitsWindow:
    | boolean
    | null;

  windowToleranceStatus: string;

  reasons: RecommendationReason[];
}


export interface TaskRecommendation {
  scheduledTaskId: number;

  maintenanceTaskId: number;

  scheduleCode: string;

  taskCode: string;

  device: string;

  description:
    | string
    | null;

  plannedDate: string;

  toleranceStart:
    | string
    | null;

  toleranceEnd:
    | string
    | null;

  currentToleranceStatus: string;

  frequency:
    | string
    | null;

  status: string;

  durationMinutes:
    | number
    | null;

  durationSource: string;

  bestWindow:
    | RecommendedWindow
    | null;

  alternativeWindows:
    RecommendedWindow[];
}


export interface DeviceRecommendations {
  deviceId: number;

  deviceName: string;

  taskDeviceName: string;

  tasks: TaskRecommendation[];
}


export interface RecommendationsResponse {
  fromDate: string;

  toDate: string;

  devices: DeviceRecommendations[];
}