// 宠物性格列表
export const NATURES = [
  '孤独', '固执', '调皮', '勇敢', '大胆',
  '顽皮', '无虑', '悠闲', '保守', '稳重',
  '马虎', '冷静', '沉着', '温顺', '慎重',
  '狂妄', '胆小', '急躁', '开朗', '天真',
  '害羞', '实干', '坦率', '浮躁', '认真',
]

// 宠物特性列表
export const ABILITIES = [
  '叶绿', '流水', '炎火', '飞空', '蓄电',
  '机能', '碎裂', '平衡', '冰霜', '魔幻',
  '战意', '光环', '黑夜', '奇异', '威严',
  '圣灵', '精准', '会心', '坚硬', '回避',
  '顽强', '瞬杀', '回神', '带电', '中毒',
  '高热', '冰冷', '阴森', '睡眠', '反抗',
  '反驳', '忽略', '草率', '慌张', '反击',
  '抵抗', '反攻', '坚韧', '借风',
]

// 异色选项
export const SHINY_OPTIONS = ['是', '否']

// 格式化数字显示（精确无四舍五入，>=10000 用 w 显示保留四位小数）
export const formatNumber = (num: number): string => {
  if (num === 0) return '0'
  const abs = Math.abs(num)
  const sign = num < 0 ? '-' : ''
  if (abs >= 10000) {
    // 截断到小数点后4位（不四舍五入）
    const truncated = Math.trunc(abs / 10000 * 10000) / 10000
    const str = truncated.toFixed(4).replace(/\.?0+$/, '')
    return sign + str + 'w'
  }
  // 小于 10000 直接显示整数（截断，不四舍五入）
  return sign + Math.trunc(abs).toString()
}
