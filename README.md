# yunzai-deepseek

Yunzai 的 DeepSeek 群聊插件。普通消息按概率插话，命中后只带上这条和它前面的若干条记录。

## 安装

把本仓库放到 `Yunzai/plugins/yunzai-deepseek`，或克隆为 `plugins/deepseek`。不要和旧的单文件 `deepseek.js` 同时启用。

```bash
pnpm add openai -w
```

重启 Yunzai。

## 配置

编辑 `config/config.json`，把 DeepSeek 的 API Key 填进 `apiKeys`。这个文件会进仓库模板，**不要把真实密钥提交回去**。

| 字段 | 说明 |
|---|---|
| `apiKeys` | 密钥数组，留空则不会请求 |
| `botName` | 机器人名字，写进角色设定 |
| `role` | 角色设定 |
| `probability` | 普通消息触发概率，默认 `0.05` |
| `historyCount` | 命中后附带的前文条数，默认 `10` |
| `logKeep` | 每个群本地保留条数，默认 `100` |
| `maxTokens` / `temperature` | 采样参数 |

## 记录

每个群一个文件：`chatlog/群号.json`。

```json
{ "msgs": [ { "ts": 1791246304, "uid": 10000, "n": "昵称", "m": "消息" } ] }
```

也接受不带 `msgs` 的纯数组。`chatlog/*.json` 已在 `.gitignore` 里。
