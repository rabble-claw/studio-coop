
export const attendanceApi = {
  studioHistory: (studioId: string, from: string, to: string) =>
    api.get<{ classes: StudioAttendanceClass[]; stats: StudioAttendanceStats }>(
      `/studios/${studioId}/attendance?from=${from}&to=${to}`,
    ),
  myHistory: () =>
    api.get<{ history: AttendanceRecord[]; stats: PersonalAttendanceStats }>('/my/attendance'),
}

export interface StudioAttendanceClass {
  id: string; date: string; start_time: string; status: string; name: string;
  capacity: number; checked_in: number; walk_ins: number; no_shows: number;
}
export interface StudioAttendanceStats { total_classes: number; avg_attendance: number; no_show_rate: number; }
export interface AttendanceRecord {
  id: string; class_instance_id: string; walk_in: boolean; date: string;
  start_time: string; studio_id: string; class_name: string;
}
export interface PersonalAttendanceStats { total_this_month: number; total_this_year: number; streak_weeks: number; }


export const attendanceApi = {
  studioHistory: (studioId: string, from: string, to: string) =>
    api.get<{ classes: StudioAttendanceClass[]; stats: StudioAttendanceStats }>(
      `/studios/${studioId}/attendance?from=${from}&to=${to}`,
    ),
  myHistory: () =>
    api.get<{ history: AttendanceRecord[]; stats: PersonalAttendanceStats }>('/my/attendance'),
}

export interface StudioAttendanceClass {
  id: string; date: string; start_time: string; status: string; name: string;
  capacity: number; checked_in: number; walk_ins: number; no_shows: number;
}
export interface StudioAttendanceStats { total_classes: number; avg_attendance: number; no_show_rate: number; }
export interface AttendanceRecord {
  id: string; class_instance_id: string; walk_in: boolean; date: string;
  start_time: string; studio_id: string; class_name: string;
}
export interface PersonalAttendanceStats { total_this_month: number; total_this_year: number; streak_weeks: number; }

export { ApiError }
