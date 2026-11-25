import fs from 'node:fs/promises';
const skill=await fs.readFile('public/skills/juhaoxie-film-prompts/SKILL.md','utf8');
const licenses=await fs.readFile('public/skills/juhaoxie-film-prompts/THIRD_PARTY_LICENSES.txt','utf8');
await fs.mkdir('src/generated',{recursive:true});
await fs.writeFile('src/generated/prompt-skill.json',JSON.stringify({name:'juhaoxie-film-prompts',version:'1.3.1',skill,licenses},null,2)+'\n');
