export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused'

export const ATTENDANCE_STATUSES: AttendanceStatus[] = ['present', 'absent', 'late', 'excused']

export interface AbsenceCount {
  unexcused: number   // absent×1 + late×0.5 (hafta sonu hariç)
  excused:   number   // excused×1
}

export interface AttendanceRow {
  student_id: string
  status:     string
  date:       string  // YYYY-MM-DD
}
