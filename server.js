Last login: Wed Oct  7 09:19:01 on console
peempongpetch@Mac-mini--peem ~ % หห้ ยำำทแื25๑100.112.145.98
zsh: command not found: หห้
peempongpetch@Mac-mini--peem ~ % ssh peemcn25@100.112.145.98
peemcn25@100.112.145.98's password: 
Welcome to Ubuntu 26.04.1 LTS (GNU/Linux 7.0.0-28-generic x86_64)

 * Documentation:  https://docs.ubuntu.com
 * Management:     https://landscape.canonical.com
 * Support:        https://ubuntu.com/pro

 System information as of Wed Oct  7 02:40:23 AM UTC 2026

  System load:             0.03
  Usage of /:              2.5% of 913.32GB
  Memory usage:            20%
  Swap usage:              0%
  Temperature:             39.0 C
  Processes:               424
  Users logged in:         0
  IPv4 address for enp5s0: 192.168.1.93
  IPv6 address for enp5s0: 2001:fb1:c2:7aa8:2e0:4fff:fe3e:783f

 * Canonical Workshop gives developers fast, composable, reproducible, and
   secure developer environments that are perfect for agentic workflows.

   https://ubuntu.com/workshop

Expanded Security Maintenance for Applications is not enabled.

4 updates can be applied immediately.
4 of these updates are standard security updates.
To see these additional updates run: apt list --upgradable

4 additional security updates can be applied with ESM Apps.
Learn more about enabling ESM Apps service at https://ubuntu.com/esm


*** System restart required ***
Last login: Tue Oct  6 18:54:32 2026 from 100.111.181.98
peemcn25@101-server:~$ npm init -y
Wrote to /home/peemcn25/package.json:

{
  "name": "peemcn25",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [],
  "author": "",
  "license": "ISC"
}


peemcn25@101-server:~$ npm install express cors mqtt omise

added 119 packages, and audited 120 packages in 5s

34 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
peemcn25@101-server:~$ สห
สห: command not found
peemcn25@101-server:~$ ls
docker  get-docker.sh  gitea_data  homepage_config  node_modules  package-lock.json  package.json  projects  push-server  test-actions-push
peemcn25@101-server:~$ cd projects
peemcn25@101-server:~/projects$ ls
peemcn25@101-server:~/projects$ ls
peemcn25@101-server:~/projects$ cd
peemcn25@101-server:~$ mkdir tse-backend
peemcn25@101-server:~$ ls
docker  get-docker.sh  gitea_data  homepage_config  node_modules  package-lock.json  package.json  projects  push-server  test-actions-push  tse-backend
peemcn25@101-server:~$ cd tse-backend
peemcn25@101-server:~/tse-backend$ npm init -y
npm install express cors mqtt omise
Wrote to /home/peemcn25/tse-backend/package.json:

{
  "name": "tse-backend",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [],
  "author": "",
  "license": "ISC"
}



added 119 packages, and audited 120 packages in 2s

34 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
peemcn25@101-server:~/tse-backend$ nano server.js
peemcn25@101-server:~/tse-backend$ nano package.json
peemcn25@101-server:~/tse-backend$ npm start

> tse-backend@1.0.0 start
> node server.js

