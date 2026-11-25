# 剧好写 0.5.0：iCloud 接入与验收

本版本提供 CloudKit 原生桥接、共享界面和可测试的同步层。当前未配置开发团队和容器；不能称为已经通过真实 iCloud 验收的发布版。

## 当前可以使用什么

- 原有本地写作、备份、PDF、场景及版本功能保持可用。
- 右上角 iCloud 入口显示真实配置状态。未配置时禁用上传和邀请；没有模拟成功状态。
- 已实现的原生接口：系统账号、项目发现、项目创建、接受指定账号邀请、成员读写权限/撤销、增量读取、追加修改记录、协作者状态、版本副本。
- 共享是整份剧本的共享，包括场景笔记和隐藏场景。启用前界面会说明。
- 邀请方式为填写受邀人的 Apple 账号邮箱，创建私有 CKShare 后复制链接，再由用户自行发送。当前使用“粘贴链接接受”，尚未集成系统点击共享链接直接唤起 App 的入口。
- CloudKit 负责权限；界面上的角色只是缓存。原生桥每次调用核验系统账号，上传再检查权限。切换账号后不允许把原账号的缓存上传到新账号。

## 数据路径

```
Tiptap / Yjs → 本地 IndexedDB（离线原稿）
            → 类型化 Electron IPC → 独立 Swift helper → CloudKit private/shared zone
```

每份剧本使用一个自定义 record zone。场景 UUID 保持稳定，排序只是修改 order 属性。传输层使用不可变的 Yjs 增量记录，ID 是内容 SHA-256；重复提交具有幂等性。初次开启上传当前 Y.Doc，加入时创建空 Y.Doc，绝不在接收端再生成一套默认场景。

同步先读取云端修改，合并后持久化本地，再推进当前进程的读取 token；上传前也等待本地落盘。token 不跨进程保存：重启后重放历史，避免 token 已保存但正文没保存导致跳过内容。未确认的修改保留在本地 Y.Doc，重连后根据云端状态向量补发。不会把独立 JSON 副本直接覆盖共享文稿。

远端操作使用 ICLOUD_REMOTE origin；Tiptap 撤销仅跟踪当前编辑器本地 origin。云端版本恢复通过现有 fromSnapshot 创建新项目、新场景 UUID，原共享文稿不受影响。

光标使用 Yjs relative positions / Awareness，独立于正文同步。前台轮询默认约 4 秒，编辑合并后约 1.2 秒尝试同步，错误指数退避并遵守 CKErrorRetryAfterKey。CloudKit 不承诺即时延迟。状态 25 秒未更新后不再显示。只读成员不能写共享 zone，因此只读成员不发布光标。不能把当前实现描述为 Pages 同等实时性能。

## 开发者账号准备好以后

1. 在你自己的 Apple Developer 账号注册主 App ID `studio.changjing.writer`，以及原生桥 App ID `studio.changjing.writer.cloudbridge`。这些是当前默认值，可以在正式注册前确定更合适的标识。
2. 为原生桥开启 iCloud / CloudKit，创建实际 Container（建议命名 `iCloud.studio.changjing.writer`，但该容器尚未被我们创建），关联 App ID。
3. 下载匹配开发团队、helper Bundle ID、设备和容器的 macOS 开发描述文件，安装对应开发证书。不要向聊天发送密码、私钥或证书导出密码。
4. 用与 SDK 匹配的 Swift 工具链编译。当前机器默认 SDK 与编译器版本不匹配，验证时显式选择了 MacOSX15.4.sdk。

```sh
export JUHAO_ICLOUD_CONTAINER='你的实际 Container ID'
# 仅当前机器工具链需要：
export JUHAO_MACOS_SDK='/Library/Developer/CommandLineTools/SDKs/MacOSX15.4.sdk'
pnpm run build:icloud

export JUHAO_TEAM_ID='你的 Team ID'
export JUHAO_SIGN_IDENTITY='你钥匙串中已有的开发签名证书名称'
export JUHAO_CLOUD_PROFILE='/你的开发描述文件绝对路径'
pnpm run sign:icloud
```

