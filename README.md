# yunzai-deepseek

Yunzai 的 DeepSeek 群聊插件。普通消息低概率插话，点名必达，聊天记录留在本地。

## 安装

克隆到 Yunzai 的插件目录。不要和旧的单文件 `deepseek.js` 一起开。

```bash
git clone https://github.com/jy-encore/yunzai-deepseek.git plugins/deepseek
pnpm add openai -w
```

重启 Yunzai。

## 配置

复制思路：直接改 [config/config.json](config/config.json)。`apiKeys` 默认是空数组，把 DeepSeek 密钥填在本机，**不要把填好的密钥提交回仓库**。

| 字段 | 默认 | 说明 |
|---|---|---|
| `apiKeys` | `[]` | 密钥列表。留空则不会请求接口 |
| `baseURL` | `https://api.deepseek.com` | 接口地址 |
| `model` | `deepseek-flash` | 模型名 |
| `botName` | `安可儿` | 机器人称呼 |
| `role` | 内置人设 | 只发给模型，不出现在帮助图和状态图上 |
| `probability` | `0.05` | 普通消息触发概率 |
| `nameProbability` | `1` | 以 `botName` 开头时的触发概率，`1` 为必进回复 |
| `historyCount` | `10` | 命中后附带的前文条数 |
| `logKeep` | `100` | 每个群本地保留条数 |
| `maxTokens` | `120` | 普通回复上限 |
| `temperature` | `0.9` | 采样温度 |
| `disabledGroups` | `[]` | 关闭回复的群号，一般用指令改 |

## 指令

主人指令：

- `#deepseek帮助`：帮助图，右上角是账户余额
- `#deepseek状态`：模型、概率、本群记录和余额，不展示人设
- `#deepseek开启` / `#deepseek关闭`：当前群的回复开关
- `#deepseek设置回复概率 5`
- `#deepseek设置历史条数 10`
- `#deepseek设置回复上限 120`
- `#deepseek设置温度 0.9`
- `#deepseek设置提示词 ...`
- `#deepseek清空记录`

群里：

- `#总结群聊`：用本群记录做一次复盘，先一句提示，再一条正文

## 回复规则

1. 每条群消息先写入 `chatlog/群号.json`。
2. 普通消息按 `probability` 决定要不要问模型。没中签不请求。
3. 以 `botName` 开头的消息按 `nameProbability`，默认 100%，并且不允许模型回 `[IGNORE]`。
4. 问模型时只带当前这条和它前面 `historyCount` 条。内容、昵称、QQ 号都会带上。
5. 模型回 `[IGNORE]` 就不发言。
6. QQ 号以 `3889` 开头的消息不参与概率，也不进入总结和那几条前文。
7. 群被关闭后，不再自动回复，也不做总结。记录继续写。

出错才会出现在 Yunzai 后台。正常记账、未命中概率、忽略回复都不打日志。

## 聊天记录

旧文件可以直接放进 `chatlog/`。两种都认：

```json
{ "msgs": [ { "ts": 1791246304, "uid": 10000, "n": "昵称", "m": "消息" } ] }
```

```json
[ { "ts": 1791246304, "uid": 10000, "n": "昵称", "m": "消息" } ]
```

写回时统一成第一种。`chatlog/*.json` 已被忽略，不会进 Git。

## 目录

```
apps/        记账、概率回复、总结、帮助
model/       配置、记录、接口、渲染
config/      config.json
chatlog/     每个群一份记录
resources/   帮助和状态的页面
```
