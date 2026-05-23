# Domain-Driven Architecture Index

## New Domain Paths Created

| Domain | Path |
|--------|------|
| auth | `src/domains/auth/` |
| sessions | `src/domains/sessions/` |
| users | `src/domains/users/` |
| classes | `src/domains/classes/` |
| homework | `src/domains/homework/` |
| attendance | `src/domains/attendance/` |
| zumre | `src/domains/zumre/` |
| tokens | `src/domains/tokens/` |
| notes | `src/domains/notes/` |
| school | `src/domains/school/` |

Each domain has: `actions/`, `services/`, `repositories/`, `validators/`, `types/`, `events/`

Shared utilities: `src/shared/supabase/{client,server,service}.ts`, `src/shared/{auth,types,validation,audit,utils}/index.ts`

---

## Old → New Import Mapping

| Old import path | New import path | Exported names |
|-----------------|-----------------|----------------|
| `@/app/actions/auth` | `@/src/domains/auth/actions` | `login`, `logout`, `register`, `changePassword` |
| `@/app/actions/session` | `@/src/domains/sessions/actions` | `startSession`, `heartbeat`, `endSession` |
| `@/app/actions/invite-user` | `@/src/domains/users/actions` | `inviteUser`, `removeUser` |
| `@/app/actions/kullanicilar` | `@/src/domains/users/actions` | `assignRole` |
| `@/app/actions/profile` | `@/src/domains/users/actions` | `updateProfile` |
| `@/app/actions/class` | `@/src/domains/classes/actions` | `createClass`, `deleteClass`, `addStudent`, `addStudentsBulk`, `deleteStudent`, `addStudentNote`, `deleteStudentNote` |
| `@/app/actions/homework` | `@/src/domains/homework/actions` | `createHomework`, `updateSubmissionStatus`, `updateAllSubmissionStatuses`, `updateSubmissionNote`, `deleteHomework` |
| `@/app/actions/yoklama` | `@/src/domains/attendance/actions` | `saveAttendance`, `getAttendanceForDate`, `getAttendanceHistory` |
| `@/app/actions/yoklama` (type) | `@/src/domains/attendance/types` | `AttendanceStatus` |
| `@/app/actions/zumre` | `@/src/domains/zumre/actions` | `createMeeting`, `updateMeeting`, `deleteMeeting`, `createExam`, `createExamReturning`, `updateExamGrades`, `saveExamEntries`, `deleteExam`, `fetchClassStudents`, `createCurriculumProgress`, `setCurriculumStatus`, `removeCurriculumProgress`, `updateCurriculumStatus`, `deleteCurriculumProgress`, `clearClassCurriculum`, `importFromTYMM` |
| `@/app/actions/tokens` | `@/src/domains/tokens/actions` | `generateVeliToken`, `generateYoklamaToken`, `revokeToken`, `listRevokedTokens` |
| `@/app/actions/notes` | `@/src/domains/notes/actions` | `createNote`, `updateNote`, `deleteNote` |
| `@/app/actions/school` | `@/src/domains/school/actions` | `setupSchool` (admin), `updateSchoolSettings`, `regenerateSchoolCode` |
| `@/app/actions/school-meetings` | `@/src/domains/school/actions/meetings` | `createMeeting`, `updateMeetingNotes`, `deleteMeeting` |
| `@/app/actions/onboarding` | `@/src/domains/school/actions/onboarding` | `setupSchool` (first-time), `joinSchool` |

---

## Component Files Still Referencing Old Paths

The following files import from `@/app/actions/*` and need to be updated to use the new domain paths:

### auth domain
- `app/(auth)/login/LoginForm.tsx` — imports `login` from `@/app/actions/auth`
- `app/(auth)/kayit/RegisterForm.tsx` — imports `register` from `@/app/actions/auth`
- `app/(dashboard)/profil/ProfilForm.tsx` — imports `updateProfile` from `@/app/actions/profile`, `logout` from `@/app/actions/auth`
- `app/(dashboard)/profil/PasswordForm.tsx` — imports `changePassword` from `@/app/actions/auth`
- `components/layout/Sidebar.tsx` — imports `logout` from `@/app/actions/auth`

### sessions domain
- `components/SessionTracker.tsx` — imports `heartbeat` from `@/app/actions/session`

