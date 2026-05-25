import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentUser, getCurrentProfile } from '@/src/shared/auth'
import { isMudurOrAbove } from '@/src/shared/types'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function NotDefteriPage() {
  const [user, profile] = await Promise.all([getCurrentUser(), getCurrentProfile()])
  if (!user || !profile?.school_id) return null

  const supabase = await createClient()
  const isManager = isMudurOrAbove(profile.role)

  // Yöneticiler tüm sınıfları görür, öğretmenler yalnızca kendi sınıflarını
  let classesQuery = supabase
    .from('classes')
    .select(`
      id, name, grade, mentor_teacher_id,
      grade_columns(count),
      students(count)
    `)
    .eq('school_id', profile.school_id)
    .is('deleted_at', null)
    .order('grade')
    .order('name')


  const { data: classes } = await classesQuery

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Not Defteri</h1>
      <p className="text-muted-foreground mb-6">
        Yazılı, quiz ve proje notlarınızı sınıf bazında girin ve yönetin.
      </p>

      {!classes?.length ? (
        <div className="text-center py-16 text-muted-foreground">
          {isManager
            ? 'Henüz sınıf oluşturulmamış.'
            : 'Size atanmış sınıf bulunamadı.'}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((cls) => {
            const columnCount = (cls.grade_columns as unknown as { count: number }[])?.[0]?.count ?? 0
            const studentCount = (cls.students as unknown as { count: number }[])?.[0]?.count ?? 0

            return (
              <Link
                key={cls.id}
                href={`/not-defteri/${cls.id}`}
                className="block rounded-xl border bg-card p-5 hover:shadow-md transition-shadow"
              >
                <div className="font-semibold text-lg">{cls.name}</div>
                <div className="text-sm text-muted-foreground mt-1">{cls.grade}. Sınıf</div>
                <div className="mt-4 flex gap-4 text-sm text-muted-foreground">
                  <span>{studentCount} öğrenci</span>
                  <span>{columnCount} ölçme</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
