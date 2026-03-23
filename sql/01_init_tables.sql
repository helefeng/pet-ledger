-- ============================================
-- 游戏交易记账系统 - 数据库初始化脚本
-- ============================================

-- 1. 创建游戏账号表
-- 用于存储用户的不同游戏账号信息
CREATE TABLE game_accounts (
  -- 主键：唯一标识符
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 账号名称：游戏中的账号名（必填）
  account_name TEXT NOT NULL,
  
  -- 游戏邮箱：该账号注册时的邮箱（必填，唯一）
  game_email TEXT NOT NULL UNIQUE,
  
  -- 创建时间：记录何时添加这个账号
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. 创建交易记录表
-- 用于存储每个账号的交易记录
CREATE TABLE trades (
  -- 主键：唯一标识符
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 外键：关联到哪个游戏账号
  -- ON DELETE CASCADE 表示删除账号时，该账号的所有交易也会被删除
  account_id UUID NOT NULL REFERENCES game_accounts(id) ON DELETE CASCADE,
  
  -- 物品名称：交易的宠物/物品名称（必填）
  item_name TEXT NOT NULL,
  
  -- 交易类型：'buy'（买入）或 'sell'（卖出）（必填）
  type TEXT NOT NULL,
  
  -- 价格：单价（必填）
  price DECIMAL NOT NULL,
  
  -- 数量：购买/出售的数量（默认为1）
  quantity INTEGER DEFAULT 1,
  
  -- 性格：宠物的性格（必填）
  -- 例如：孤独、固执、调皮等
  nature TEXT NOT NULL,
  
  -- 等级：宠物的等级（必填）
  level INTEGER NOT NULL,
  
  -- 个体：宠物的个体值（必填）
  -- 取值范围：0-31 的整数
  individual INTEGER NOT NULL,
  
  -- 特性：宠物的特性（可选）
  -- 例如：叶绿、流水、炎火等
  ability TEXT,
  
  -- 交易日期：交易发生的日期（年月日）（必填）
  trade_date DATE NOT NULL,
  
  -- 异色：是否是异色宠物（必填）
  is_shiny TEXT NOT NULL DEFAULT '否',
  
  -- 创建时间：记录何时添加这条交易
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3. 启用行级安全（RLS）
-- 这是 Supabase 的安全机制，确保数据访问权限
ALTER TABLE game_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

-- 4. 创建访问策略
-- 因为暂时没有登录功能，允许所有操作
-- 后续如果添加登录，可以修改这些策略来限制访问

-- 游戏账号表：允许所有操作
CREATE POLICY "Allow all on game_accounts" ON game_accounts
  FOR ALL USING (true) WITH CHECK (true);

-- 交易记录表：允许所有操作
CREATE POLICY "Allow all on trades" ON trades
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 说明：
-- - UUID：通用唯一标识符，自动生成
-- - DECIMAL：用于存储价格，支持小数
-- - DATE：只存储日期（年月日），不包含时间
-- - TIMESTAMP：存储完整的日期和时间
-- ============================================
