/**
 * Server-side authorization helpers.
 * Mevcut request context'inden Ability nesnesi oluşturur.
 *
 * Bu dosyayı SADECE Server Components ve Server Actions'ta import edin.
 * Client Component'ta çalıştırılmaz.
 */

import { getCurrentUser, getCurrentProfile, getCurrentPermissions } from '@/src/shared/auth'
import { securityLog } from '@/src/infrastructure/observability/logger'
import { subscriptionState } from '@/src/domains/billing/subscriptionMath'
import { todayLocalISO } from '@/src/shared/date'
import { createAbility, AuthorizationError, type Ability } from './index'

/**
 * Mevcut request'teki kullanıcı için Ability oluşturur.
 * Giriş yapılmamışsa `null` döner.
 */
export async function getAbility(): Promise<Ability | null> {
  const [user, profile, permissions] = await Promise.all([
    getCurrentUser(),
    getCurrentProfile(),
    getCurrentPermissions(),
  ])
  if (!user || !profile?.school_id) return null
  return createAbility({ userId: user.id, schoolId: profile.school_id, permissions })
}

/**
 * Ability oluşturur; giriş yoksa AuthorizationError fırlatır.
 */
export async function requireAbility(): Promise<Ability> {
  const ability = await getAbility()
  if (!ability) {
    securityLog('auth.unauthenticated_server_action', {
      stack: new Error().stack?.split('\n')[2]?.trim(),
    })
    throw new AuthorizationError({ code: 'UNAUTHENTICATED', permission: '*' })
  }

  // Abonelik guard'ı: layout redirect'ini soft-nav ile atlayan oturum da yazamasın.
  // getCurrentProfile cache()'li — aynı istekte ikinci çağrı bedava.
  const profile = await getCurrentProfile()
  if (profile?.schools) {
    const state = subscriptionState(profile.schools, todayLocalISO())
    if (state === 'expired' || state === 'suspended') {
      securityLog('auth.subscription_expired_action', { user_id: ability.userId, school_id: ability.schoolId })
      throw new AuthorizationError({ code: 'SUBSCRIPTION_EXPIRED', permission: '*' })
    }
  }

  return ability
}
