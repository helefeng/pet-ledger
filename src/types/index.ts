// 用户
export interface User {
  id: string
  username: string
  password: string // 实际应用中应该加密
  createdAt: string
}

// 游戏账号
export interface GameAccount {
  id: string
  userId: string
  accountName: string
  gameEmail: string
  tradeBalance?: number // 交易余额（元宝）
  tradeBalanceUpdatedAt?: string // 余额更新时间
  createdAt: string
}

// 交易类型
export type TradeType = 'buy' | 'sell'
export type TradeStatus = 'pending' | 'confirmed'

// 宠物交易记录
export interface PetTrade {
  id: string
  userId: string
  accountId: string
  itemName: string
  type: TradeType
  status?: TradeStatus // 订单状态（卖出时使用）
  price: number
  quantity: number
  nature: string // 性格
  level: number // 等级
  individual: number // 个体值 0-31
  ability: string // 特性
  tradeDate: string
  isShiny: '是' | '否'
  commission: number // 5% 提成
  actualProfit: number // 实际收益
  createdAt: string
  updatedAt: string
  synced?: boolean
}

// 分类（保留以兼容）
export interface Category {
  id: string
  name: string
  type: TradeType
  icon?: string
}

// 星球日记
export interface PlanetDiary {
  id: string
  userId: string
  accountId: string
  planet: string // 所在星球
  title: string // 日记标题
  diaryType: 'shiny' | 'daily' // 日记类型：异色事件 | 日常事件
  content: string // 日记内容（选填）
  images: string[] // 图片数组（base64 或 URL）
  eventTime: string // 事件时间（精确到分）
  createdAt: string
  updatedAt: string
}

// 日常任务
export type TaskCategory = 'permanent' | 'limited' // 常驻 | 限时

export interface TaskTemplate {
  id: string
  userId: string // 绑定用户
  title: string // 任务名称
  category: TaskCategory
  expireAt?: string // 限时任务截止时间（可选）
  createdAt: string
  updatedAt: string
}

export interface TaskRecord {
  id: string
  userId: string
  accountId: string
  taskId: string // 关联 TaskTemplate
  completed: boolean
  completedAt?: string
  date: string // 任务日期 yyyy-mm-dd
  createdAt: string
  updatedAt: string
}

// 统计数据
export interface Statistics {
  totalBuy: number
  totalSell: number
  totalCommission: number
  totalProfit: number
  tradeCount: number
  balance: number
}