✅ Backend รันแล้วที่พอร์ต 5000
✅ เชื่อมต่อ MQTT Broker สำเร็จ พร้อมสั่งงานตู้ยา!
^C
peemcn25@101-server:~/tse-backend$ npm install -g pm2
npm ERR! code EACCES
npm ERR! syscall rename
npm ERR! path /usr/local/lib/node_modules/pm2
npm ERR! dest /usr/local/lib/node_modules/.pm2-0kfCfexq
npm ERR! errno -13
npm ERR! Error: EACCES: permission denied, rename '/usr/local/lib/node_modules/pm2' -> '/usr/local/lib/node_modules/.pm2-0kfCfexq'
npm ERR!     at async Object.rename (node:internal/fs/promises:781:10)
npm ERR!     at async moveFile (/usr/share/nodejs/@npmcli/fs/lib/move-file.js:30:5)
npm ERR!     at async Promise.allSettled (index 0)
npm ERR!     at async [reifyPackages] (/usr/share/nodejs/@npmcli/arborist/lib/arborist/reify.js:234:11)
npm ERR!     at async Arborist.reify (/usr/share/nodejs/@npmcli/arborist/lib/arborist/reify.js:158:5)
npm ERR!     at async Install.exec (/usr/share/nodejs/npm/lib/commands/install.js:146:5)
npm ERR!     at async module.exports (/usr/share/nodejs/npm/lib/cli.js:133:5)
npm ERR!  Error: EACCES: permission denied, rename '/usr/local/lib/node_modules/pm2' -> '/usr/local/lib/node_modules/.pm2-0kfCfexq'
npm ERR!     at async Object.rename (node:internal/fs/promises:781:10)
npm ERR!     at async moveFile (/usr/share/nodejs/@npmcli/fs/lib/move-file.js:30:5)
npm ERR!     at async Promise.allSettled (index 0)
npm ERR!     at async [reifyPackages] (/usr/share/nodejs/@npmcli/arborist/lib/arborist/reify.js:234:11)
npm ERR!     at async Arborist.reify (/usr/share/nodejs/@npmcli/arborist/lib/arborist/reify.js:158:5)
npm ERR!     at async Install.exec (/usr/share/nodejs/npm/lib/commands/install.js:146:5)
npm ERR!     at async module.exports (/usr/share/nodejs/npm/lib/cli.js:133:5) {
npm ERR!   errno: -13,
npm ERR!   code: 'EACCES',
npm ERR!   syscall: 'rename',
npm ERR!   path: '/usr/local/lib/node_modules/pm2',
npm ERR!   dest: '/usr/local/lib/node_modules/.pm2-0kfCfexq'
npm ERR! }
npm ERR! 
npm ERR! The operation was rejected by your operating system.
npm ERR! It is likely you do not have the permissions to access this file as the current user
npm ERR! 
npm ERR! If you believe this might be a permissions issue, please double-check the
npm ERR! permissions of the file and its containing directories, or try running
npm ERR! the command again as root/Administrator.

npm ERR! A complete log of this run can be found in:
npm ERR!     /home/peemcn25/.npm/_logs/2026-10-07T03_13_03_230Z-debug-0.log
peemcn25@101-server:~/tse-backend$ sudo npm install -g pm2
[sudo: authenticate] Password:       

changed 77 packages in 3s

8 packages are looking for funding
  run `npm fund` for details
peemcn25@101-server:~/tse-backend$ pm2 start server.js --name "tse-backend"
[PM2] Starting /home/peemcn25/tse-backend/server.js in fork_mode (1 instance)
[PM2] Done.
┌────┬────────────────┬─────────────┬─────────┬─────────┬──────────┬────────┬──────┬───────────┬──────────┬──────────┬──────────┬──────────┐
│ id │ name           │ namespace   │ version │ mode    │ pid      │ uptime │ ↺    │ status    │ cpu      │ mem      │ user     │ watching │
├────┼────────────────┼─────────────┼─────────┼─────────┼──────────┼────────┼──────┼───────────┼──────────┼──────────┼──────────┼──────────┤
│ 0  │ push-api       │ default     │ 1.0.0   │ fork    │ 400723   │ 40D    │ 0    │ online    │ 0%       │ 75.2mb   │ peemcn25 │ disabled │
│ 1  │ tse-backend    │ default     │ 1.0.0   │ fork    │ 40627    │ 0s     │ 0    │ online    │ 0%       │ 16.8mb   │ peemcn25 │ disabled │
└────┴────────────────┴─────────────┴─────────┴─────────┴──────────┴────────┴──────┴───────────┴──────────┴──────────┴──────────┴──────────┘
host metrics | cpu: 0.8% | ram usage: 16.2% | enp5s0: ⇓ 0.049mb/s ⇑ 0.006mb/s drop 12/min | tailscale0: ⇓ 0.001mb/s ⇑ 0.001mb/s | disk: ⇓ 0.087mb/s ⇑ 0.31mb/s
peemcn25@101-server:~/tse-backend$ nano server.js
peemcn25@101-server:~/tse-backend$ nano server.js
peemcn25@101-server:~/tse-backend$ 
peemcn25@101-server:~/tse-backend$ sudo pm2 restart tse-backend

                        -------------

