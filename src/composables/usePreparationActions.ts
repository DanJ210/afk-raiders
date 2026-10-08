import { appendLogEntries } from '../engine/log.js'
import { createRNG } from '../engine/rng.js'
import type { GameState, LogEvent } from '../engine/types.js'
import {
  clearSelectedHealingLoadout,
  clearSelectedShieldRechargerLoadout,
  equipWeapon,
  purchaseHealingItem,
  purchaseShieldRecharger,
  purchaseWeapon,
  repairWeapon,
  setSelectedHealingLoadout,
  setSelectedShieldRechargerLoadout,
} from '../engine/loadout.js'

export interface PreparationActionsReturn {
  purchaseWeapon: (weaponId: string) => void
  repairWeapon: (weaponId: string) => void
  equipWeapon: (weaponId: string) => void
  purchaseHealingItem: (itemId: string, quantity?: number) => void
  purchaseShieldRecharger: (itemId: string, quantity?: number) => void
  setSelectedHealingLoadout: (selections: Array<{ itemId: string; quantity: number }>) => void
  setSelectedShieldRechargerLoadout: (selections: Array<{ itemId: string; quantity: number }>) => void
  clearSelectedHealingLoadout: () => void
  clearSelectedShieldRechargerLoadout: () => void
}

export function usePreparationActions(
  stateRef: { value: GameState },
  lastTickAtRef: { value: number },
  persistCallback: (state: GameState, seed: number, lastTickAt: number) => void,
  publishEvents?: (events: LogEvent[]) => void,
  getSeed?: () => number,
): PreparationActionsReturn {
  function persistState() {
    persistCallback(stateRef.value, getSeed?.() ?? 0, lastTickAtRef.value)
  }

  /** UI-boundary RNG for desk-voice narration variety; not part of the tick simulation. */
  function narrationRng(now: number) {
    return createRNG((((getSeed?.() ?? 0) ^ now) >>> 0))
  }

  function commitLogged(result: NonNullable<ReturnType<typeof purchaseWeapon>>) {
    stateRef.value = {
      ...result.state,
      log: appendLogEntries(stateRef.value.log, [result.event]),
    }
    publishEvents?.([result.event])
    persistState()
  }

  function purchaseWeaponAction(weaponId: string) {
    const now = Date.now()
    const result = purchaseWeapon(stateRef.value, weaponId, now, narrationRng(now))
    if (!result) return
    commitLogged(result)
  }

  function repairWeaponAction(weaponId: string) {
    const now = Date.now()
    const result = repairWeapon(stateRef.value, weaponId, now, narrationRng(now))
    if (!result) return
    commitLogged(result)
  }

  function equipWeaponAction(weaponId: string) {
    const now = Date.now()
    const result = equipWeapon(stateRef.value, weaponId, now, narrationRng(now))
    if (!result) return
    commitLogged(result)
  }

  function purchaseHealingItemAction(itemId: string, quantity = 1) {
    const now = Date.now()
    const result = purchaseHealingItem(stateRef.value, itemId, quantity, now, narrationRng(now))
    if (!result) return
    commitLogged(result)
  }

  function purchaseShieldRechargerAction(itemId: string, quantity = 1) {
    const now = Date.now()
    const result = purchaseShieldRecharger(stateRef.value, itemId, quantity, now, narrationRng(now))
    if (!result) return
    commitLogged(result)
  }

  function setSelectedHealingLoadoutAction(selections: Array<{ itemId: string; quantity: number }>) {
    const result = setSelectedHealingLoadout(stateRef.value, selections, Date.now())
    if (!result) return
    commitLogged(result)
  }

  function setSelectedShieldRechargerLoadoutAction(selections: Array<{ itemId: string; quantity: number }>) {
    const result = setSelectedShieldRechargerLoadout(stateRef.value, selections, Date.now())
    if (!result) return
    commitLogged(result)
  }

  function clearSelectedHealingLoadoutAction() {
    const result = clearSelectedHealingLoadout(stateRef.value, Date.now())
    if (!result) return
    commitLogged(result)
  }

  function clearSelectedShieldRechargerLoadoutAction() {
    const result = clearSelectedShieldRechargerLoadout(stateRef.value, Date.now())
    if (!result) return
    commitLogged(result)
  }

  return {
    purchaseWeapon: purchaseWeaponAction,
    repairWeapon: repairWeaponAction,
    equipWeapon: equipWeaponAction,
    purchaseHealingItem: purchaseHealingItemAction,
    purchaseShieldRecharger: purchaseShieldRechargerAction,
    setSelectedHealingLoadout: setSelectedHealingLoadoutAction,
    setSelectedShieldRechargerLoadout: setSelectedShieldRechargerLoadoutAction,
    clearSelectedHealingLoadout: clearSelectedHealingLoadoutAction,
    clearSelectedShieldRechargerLoadout: clearSelectedShieldRechargerLoadoutAction,
  }
}
