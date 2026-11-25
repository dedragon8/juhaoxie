# 剧好写：Codex / Claude 接入

在 Mac App 的“设置 → 接入 Agent”里，先授权当前打开的剧本，再复制客户端配置。初始权限为只读，需要修改时另行开启写入。授权按剧本保留，重新打开该剧本时恢复原有读写权限，直到用户撤销；进入安全区后禁用接入。目录旁仅显示实际握手成功且仍在线的客户端。

配置动态使用当前 App 位置及当前用户的连接文件路径。把 App 放到固定位置后再复制配置；移动 App 后更新客户端配置。使用 App 内置 Electron 的 Node 运行时，不依赖额外安装 Node.js。

## 配置客户端

- Codex：将设置页生成的 `[mcp_servers.juhaoxie]` 和对应 env 表合并到 `~/.codex/config.toml`。保留其他配置，已有同名条目时替换。重新连接 MCP 后，本页应显示客户端名称。
- Claude Desktop：设置 → Developer → Edit Config，将生成的 `juhaoxie` 条目合并到 `mcpServers` 中，保留已有服务器。重启 Claude Desktop。
- 网页客户端不能直接连接这一本地 STDIO 接口。请使用支持本地 MCP 的客户端。

配置方式参考 [Codex 官方 MCP 文档](https://developers.openai.com/codex/mcp) 与 [MCP 的 Claude Desktop 接入教程](https://modelcontextprotocol.io/docs/develop/connect-local-servers)。协议使用 [MCP STDIO transport](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports)。

## 能力和约束

| 工具 | 用途 |
| --- | --- |
| read_script | 当前授权剧本、幕、场景及段落；默认排除隐藏场景，可明确请求包含 |
| read_scene | 读取完整场景及段落身份、序号、格式和文字 |
| create_scene | 按指定位置添加带格式场景 |
| replace_paragraph | 改一个段落的文字，保留种类与未修改范围的字体 |
| save_version | 保存本地命名版本，最多保留 20 个 |
| get_video_prompt_skill | 获取最新版完整生成规则，写 Prompt 前必须调用 |
| read_prompt_sources | 最新 Skill、原文关联、已有 Prompt、当前草稿、参考图元数据 |
| read_prompt_image | 读取当前授权剧本中的指定参考图 |
| save_video_prompt | 保存一段视频的 Prompt，可含单镜头或镜头组；保留版本历史 |

写工具需要在 App 内开启权限。只读剧本仍会拒绝写入。工具无法删除剧本、读任意文件或执行系统命令。

替换前先 read_scene；提交返回的 paragraph_id、paragraph_index 和完整 expected_text。如果段落移动、删除或文字已变，拒绝修改并要求重读。复杂硬换行段落暂不通过接口修改。修改不会进入人的编辑器撤销栈。

每个写操作需要唯一 request_id。同一次重试必须复用相同 ID 和参数。成功记录和文稿变化同处 Y.Doc 内持久化，重启后重试不会再添加一份相同场景。同一个 ID 携带不同参数会报错。不要并发让两台设备使用相同 ID 执行不同任务。

例：“先读取剧好写当前剧本，保存一个名为‘AI 修改前’的版本，再给第一场补一句动作描述，保留现有对白。”

## 连接和数据边界

客户端以 STDIO 启动内置桥接进程，通过仅本机的 Unix socket 与 App 通信。socket 和含随机令牌的连接文件权限为 0600；不监听公网或局域网端口。配置文本不包含令牌。只绑定当前明确授权的项目。

状态由 MCP 初始化握手、套接字连接及最近实际工具调用产生，不会把“开启接口”显示成“客户端已连接”。客户端会按自己的模型配置处理读取的文字，可能将其发送到模型服务；App 本身不需要 AI 密钥，也不代用户修改 Codex / Claude 的配置。

## Prompt 工作流

内置 Skill 是本机 App 提供的工具结果，不是自动安装到客户端的插件。MCP 初始化说明与工具描述要求 Agent 先读取 Skill；服务拒绝未读取规则的连接直接保存 Prompt。read_prompt_sources 同时附上完整规则，直接说“把当前剧本转写为 Prompt”也可按该流程执行，不需要手动复制 Skill。

一条记录代表一段生成视频。镜头组写在 fields.shotSequence；各子镜头和切换关系依次描述，整组保存一条。fields.model 保留用户填写的预使用生视频模型，不混入全文。未给出的内容、画幅、占位词和解释性标签不进入完整 Prompt。人物标签仅存姓名，人物及定妆照由用户在 fields.characterAppearance 自由填写，不自动带入人物介绍或追加人物设定。参考图需要真实 ID，并在对应内容处写 @参考图N。

外部视频画布的实际上传、生成与发布需另行明确授权；当前版本不包含 TapNow/Lib 的专用连接器。
