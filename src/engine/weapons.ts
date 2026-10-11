import weaponsData from '../content/weapons.json'
import type { GameState, OwnedWeapon, WeaponEntry } from './types.js'

export const STARTER_WEAPON_ID = 'tea_kettle'

const weapons = weaponsData as WeaponEntry[]

export function getWeaponCatalog(): WeaponEntry[] {
  return weapons
}

export function getDefaultWeapon(): WeaponEntry {
  return weapons.find(weapon => weapon.id === STARTER_WEAPON_ID) ?? weapons[0]
}

export function findWeapon(weaponId: string | null | undefined): WeaponEntry | null {
  if (!weaponId) return null
  return weapons.find(weapon => weapon.id === weaponId) ?? null
}

export function createStarterOwnedWeapon(): OwnedWeapon {
  const starter = getDefaultWeapon()
  return {
    weaponId: starter.id,
    durability: starter.durabilityMax,
  }
}

export function findUsableWeapon(state: GameState, weaponId: string | null | undefined): WeaponEntry | null {
  const owned = state.ownedWeapons.find(entry => entry.weaponId === weaponId)
  return owned && owned.durability > 0 ? findWeapon(weaponId) : null
}