__/\\\\\\\\\\\\\____/\\\\____________/\\\\____/\\\\\\\\\_____
 _\/\\\/////////\\\_\/\\\\\\________/\\\\\\__/\\\///////\\\___
  _\/\\\_______\/\\\_\/\\\//\\\____/\\\//\\\_\///______\//\\\__
   _\/\\\\\\\\\\\\\/__\/\\\\///\\\/\\\/_\/\\\___________/\\\/___
    _\/\\\/////////____\/\\\__\///\\\/___\/\\\________/\\\//_____
     _\/\\\_____________\/\\\____\///_____\/\\\_____/\\\//________
      _\/\\\_____________\/\\\_____________\/\\\___/\\\/___________
       _\/\\\_____________\/\\\_____________\/\\\__/\\\\\\\\\\\\\\\_
        _\///______________\///______________\///__\///////////////__


                          Runtime Edition

        PM2 is a Production Process Manager for Node.js applications
                     with a built-in Load Balancer.

                Start and Daemonize any application:
                $ pm2 start app.js

                Load Balance 4 instances of api.js:
                $ pm2 start api.js -i 4

                Monitor in production:
                $ pm2 monitor

                Make pm2 auto-boot at server restart:
                $ pm2 startup

                To go further checkout:
                http://pm2.io/


                        -------------

[PM2] Spawning PM2 daemon with pm2_home=/root/.pm2
[PM2] PM2 Successfully daemonized
Use --update-env to update environment variables
[PM2][ERROR] Process or Namespace tse-backend not found
peemcn25@101-server:~/tse-backend$ pm2 delete tse-backend
[PM2] Applying action deleteProcessId on app [tse-backend](ids: [ 1 ])
[PM2] [tse-backend](1) ✓
┌────┬─────────────┬─────────────┬─────────┬─────────┬──────────┬────────┬──────┬───────────┬──────────┬──────────┬──────────┬──────────┐
│ id │ name        │ namespace   │ version │ mode    │ pid      │ uptime │ ↺    │ status    │ cpu      │ mem      │ user     │ watching │
├────┼─────────────┼─────────────┼─────────┼─────────┼──────────┼────────┼──────┼───────────┼──────────┼──────────┼──────────┼──────────┤
│ 0  │ push-api    │ default     │ 1.0.0   │ fork    │ 400723   │ 40D    │ 0    │ online    │ 0%       │ 77.5mb   │ peemcn25 │ disabled │
└────┴─────────────┴─────────────┴─────────┴─────────┴──────────┴────────┴──────┴───────────┴──────────┴──────────┴──────────┴──────────┘
host metrics | cpu: 0.8% | ram usage: 16.6% | enp5s0: ⇓ 0.007mb/s ⇑ 0.003mb/s drop 12/min | tailscale0: ⇓ 0.002mb/s ⇑ 0.001mb/s | disk: ⇓ 0mb/s ⇑ 0.26mb/s
peemcn25@101-server:~/tse-backend$ sudo pm2 start server.js --name "tse-backend"
[PM2] Starting /home/peemcn25/tse-backend/server.js in fork_mode (1 instance)
[PM2] Done.
┌────┬────────────────┬─────────────┬─────────┬─────────┬──────────┬────────┬──────┬───────────┬──────────┬──────────┬──────────┬──────────┐
│ id │ name           │ namespace   │ version │ mode    │ pid      │ uptime │ ↺    │ status    │ cpu      │ mem      │ user     │ watching │
├────┼────────────────┼─────────────┼─────────┼─────────┼──────────┼────────┼──────┼───────────┼──────────┼──────────┼──────────┼──────────┤
│ 0  │ tse-backend    │ default     │ 1.0.0   │ fork    │ 50545    │ 0s     │ 0    │ online    │ 0%       │ 32.4mb   │ root     │ disabled │
└────┴────────────────┴─────────────┴─────────┴─────────┴──────────┴────────┴──────┴───────────┴──────────┴──────────┴──────────┴──────────┘
host metrics | cpu: 0.7% | ram usage: 16.6% | enp5s0: ⇓ 0.002mb/s ⇑ 0mb/s drop 12/min | disk: ⇓ 0mb/s ⇑ 0.042mb/s
peemcn25@101-server:~/tse-backend$ sudo pm2 logs tse-backend
[TAILING] Tailing last 15 lines for [tse-backend] process (change the value with --lines option)
/root/.pm2/logs/tse-backend-error.log last 15 lines:
/root/.pm2/logs/tse-backend-out.log last 15 lines:
0|tse-back | ✅ Backend รันแล้วที่พอร์ต 80
0|tse-back | ✅ เชื่อมต่อ MQTT Broker สำเร็จ พร้อมสั่งงานตู้ยา!

