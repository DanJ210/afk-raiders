import weaponsData from '../content/weapons.json'
import type { EquippedWeaponState, WeaponEntry } from './types.js'

export const STARTER_WEAPON_ID = 'committee_sidearm'

export const weapons = weaponsData as WeaponEntry[]

export function getWeaponById(weaponId: string): WeaponEntry | null {
  return weapons.find(weapon => weapon.id === weaponId) ?? null
}

export function getStarterWeapon(): WeaponEntry {
  const weapon = getWeaponById(STARTER_WEAPON_ID)
  if (!weapon) throw new Error(`Starter weapon ${STARTER_WEAPON_ID} is missing from weapons.json`)
  return weapon
}

export function createStarterEquippedWeaponState(): EquippedWeaponState {
  const weapon = getStarterWeapon()
  return {
    weaponId: weapon.id,
    durability: weapon.durability,
  }
}
