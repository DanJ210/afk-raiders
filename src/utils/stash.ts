/**
 * Home stash utilities: stash icon mapping and number formatting.
 */

import apparelAccessoriesData from '../content/loot-tables/apparel_accessories.json'
import arcTechData from '../content/loot-tables/arc_tech.json'
import consumablesData from '../content/loot-tables/consumables.json'
import cursedWeirdItemsData from '../content/loot-tables/cursed_weird_items.json'
import personalJunkData from '../content/loot-tables/personal_junk.json'
import scrapComponentsData from '../content/loot-tables/scrap_components.json'
import valuablesData from '../content/loot-tables/valuables.json'
import weaponsPartsData from '../content/loot-tables/weapons_parts.json'
import consumablesIcon from '../assets/loot_tables/consumables/consumables_icon.png'

type LootTableCategory =
  | 'apparel_accessories'
  | 'arc_tech'
  | 'consumables'
  | 'cursed_weird_items'
  | 'personal_junk'
  | 'scrap_components'
  | 'valuables'
  | 'weapons_parts'

interface LootTableData {
  category: LootTableCategory
  items: Array<{ id: string }>
}

const lootTables: LootTableData[] = [
  apparelAccessoriesData as LootTableData,
  arcTechData as LootTableData,
  consumablesData as LootTableData,
  cursedWeirdItemsData as LootTableData,
  personalJunkData as LootTableData,
  scrapComponentsData as LootTableData,
  valuablesData as LootTableData,
  weaponsPartsData as LootTableData,
]

const itemIdToCategory = new Map<string, LootTableCategory>()
for (const table of lootTables) {
  for (const item of table.items) {
    itemIdToCategory.set(item.id, table.category)
  }
}

const tableIconImageMap: Partial<Record<LootTableCategory, string>> = {
  consumables: consumablesIcon,
}

const consumablesItemIconModules = import.meta.glob('../assets/loot_tables/consumables/*.png', {
  eager: true,
  import: 'default',
}) as Record<string, string>

const consumablesItemIconMap = new Map<string, string>()
for (const [path, iconPath] of Object.entries(consumablesItemIconModules)) {
  const fileName = path.split('/').pop() ?? ''
  const itemId = fileName.replace(/\.png$/i, '')
  if (!itemId) continue
  consumablesItemIconMap.set(itemId, iconPath)
}

const tableEmojiFallbackMap: Record<LootTableCategory, string> = {
  apparel_accessories: '🧢',
  arc_tech: '⚙️',
  consumables: '🥫',
  cursed_weird_items: '🌀',
  personal_junk: '🧸',
  scrap_components: '🔩',
  valuables: '💎',
  weapons_parts: '🔫',
}

export interface StashIconDescriptor {
  kind: 'emoji' | 'image'
  value: string
  alt: string
}

function getLegacyFallbackEmoji(itemName: string): string {
  const lower = itemName.toLowerCase()
  if (lower.includes('water')) return '💧'
  if (lower.includes('bottle')) return '🍾'
  if (lower.includes('ammo')) return '🔫'
  if (lower.includes('armor') || lower.includes('helmet') || lower.includes('vest')) return '🛡️'
  if (lower.includes('med') || lower.includes('heal') || lower.includes('stimpack')) return '🏥'
  if (lower.includes('key') || lower.includes('card')) return '🔑'
  if (lower.includes('food') || lower.includes('ration')) return '🥫'
  if (lower.includes('rare')) return '✨'
  return '📦'
}

export function getStashIcon(item: { itemId: string; name: string }): StashIconDescriptor {
  const category = itemIdToCategory.get(item.itemId)
  if (category) {
    if (category === 'consumables') {
      const itemIcon = consumablesItemIconMap.get(item.itemId)
      if (itemIcon) {
        return {
          kind: 'image',
          value: itemIcon,
          alt: `${item.name} icon`,
        }
      }
    }

    const image = tableIconImageMap[category]
    if (image) {
      return {
        kind: 'image',
        value: image,
        alt: `${category.replaceAll('_', ' ')} item icon`,
      }
    }

    return {
      kind: 'emoji',
      value: tableEmojiFallbackMap[category],
      alt: `${category.replaceAll('_', ' ')} item icon`,
    }
  }

  // Legacy fallback for items outside known loot tables.
  const emoji = getLegacyFallbackEmoji(item.name)
  return {
    kind: 'emoji',
    value: emoji,
    alt: `${item.name} category icon`,
  }
}

export function formatNumber(value: number): string {
  return value.toLocaleString('en-US')
}