^C
peemcn25@101-server:~/tse-backend$ sudo ufw allow 80
Rules updated
Rules updated (v6)
peemcn25@101-server:~/tse-backend$ curl ifconfig.me
2001:fb1:c2:7aa8:2e0:4fff:fe3e:783fpeemcn25@101-server:~/tse-backend$ curl -4 ifconfig.me
58.8.175.17peemcn25@101-server:~/tse-backend$ curl http://localhost:80
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Error</title>
</head>
<body>
<pre>Cannot GET /</pre>
</body>
</html>
peemcn25@101-server:~/tse-backend$ curl http://localhost:80
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Error</title>
</head>
<body>
<pre>Cannot GET /</pre>
</body>
</html>
peemcn25@101-server:~/tse-backend$ sudo ufw allow 80/tcp
sudo ufw reload
Rules updated
Rules updated (v6)
Firewall not enabled (skipping reload)
peemcn25@101-server:~/tse-backend$ sudo pm2 logs tse-backend
[TAILING] Tailing last 15 lines for [tse-backend] process (change the value with --lines option)
/root/.pm2/logs/tse-backend-error.log last 15 lines:
/root/.pm2/logs/tse-backend-out.log last 15 lines:
0|tse-back | ✅ Backend รันแล้วที่พอร์ต 80
0|tse-back | ✅ เชื่อมต่อ MQTT Broker สำเร็จ พร้อมสั่งงานตู้ยา!

^C            
peemcn25@101-server:~/tse-backend$ nano server.js
peemcn25@101-server:~/tse-backend$ nano server.js
peemcn25@101-server:~/tse-backend$ sudo pm2 restart tse-backend
Use --update-env to update environment variables
[PM2] Applying action restartProcessId on app [tse-backend](ids: [ 0 ])
[PM2] [tse-backend](0) ✓
┌────┬────────────────┬─────────────┬─────────┬─────────┬──────────┬────────┬──────┬───────────┬──────────┬──────────┬──────────┬──────────┐
│ id │ name           │ namespace   │ version │ mode    │ pid      │ uptime │ ↺    │ status    │ cpu      │ mem      │ user     │ watching │
├────┼────────────────┼─────────────┼─────────┼─────────┼──────────┼────────┼──────┼───────────┼──────────┼──────────┼──────────┼──────────┤
│ 0  │ tse-backend    │ default     │ 1.0.0   │ fork    │ 61193    │ 0s     │ 1    │ online    │ 0%       │ 11.7mb   │ root     │ disabled │
└────┴────────────────┴─────────────┴─────────┴─────────┴──────────┴────────┴──────┴───────────┴──────────┴──────────┴──────────┴──────────┘
host metrics | cpu: 0.6% | ram usage: 16.6% | enp5s0: ⇓ 0.012mb/s ⇑ 0.007mb/s drop 12/min | tailscale0: ⇓ 0.004mb/s ⇑ 0.003mb/s | disk: ⇓ 0.023mb/s ⇑ 0.022mb/s
peemcn25@101-server:~/tse-backend$ sudo pm2 logs tse-backend
[TAILING] Tailing last 15 lines for [tse-backend] process (change the value with --lines option)
/root/.pm2/logs/tse-backend-error.log last 15 lines:
/root/.pm2/logs/tse-backend-out.log last 15 lines:
0|tse-back | ✅ Backend รันแล้วที่พอร์ต 80
0|tse-back | ✅ เชื่อมต่อ MQTT Broker สำเร็จ พร้อมสั่งงานตู้ยา!
0|tse-back | ✅ Backend รันแล้วที่พอร์ต 80
0|tse-back | ✅ เชื่อมต่อ MQTT Broker สำเร็จ พร้อมสั่งงานตู้ยา!