`sign:icloud` 检查 profile 中的 helper App ID 和容器授权；不创建账号、证书或购买服务。重新运行 build:icloud 会移除旧 profile，需要重新签名，避免配置改变后误用旧授权。

5. 在 CloudKit Development 环境建立下列 schema；通过开发版实际运行各流程后核对所有字段。生产发布前将 schema 部署到 Production，并使用对应分发 profile。两台设备必须使用同一容器、同一环境。

| Record type | 字段 | 用途 |
| --- | --- | --- |
| JWProject | title: String | 项目发现的标题，当前为创建时标题 |
| JWUpdate | payload: Asset | 带 SHA-256 校验的 Yjs 修改 |
| JWVersion | payload: Asset, name: String | 命名 JSON 副本 |
| JWPresence | payload: Bytes, clientID: Double | 临时协作者位置 |
| 系统 CKShare | zone-wide share，publicPermission=none | 指定参与者及读写权限 |

当前实现使用 zone changes 和固定 record ID 获取，不依赖按字段查询的自定义索引。不要手动删除 JWUpdate 记录；这会使新设备缺失历史修改，客户端检测到记录删除会停止同步并保留本地副本。

6. 主 Electron App 仍需完整的 macOS / MAS 签名、描述文件和沙盒适配。不能将“helper 能编译”视为“整个 App 已通过 MAS / CloudKit 沙盒验收”。开发版包含已签 helper 的实际启动和容器权限，需在真实 Apple 开发环境核验。
7. 签名后使用两个不同 Apple 账号的 Mac 执行下方现场验收，再评估是否适合发布。当前 .zip 是未配置、未分发签名的本地测试包。

## 验收层级

自动测试的 `TestCloudStore` 是仅位于 tests/ 下的传输替身，不会随 App 打包，也不连接苹果。它可以注入断线、丢确认、权限撤销和重启，覆盖客户端协议逻辑，但不能证明苹果的同步延迟、推送、配额或证书有效。

| 验收项 | 自动化范围 | 真实 CloudKit 必测 |
| --- | --- | --- |
| 同段同时插入 | 两个 Y.Doc + 两个浏览器编辑器 | 两台 Mac 同时输入中文、替换和删除 |
| 场景移动与另一人编辑正文 | 场景 UUID、顺序、文字一致；无重复 | 拖动过程中持续输入、IME 组合输入 |
| 断网、重连 | 保留离线编辑、与在线修改合并 | 关闭 Wi-Fi、睡眠唤醒、网络切换 |
| 重启 / 丢确认 | 模拟云端持久数据恢复、客户端重载 | 强制结束 helper / App，重开后核对文字 |
| 撤销隔离 | 只撤销本地输入、保留远端输入 | Cmd+Z / 重做、跨场景编辑 |
| 权限 | 只读禁止上传，撤销后保留本地副本 | 邀请、修改权限、移除成员、切换账号 |
| 光标 | relative position 传输与编辑器显示 | 实测延迟、过期消失、长文稿和跨场景 |
| 版本副本 | 新项目副本不改共享原稿 | 两端可见云端版本，并独立恢复 |
| 存储异常 | 本地落盘失败不确认上传 | iCloud 满额、系统磁盘不足 |

## 发布前仍需完成的工作

- 当前没有 Apple Developer 账号，真实账号连接、邀请、权限执行与长时间运行尚未验证，验收不能标记完成。
- 追加日志暂不做跨成员安全压缩/清理；版本和历史会占所有者 iCloud 容量。每条数据限 24 MB，单次桥接输出限 96 MB；达到限制需保留本地副本并提示，不应承诺无限规模。
- 光标旧记录仅在显示层过期，未实现云端清理。正式发布前应补充保留策略和长时间负载测试。
- 版本副本需要用户主动保存。它们与原稿位于同一个共享 zone，不能替代独立导出备份。
- 当前正文同步不会更新发现页中的创建时标题；打开后以共享文稿中的实时标题为准。
- 云端恢复完全依赖 Apple 服务及用户配额；没有对云端服务可用性和 Pages 级延迟作保证。

本版本没有创建云资源、付费订阅、Apple 账号，也没有替用户发送邀请邮件。
