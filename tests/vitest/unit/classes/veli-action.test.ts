import { describe, it, expect, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/src/domains/classes/services/ClassService', () => ({ ClassService: { updateVeliContact: vi.fn().mockResolvedValue({}) } }))

const { updateVeliContact } = await import('@/app/actions/classes')
const { ClassService } = await import('@/src/domains/classes/services/ClassService')

const SID = '11111111-1111-4111-8111-111111111111'
const CID = '22222222-2222-4222-8222-222222222222'

describe('updateVeliContact action — formda olmayan alan dokunulmaz', () => {
  it('sınıf kartı (ad alanı yok) veli adını silmez', async () => {
    const fd = new FormData()
    fd.set('veli_email', '')
    fd.set('veli_telefon', '905551112233')
    await updateVeliContact(SID, CID, fd)
    expect(ClassService.updateVeliContact).toHaveBeenLastCalledWith(SID, { email: null, telefon: '905551112233', ad: undefined })
  })

  it('tam form (öğrenci sayfası) boş adı boşaltır', async () => {
    const fd = new FormData()
    fd.set('veli_email', ''); fd.set('veli_telefon', ''); fd.set('veli_ad', '')
    await updateVeliContact(SID, CID, fd)
    expect(ClassService.updateVeliContact).toHaveBeenLastCalledWith(SID, { email: null, telefon: null, ad: null })
  })
})
