# 🐾 宠物交易账本

一个现代化的宠物交易记录应用，支持多端同步、离线使用和云备份。

## ✨ 功能特性

- 📱 **跨平台支持** - 在手机和电脑上无缝使用
- 💾 **离线优先** - 本地 IndexedDB 存储，离线也能记录
- ☁️ **云同步** - 支持 Supabase 实时同步（可选）
- 📊 **数据统计** - 按宠物、分类、时间段统计分析
- 📤 **数据导入导出** - JSON 格式备份和恢复
- 🎨 **现代 UI** - 使用 Naive UI 组件库，支持亮暗主题

## 🛠️ 技术栈

- **前端框架**: Vue 3 + TypeScript
- **UI 组件库**: Naive UI
- **状态管理**: Pinia
- **本地存储**: IndexedDB (Dexie.js)
- **云服务**: Supabase (可选)
- **构建工具**: Vite
- **部署**: GitHub Pages

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

访问 `http://localhost:5173`

### 构建生产版本

```bash
npm run build
```

### 预览生产版本

```bash
npm run preview
```

## 📋 项目结构

```
pet-ledger/
├── src/
│   ├── components/          # 可复用组件
│   ├── views/              # 页面组件
│   │   ├── Home.vue        # 首页
│   │   ├── AddTransaction.vue  # 添加交易
│   │   ├── Statistics.vue  # 统计分析
│   │   └── Settings.vue    # 设置
│   ├── stores/             # Pinia 状态管理
│   │   └── ledger.ts       # 账本 store
│   ├── services/           # 业务逻辑
│   │   ├── db.ts          # 本地数据库
│   │   └── sync.ts        # 云同步服务
│   ├── types/              # TypeScript 类型定义
│   ├── router/             # 路由配置
│   ├── assets/             # 静态资源
│   ├── App.vue             # 根组件
│   └── main.ts             # 入口文件
├── index.html              # HTML 模板
├── vite.config.ts          # Vite 配置
├── tsconfig.json           # TypeScript 配置
├── package.json            # 项目配置
└── .env.example            # 环境变量示例
```

## ⚙️ 配置 Supabase（可选）

如果想启用云同步功能：

1. 在 [Supabase](https://supabase.com) 创建项目
2. 创建 `transactions` 表（参考下面的 SQL）
3. 复制项目 URL 和 Anon Key
4. 创建 `.env.local` 文件：

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_KEY=your-anon-key
```

### Supabase 表结构

```sql
create table transactions (
  id text primary key,
  pet_name text not null,
  type text not null,
  amount numeric not null,
  category text not null,
  description text,
  date text not null,
  created_at timestamp default now(),
  updated_at timestamp default now(),
  synced boolean default false
);

create index idx_transactions_date on transactions(date);
create index idx_transactions_pet_name on transactions(pet_name);
```

## 📱 部署到 GitHub Pages

1. 修改 `vite.config.ts` 中的 `base` 配置
2. 构建项目：`npm run build`
3. 将 `dist` 文件夹推送到 GitHub Pages

## 🎯 使用指南

### 添加交易记录

1. 点击"添加交易"按钮
2. 选择交易类型（收入/支出）
3. 输入宠物名称、分类、金额等信息
4. 点击"保存交易"

### 查看统计

- **首页**: 查看最近交易和总体统计
- **统计分析**: 按宠物、分类、时间段查看详细统计

### 数据备份

在设置页面可以：
- 导出数据为 JSON 文件
- 导入之前导出的数据
- 手动同步到云端

## 🔒 隐私说明

- 所有数据默认存储在本地浏览器
- 云同步完全可选，不配置也能正常使用
- 导出的数据文件完全由你控制

## 📝 开发计划

- [ ] 图表展示（收支趋势图）
- [ ] 预算管理功能
- [ ] 数据搜索和筛选
- [ ] 移动端 App（React Native）
- [ ] 多账户支持

## 📄 许可证

MIT

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

**提示**: 这是一个个人项目，如有问题或建议，欢迎反馈！
