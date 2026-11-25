// Run using the bundled Electron executable with ELECTRON_RUN_AS_NODE=1.
const net=require('node:net'),fs=require('node:fs');
let socket;
try{const config=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));if(typeof config.socket!=='string'||typeof config.token!=='string')throw Error('无效连接配置');socket=net.createConnection(config.socket,()=>{socket.write(JSON.stringify({auth:config.token})+'\n');process.stdin.pipe(socket);socket.pipe(process.stdout)})}
catch{process.stderr.write('请打开剧好写，在设置 → 接入 Agent 中开启全局接入。\n');process.exit(1)}
socket.on('error',()=>{process.stderr.write('剧好写连接已关闭，请重新启用 AI 接入并重连。\n');process.exit(1)});
socket.on('close',()=>process.exit(0));process.stdin.on('end',()=>socket.end());
