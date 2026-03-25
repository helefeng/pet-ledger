import Dexie, { type Table } from 'dexie'
import type { User, GameAccount, PetTrade, Category, PlanetDiary, TaskTemplate, TaskRecord } from '@/types'

export class PetTradeDB extends Dexie {
  users!: Table<User>
  gameAccounts!: Table<GameAccount>
  petTrades!: Table<PetTrade>
  categories!: Table<Category>
  planetDiaries!: Table<PlanetDiary>
  taskTemplates!: Table<TaskTemplate>
  taskRecords!: Table<TaskRecord>

  constructor() {
    super('PetTradeDB_v2')
    this.version(1).stores({
      users: 'id',
      gameAccounts: 'id',
      petTrades: 'id',
      categories: 'id',
    })
    this.version(2).stores({
      users: 'id',
      gameAccounts: 'id',
      petTrades: 'id',
      categories: 'id',
      planetDiaries: 'id',
    })
    this.version(3).stores({
      users: 'id',
      gameAccounts: 'id',
      petTrades: 'id',
      categories: 'id',
      planetDiaries: 'id',
      taskTemplates: 'id',
      taskRecords: 'id',
    })
    this.version(4).stores({
      users: 'id',
      gameAccounts: 'id',
      petTrades: 'id, accountId, userId, tradeDate, [accountId+tradeDate]',
      categories: 'id',
      planetDiaries: 'id, userId',
      taskTemplates: 'id',
      taskRecords: 'id',
    })
  }
}

export const db = new PetTradeDB()

// 初始化默认分类
export async function initializeDefaultCategories() {
  const count = await db.categories.count()
  if (count === 0) {
    const defaultCategories: Category[] = [
      { id: '1', name: '买入', type: 'buy', icon: '📥' },
      { id: '2', name: '卖出', type: 'sell', icon: '📤' },
    ]
    await db.categories.bulkAdd(defaultCategories)
  }
}
