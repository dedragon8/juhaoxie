import Foundation
import CloudKit
import CryptoKit

// One JSON request per process. The Electron parent owns timeouts and restarts.
// No credentials are passed: CloudKit uses the signed helper's system account.
struct BridgeError: Error { let code: String; let message: String }
struct Reference: Codable {
    var container: String; var zone: String; var owner: String
    var scope: String; var accountID: String; var role: String
    var zoneID: CKRecordZone.ID { CKRecordZone.ID(zoneName: zone, ownerName: owner) }
}
struct Request: Decodable { let method: String; let args: [String: JSONValue]? }
indirect enum JSONValue: Codable {
    case string(String), number(Double), bool(Bool), object([String: JSONValue]), array([JSONValue]), null
    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .null }
        else if let x = try? c.decode(String.self) { self = .string(x) }
        else if let x = try? c.decode(Bool.self) { self = .bool(x) }
        else if let x = try? c.decode(Double.self) { self = .number(x) }
        else if let x = try? c.decode([String: JSONValue].self) { self = .object(x) }
        else { self = .array(try c.decode([JSONValue].self)) }
    }
    var string: String? { if case .string(let x) = self { return x }; return nil }
    var number: Double? { if case .number(let x) = self { return x }; return nil }
}
func dictionary<T: Encodable>(_ value: T) throws -> [String: Any] {
    try JSONSerialization.jsonObject(with: JSONEncoder().encode(value)) as! [String: Any]
}
final class CloudBridge {
    let container: CKContainer
    let identifier: String
    var temporary: [URL] = []
    init(_ identifier: String) { self.identifier = identifier; container = CKContainer(identifier: identifier) }
    deinit { for url in temporary { try? FileManager.default.removeItem(at: url) } }
    func account() async throws -> String {
        guard try await container.accountStatus() == .available else { throw BridgeError(code: "no-account", message: "请先在系统设置中登录 iCloud，并允许剧好写使用 iCloud") }
        return try await container.userRecordID().recordName
    }
    func database(_ ref: Reference) -> CKDatabase { ref.scope == "private" ? container.privateCloudDatabase : container.sharedCloudDatabase }
    func reference(_ args: [String: JSONValue], _ accountID: String) throws -> Reference {
        guard let value = args["ref"] else { throw BridgeError(code: "invalid", message: "缺少剧本引用") }
        let ref = try JSONDecoder().decode(Reference.self, from: JSONEncoder().encode(value))
        guard ref.container == identifier, ref.zone.hasPrefix("jw-"), ["private", "shared"].contains(ref.scope) else { throw BridgeError(code: "invalid", message: "不支持的 iCloud 剧本") }
        guard ref.accountID == accountID else { throw BridgeError(code: "account-changed", message: "iCloud 账号已切换；此文稿保留在本机，切回原账号后重试") }
        return ref
    }
    func asset(_ base64: String) throws -> CKAsset {
        guard let data = Data(base64Encoded: base64), !data.isEmpty, data.count <= 24_000_000 else { throw BridgeError(code: "invalid", message: "协作数据无效或超过 24 MB，请先导出备份") }
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try data.write(to: url, options: [.atomic]); temporary.append(url)
        return CKAsset(fileURL: url)
    }
    func fetch(_ id: CKRecord.ID, _ db: CKDatabase) async throws -> CKRecord? {
        do { return try await db.record(for: id) }
        catch let error as CKError where error.code == .unknownItem { return nil }
    }
    func share(_ ref: Reference) async throws -> CKShare? {
        try await fetch(CKRecord.ID(recordName: CKRecordNameZoneWideShare, zoneID: ref.zoneID), database(ref)) as? CKShare
    }
    func role(_ ref: Reference) async throws -> String {
        // Scope is verified by CloudKit, never by the role cached in the renderer.
        _ = try await database(ref).recordZone(for: ref.zoneID)
        if ref.scope == "private" { return "owner" }
        guard let s = try await share(ref), let participant = s.currentUserParticipant else { throw BridgeError(code: "permission", message: "共享访问已失效，本地文稿仍保留，可另存副本") }
        guard participant.permission != .none else { throw BridgeError(code: "permission", message: "没有访问此剧本的权限") }
        return participant.permission == .readWrite ? "editor" : "viewer"
    }
    func requireOwner(_ ref: Reference) async throws {
        guard try await role(ref) == "owner" else { throw BridgeError(code: "permission", message: "只有所有者可以管理成员") }
    }
    func immutable(_ ref: Reference, type: String, name: String, data: String, title: String? = nil) async throws {
        guard try await role(ref) != "viewer" else { throw BridgeError(code: "permission", message: "当前权限为只读；本地修改可另存副本") }
        let id = CKRecord.ID(recordName: name, zoneID: ref.zoneID), db = database(ref)
        if try await fetch(id, db) != nil { return }
        let record = CKRecord(recordType: type, recordID: id)
        record["payload"] = try asset(data)
        if let title { record["name"] = String(title.prefix(120)) as CKRecordValue }
        do { _ = try await db.save(record) }
        catch let error as CKError where error.code == .serverRecordChanged {
            // Content-addressed records are identical when another client wins.
            guard name.hasPrefix("u-") else { throw error }
        }
    }
    func pull(_ ref: Reference, token: String?) async throws -> [String: Any] {
        let permission = try await role(ref)
        let previous: CKServerChangeToken?
        if let token, let data = Data(base64Encoded: token) { previous = try NSKeyedUnarchiver.unarchivedObject(ofClass: CKServerChangeToken.self, from: data) } else { previous = nil }
        let config = CKFetchRecordZoneChangesOperation.ZoneConfiguration(); config.previousServerChangeToken = previous
        let op = CKFetchRecordZoneChangesOperation(recordZoneIDs: [ref.zoneID], configurationsByRecordZoneID: [ref.zoneID: config])
        op.fetchAllChanges = true
        var records: [[String: Any]] = [], deleted: [String] = [], finalToken: CKServerChangeToken?, batchError: Error?
        // CloudKit invokes an operation's callbacks serially.
        op.recordWasChangedBlock = { _, result in
            guard case .success(let record) = result else { if case .failure(let error) = result { batchError = error }; return }
            guard let kind = ["JWUpdate": "update", "JWVersion": "version", "JWPresence": "presence"][record.recordType] else { return }
            do {
                let data: Data
                if let asset = record["payload"] as? CKAsset, let url = asset.fileURL { data = try Data(contentsOf: url) }
                else if let inline = record["payload"] as? Data { data = inline }
                else { throw BridgeError(code: "integrity", message: "云端记录缺少内容，请保留本地副本") }
                if data.count > 24_000_000 { throw BridgeError(code: "integrity", message: "云端记录超过安全大小限制") }
                if kind == "update" {
                    let hash = SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
                    guard record.recordID.recordName == "u-" + hash else { throw BridgeError(code: "integrity", message: "云端修改记录校验失败，请保留本地副本") }
                }
                var item: [String: Any] = ["id": record.recordID.recordName, "kind": kind, "data": data.base64EncodedString(), "at": (record.modificationDate ?? Date()).timeIntervalSince1970 * 1000]
                if let name = record["name"] as? String { item["name"] = name }
                if let client = record["clientID"] as? NSNumber { item["clientID"] = client }
                records.append(item)
            } catch { batchError = error }
        }
        op.recordWithIDWasDeletedBlock = { id, _ in deleted.append(id.recordName) }
        op.recordZoneChangeTokensUpdatedBlock = { _, token, _ in finalToken = token }
        op.recordZoneFetchResultBlock = { _, result in
            switch result { case .success(let value): finalToken = value.serverChangeToken; case .failure(let error): batchError = error }
        }
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            op.fetchRecordZoneChangesResultBlock = { result in
                if let error = batchError { continuation.resume(throwing: error) } else { continuation.resume(with: result) }
            }; database(ref).add(op)
        }
        guard let finalToken else { throw BridgeError(code: "retry", message: "iCloud 未返回同步凭据，请重试") }
        return ["records": records, "deleted": deleted, "role": permission, "token": try NSKeyedArchiver.archivedData(withRootObject: finalToken, requiringSecureCoding: true).base64EncodedString()]
    }
    func participant(email: String) async throws -> CKShare.Participant {
        let op = CKFetchShareParticipantsOperation(userIdentityLookupInfos: [CKUserIdentity.LookupInfo(emailAddress: email)])
        var found: CKShare.Participant?
        var participantError: Error?
        op.perShareParticipantResultBlock = { _, result in
            switch result { case .success(let value): found = value; case .failure(let error): participantError = error }
        }
        return try await withCheckedThrowingContinuation { continuation in
            op.fetchShareParticipantsResultBlock = { result in
                if case .failure(let error) = result { continuation.resume(throwing: error) }
                else if let error = participantError { continuation.resume(throwing: error) }
                else if let found { continuation.resume(returning: found) }
                else { continuation.resume(throwing: BridgeError(code: "invalid", message: "未找到此 Apple 账号，请确认对方已启用 iCloud")) }
            }; container.add(op)
        }
    }
    func members(_ s: CKShare) -> [[String: Any]] {
        s.participants.map { p in
            let formatted = p.userIdentity.nameComponents.map { PersonNameComponentsFormatter.localizedString(from: $0, style: .short) } ?? ""
            return ["id": p.userIdentity.userRecordID?.recordName ?? "", "name": formatted.isEmpty ? (p.role == .owner ? "所有者" : "受邀协作者") : formatted, "role": p.role == .owner ? "owner" : p.permission == .readWrite ? "editor" : "viewer", "accepted": p.acceptanceStatus == .accepted]
        }
    }
    func accept(_ url: URL, accountID: String) async throws -> [String: Any] {
        let metadata = try await container.shareMetadata(for: url)
        guard metadata.containerIdentifier == identifier else { throw BridgeError(code: "invalid", message: "此邀请不属于剧好写的 iCloud 容器") }
        _ = try await container.accept(metadata)
        let zone = metadata.share.recordID.zoneID
        var ref = Reference(container: identifier, zone: zone.zoneName, owner: zone.ownerName, scope: "shared", accountID: accountID, role: "viewer")
        ref.role = try await role(ref)
        let project = try await database(ref).record(for: CKRecord.ID(recordName: "project", zoneID: zone))
        return ["ref": try dictionary(ref), "title": project["title"] as? String ?? "共享剧本"]
    }
    func run(_ request: Request) async throws -> Any {
        let args = request.args ?? [:]
        if request.method == "account" {
            let id = try await account(); return ["status": "available", "accountID": id, "container": identifier]
        }
        let accountID = try await account()
        if request.method == "create" {
            guard let projectID = args["projectId"]?.string, UUID(uuidString: projectID) != nil, let data = args["data"]?.string else { throw BridgeError(code: "invalid", message: "缺少初始文稿") }
            let zone = CKRecordZone(zoneName: "jw-" + projectID)
            _ = try await container.privateCloudDatabase.save(zone)
            let ref = Reference(container: identifier, zone: zone.zoneID.zoneName, owner: zone.zoneID.ownerName, scope: "private", accountID: accountID, role: "owner")
            let rootID = CKRecord.ID(recordName: "project", zoneID: zone.zoneID)
            if try await fetch(rootID, container.privateCloudDatabase) == nil {
                let record = CKRecord(recordType: "JWProject", recordID: rootID); record["title"] = (args["title"]?.string ?? "未命名剧本") as CKRecordValue
                _ = try await container.privateCloudDatabase.save(record)
            }
            let bytes = Data(base64Encoded: data) ?? Data()
            let hash = SHA256.hash(data: bytes).map { String(format: "%02x", $0) }.joined()
            try await immutable(ref, type: "JWUpdate", name: "u-" + hash, data: data)
            return try dictionary(ref)
        }
        if request.method == "accept" {
            guard let text = args["url"]?.string, let url = URL(string: text), url.scheme == "https", ["www.icloud.com", "icloud.com", "www.icloud.com.cn", "icloud.com.cn"].contains(url.host ?? ""), url.path.hasPrefix("/share/") else { throw BridgeError(code: "invalid", message: "请输入完整的 iCloud 共享邀请链接") }
            return try await accept(url, accountID: accountID)
        }
        if request.method == "projects" {
            var projects: [[String: Any]] = []
            for scope in ["private", "shared"] {
                let db = scope == "private" ? container.privateCloudDatabase : container.sharedCloudDatabase
                for zone in try await db.allRecordZones() where zone.zoneID.zoneName.hasPrefix("jw-") {
                    guard let root = try await fetch(CKRecord.ID(recordName: "project", zoneID: zone.zoneID), db) else { continue }
                    var ref = Reference(container: identifier, zone: zone.zoneID.zoneName, owner: zone.zoneID.ownerName, scope: scope, accountID: accountID, role: "viewer")
                    ref.role = try await role(ref); projects.append(["title": root["title"] as? String ?? "共享剧本", "ref": try dictionary(ref)])
                }
            }; return projects
        }
        let ref = try reference(args, accountID)
        switch request.method {
        case "pull": return try await pull(ref, token: args["token"]?.string)
        case "push":
            guard let data = args["data"]?.string, let bytes = Data(base64Encoded: data) else { throw BridgeError(code: "invalid", message: "缺少修改内容") }
            let hash = SHA256.hash(data: bytes).map { String(format: "%02x", $0) }.joined()
            try await immutable(ref, type: "JWUpdate", name: "u-" + hash, data: data); return ["saved": true]
        case "version":
            guard let data = args["data"]?.string, let id = args["id"]?.string, UUID(uuidString: id) != nil else { throw BridgeError(code: "invalid", message: "版本参数无效") }
            try await immutable(ref, type: "JWVersion", name: "v-" + id, data: data, title: args["name"]?.string); return ["saved": true]
        case "presence":
            guard try await role(ref) != "viewer" else { return ["saved": false] }
            guard let client = args["clientID"]?.number, let text = args["data"]?.string, let data = Data(base64Encoded: text), data.count <= 16384 else { throw BridgeError(code: "invalid", message: "光标数据无效") }
            // Separate session records prevent two devices from overwriting each other.
            let id = CKRecord.ID(recordName: "p-\(accountID)-\(Int64(client))", zoneID: ref.zoneID), db = database(ref)
            let record: CKRecord
            if let existing = try await fetch(id, db) { record = existing } else { record = CKRecord(recordType: "JWPresence", recordID: id) }
            record["payload"] = data as CKRecordValue; record["clientID"] = NSNumber(value: client)
            _ = try await db.save(record); return ["saved": true]
        case "members":
            guard let s = try await share(ref) else { return ["members": [], "url": ""] }
            return ["members": members(s), "url": s.url?.absoluteString ?? ""]
        case "invite", "permission", "revoke":
            try await requireOwner(ref)
            let s: CKShare
            if let existing = try await share(ref) { s = existing } else { s = CKShare(recordZoneID: ref.zoneID) }
            s.publicPermission = .none
            if request.method == "invite" {
                guard let email = args["email"]?.string, email.contains("@"), email.count <= 254 else { throw BridgeError(code: "invalid", message: "请输入受邀人的 Apple 账号邮箱") }
                let p = try await participant(email: email)
                guard p.userIdentity.userRecordID?.recordName != accountID else { throw BridgeError(code: "invalid", message: "无需邀请自己") }
                p.permission = args["role"]?.string == "editor" ? .readWrite : .readOnly; s.addParticipant(p)
            } else {
                guard let id = args["memberID"]?.string, let p = s.participants.first(where: { $0.userIdentity.userRecordID?.recordName == id }), p.role != .owner else { throw BridgeError(code: "invalid", message: "无法修改此成员") }
                if request.method == "revoke" { s.removeParticipant(p) } else { p.permission = args["role"]?.string == "editor" ? .readWrite : .readOnly }
            }
            let saved = try await container.privateCloudDatabase.save(s) as! CKShare
            return ["members": members(saved), "url": saved.url?.absoluteString ?? ""]
        default: throw BridgeError(code: "invalid", message: "不支持的 iCloud 操作")
        }
    }
}
func errorJSON(_ error: Error) -> [String: Any] {
    if let e = error as? BridgeError { return ["code": e.code, "message": e.message] }
    if let e = error as? CKError {
        let code: String
        switch e.code {
        case .notAuthenticated: code = "no-account"
        case .permissionFailure, .zoneNotFound, .userDeletedZone, .unknownItem: code = "permission"
        case .quotaExceeded: code = "quota"
        case .changeTokenExpired: code = "token-expired"
        case .badContainer, .missingEntitlement, .badDatabase: code = "not-configured"
        default: code = "retry"
        }
        let messages = ["no-account": "请在系统设置中登录 iCloud", "permission": "共享访问已失效；本地文稿仍保留，可打开独立副本", "quota": "iCloud 空间不足，请清理空间或升级容量", "not-configured": "此构建尚未完成 iCloud 容器和签名配置", "token-expired": "同步凭据过期，正在重新核对文稿", "retry": "iCloud 暂不可用，稍后重试"]
        return ["code": code, "message": messages[code]!, "retryAfter": e.retryAfterSeconds ?? 0]
    }
    return ["code": "retry", "message": "iCloud 操作未完成，本地文稿保留，请重试"]
}
@main struct Main {
    static func main() async {
        var output: [String: Any]
        do {
            let input = FileHandle.standardInput.readDataToEndOfFile()
            guard input.count <= 36_000_000 else { throw BridgeError(code: "invalid", message: "请求过大") }
            let request = try JSONDecoder().decode(Request.self, from: input)
            if request.method == "self-test" { output = ["ok": true, "value": ["protocol": 1, "cloudKitLinked": true]] }
            else {
                guard let id = Bundle.main.object(forInfoDictionaryKey: "JWCloudContainer") as? String, id.hasPrefix("iCloud.") else { throw BridgeError(code: "not-configured", message: "尚未配置 iCloud 容器") }
                let bridge = CloudBridge(id)
                output = ["ok": true, "value": try await bridge.run(request)]
            }
        } catch { output = ["ok": false, "error": errorJSON(error)] }
        if let data = try? JSONSerialization.data(withJSONObject: output, options: [.sortedKeys]) { FileHandle.standardOutput.write(data) }
    }
}