^C
peemcn25@101-server:~/tse-backend$ curl -X POST https://api.peemcn25.dev/api/create-qr
curl: (7) Failed to connect to api.peemcn25.dev port 443 after 85 ms: Could not connect to server
peemcn25@101-server:~/tse-backend$ curl -X POST https://api.peemcn25.dev/api/create-qr
curl: (7) Failed to connect to api.peemcn25.dev port 443 after 3 ms: Could not connect to server
peemcn25@101-server:~/tse-backend$ curl -X POST http://localhost:80/api/create-qr
{"chargeId":"chrg_test_699eih2xtoijpvtx8a8","qrImage":"https://api.omise.co/charges/chrg_test_699eih2xtoijpvtx8a8/documents/docu_test_699eih46xoz73dxpj0k/downloads/7C0E69AED9389BB7"}peemcn25@101-server:~/tse-backennano server.js

  GNU nano 8.7.1                                                                        server.js                                                                                  
const express = require('express');
const cors = require('cors');
const mqtt = require('mqtt'); // โมดูล MQTT
const omise = require('omise')({
    publicKey: 'pkey_test_68yjm1vzidi0j5gejzy',
    secretKey: 'skey_test_68yjsgwrdgq1ortftyk',
    omiseVersion: '2019-05-29'
});

const app = express();
app.use(cors());
app.use(express.json());

// -----------------------------------------------------
// 1. ตั้งค่าการเชื่อมต่อ MQTT
const mqttClient = mqtt.connect('mqtt://broker.hivemq.com'); 
const MQTT_TOPIC = 'tse100/dispense';

mqttClient.on('connect', () => {
    console.log('✅ เชื่อมต่อ MQTT Broker สำเร็จ พร้อมสั่งงานตู้ยา!');
});

mqttClient.on('error', (err) => {
    console.error('❌ MQTT Error:', err);
});
// -----------------------------------------------------

// API สำหรับสร้าง QR Code
app.post('/api/create-qr', async (req, res) => {
    try {
        const source = await omise.sources.create({
            type: 'promptpay',
            amount: 2000, // 20.00 บาท
            currency: 'thb'
        });
        
        const charge = await omise.charges.create({
            amount: 2000,
            currency: 'thb',
            source: source.id,
            return_uri: 'https://tuya.peemcn25.dev' 
        });

        // เช็กให้ชัวร์ว่า Omise มีรูป QR คืนมาให้จริงๆ ถึงค่อยส่งไปหน้าเว็บ
        if (charge.source && charge.source.scannable_code && charge.source.scannable_code.image) {
             res.json({
                 chargeId: charge.id,
                 qrImage: charge.source.scannable_code.image.download_uri
             });
        } else {
             console.log("⚠️ Omise สร้าง QR ช้า กำลังพยายามดึงใหม่...");
             // ทริก: ถ้ายังไม่มา ลองดึง Charge เดิมซ้ำอีกรอบ
             const chargeRetry = await omise.charges.retrieve(charge.id);
             res.json({
                 chargeId: chargeRetry.id,
                 qrImage: chargeRetry.source.scannable_code.image.download_uri
                                                                                 [ Read 82 lines ]
^G Help          ^O Write Out     ^F Where Is      ^K Cut           ^T Execute       ^C Location      M-U Undo         M-A Set Mark     M-] To Bracket   M-B Previous
^X Exit          ^R Read File     ^\ Replace       ^U Paste         ^J Justify       ^/ Go To Line    M-E Redo         M-6 Copy         ^B Where Was     M-F Next
