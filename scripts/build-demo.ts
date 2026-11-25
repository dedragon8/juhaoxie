import fs from 'node:fs/promises';
import {welcomeDemo} from '../src/core/welcome-demo';
import {encodeDrg} from '../src/core/drg';
await fs.mkdir('artifacts',{recursive:true});
await fs.writeFile('artifacts/落水狗-节选演示.jhwrite',await encodeDrg(welcomeDemo(),{documentId:'juhaoxie-welcome-demo-v1',protected:false}));
