import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
const root=process.cwd();
const server=await createServer({configFile:false,root,plugins:[react()],envFile:false,resolve:{alias:[{find:/.*utils\/socketio$/,replacement:path.join(root,'output/tutorial-chamados-timo/socket-stub.js')}]},server:{host:'127.0.0.1',port:5178,strictPort:true}});
await server.listen(); console.log('Local demonstration studio: http://127.0.0.1:5178/output/tutorial-chamados-timo/index.html');
