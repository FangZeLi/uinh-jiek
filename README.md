# 韵易

中古汉语音变推演与可视化工具。以《切韵》音系为起点，逐条应用音变规则，展示从南北朝到北京官话的语音演化脉络。

## 功能

- **音变矩阵**：以声母、韵母特征为行/列交叉制表，直观呈现各阶段的音节分布
- **音变溯源**：点击任意音节，追踪其在各音变阶段的变化轨迹
- **阶段浏览**：遍历 40+ 个音变阶段，每个阶段对应一条或一组有据可查的音变规则

## 快速开始

```bash
# 安装依赖
npm install
cd viewer && npm install && cd ..

# 启动后端（端口 8732）
npx tsx server.ts

# 另开终端，启动前端（端口 5173）
cd viewer && npx vite --host
```

浏览器打开 `http://localhost:5173`。

## 技术栈

- **后端**：TypeScript + Express，预计算所有音变阶段并提供 REST API
- **前端**：React + Vite，交互式矩阵表格与 SVG 音变树
- **数据**：《切韵》系韵书字音表，以 YAML 格式存放

## 许可

[GNU General Public License v3.0](https://www.gnu.org/licenses/gpl-3.0.html)

## 反馈

受限于作者学识与客观条件，软件内容不免有舛误之处。如发现错误或有改进建议，欢迎到 [GitHub Issues](../../issues) 提交反馈。
