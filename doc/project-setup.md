# 项目初始化步骤

## 队友执行（Day 1上午）

### 1. 创建目录结构

在项目根目录下创建以下目录：

```bash
mkdir -p src/types
mkdir -p src/engine/assembler
mkdir -p src/engine/core
mkdir -p src/view
mkdir -p src/components/datapath
mkdir -p src/components/panels
mkdir -p src/components/timeline
mkdir -p src/components/layout
mkdir -p src/store
mkdir -p src/config/examples
```

### 2. 配置Tailwind CSS

修改 `tailwind.config.js`:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

修改 `src/index.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### 3. 配置Vitest

创建 `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})
```

创建 `src/test/setup.ts`:

```ts
import { expect, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'

afterEach(() => {
  cleanup()
})
```

### 4. 更新package.json scripts

添加测试脚本：

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:ui": "vitest --ui"
  }
}
```

## 完成标志

运行以下命令验证：

```bash
npm run dev    # 应该能启动开发服务器
npm run test   # 应该能运行测试（即使没有测试文件）
```

如果都成功，通知你的队友开始Day 1下午的类型定义工作。