### users domain
- `app/(dashboard)/kullanicilar/InviteUserForm.tsx` — imports `inviteUser` from `@/app/actions/invite-user`
- `app/(dashboard)/kullanicilar/DeleteButton.tsx` — imports `removeUser` from `@/app/actions/invite-user`
- `app/(dashboard)/kullanicilar/RoleSelector.tsx` — imports `assignRole` from `@/app/actions/kullanicilar`

### classes domain
- `app/(dashboard)/siniflar/page.tsx` — imports `createClass` from `@/app/actions/class`
- `app/(dashboard)/siniflar/SinifArama.tsx` — imports `deleteClass` from `@/app/actions/class`
- `app/(dashboard)/siniflar/[id]/page.tsx` — imports `addStudent`, `deleteStudent` from `@/app/actions/class`
- `app/(dashboard)/siniflar/[id]/BulkStudentModal.tsx` — imports `addStudentsBulk` from `@/app/actions/class`
- `app/(dashboard)/siniflar/[id]/ogrenciler/[studentId]/page.tsx` — imports `addStudentNote`, `deleteStudentNote` from `@/app/actions/class`

### homework domain
- `app/(dashboard)/odevler/page.tsx` — imports `deleteHomework` from `@/app/actions/homework`
- `app/(dashboard)/odevler/yeni/HomeworkForm.tsx` — imports `createHomework` from `@/app/actions/homework`
- `app/(dashboard)/odevler/[id]/StatusBoard.tsx` — imports `updateAllSubmissionStatuses`, `updateSubmissionStatus`, `updateSubmissionNote` from `@/app/actions/homework`

### attendance domain
- `app/(dashboard)/yoklama/page.tsx` — imports type `AttendanceStatus` from `@/app/actions/yoklama`
- `app/(dashboard)/yoklama/YoklamaBoard.tsx` — imports `saveAttendance`, `getAttendanceForDate`, `AttendanceStatus` from `@/app/actions/yoklama`

### zumre domain
- `app/(dashboard)/zumre/page.tsx` — imports multiple actions from `@/app/actions/zumre`
- `app/(dashboard)/zumre/MufredatBoard.tsx` — imports `setCurriculumStatus`, `removeCurriculumProgress`, `clearClassCurriculum` from `@/app/actions/zumre`
- `app/(dashboard)/zumre/SinavListesi.tsx` — imports `deleteExam`, `createExamReturning` from `@/app/actions/zumre`
- `app/(dashboard)/zumre/SinavCard.tsx` — imports `saveExamEntries`, `fetchClassStudents` from `@/app/actions/zumre`
- `app/(dashboard)/zumre/TYMMImportForm.tsx` — imports `importFromTYMM` from `@/app/actions/zumre`
- `app/(dashboard)/zumre/toplanti/[id]/duzenle/page.tsx` — imports `updateMeeting` from `@/app/actions/zumre`

### tokens domain
- `app/(dashboard)/siniflar/[id]/ogrenciler/[studentId]/CopyVeliLink.tsx` — imports `generateVeliToken` from `@/app/actions/tokens`
- `app/(dashboard)/yoklama/YoklamaBoard.tsx` — imports `generateYoklamaToken` from `@/app/actions/tokens`
- `app/(dashboard)/audit/VeliLinksSection.tsx` — imports `revokeToken` from `@/app/actions/tokens`
- `app/(dashboard)/audit/RevokeTokenForm.tsx` — imports `revokeToken` from `@/app/actions/tokens`

### notes domain
- `app/(dashboard)/notlar/NotesLayout.tsx` — imports `createNote`, `deleteNote` from `@/app/actions/notes`
- `app/(dashboard)/notlar/NotesEditor.tsx` — imports `updateNote` from `@/app/actions/notes`

### school domain
- `app/(dashboard)/anasayfa/OkulAyarlari.tsx` — imports `regenerateSchoolCode`, `updateSchoolSettings` from `@/app/actions/school`
- `app/(dashboard)/anasayfa/SchoolMeetings.tsx` — imports `createMeeting`, `deleteMeeting`, `updateMeetingNotes` from `@/app/actions/school-meetings`
- `app/(dashboard)/anasayfa/AjandaWidget.tsx` — imports `createMeeting`, `deleteMeeting`, `updateMeetingNotes` from `@/app/actions/school-meetings`
- `app/onboarding/MudurOnboardingForm.tsx` — imports `setupSchool` from `@/app/actions/school`
- `app/onboarding/JoinSchoolForm.tsx` — imports `joinSchool` from `@/app/actions/onboarding`
