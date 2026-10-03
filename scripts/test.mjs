import {spawnSync} from 'node:child_process';
for(const name of ['live-session','fixed-sheet','verify','live-camera','lightning-camera','iphone-startup','embed-policy']){
 const result=spawnSync(process.execPath,[`tests/${name}.mjs`],{stdio:'inherit'});
 if(result.status!==0)process.exit(result.status||1);
}
