import { build } from 'esbuild';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
const b=await build({entryPoints:['.tmp/delivery-ui/preview.tsx'],bundle:true,write:false,outdir:'.tmp/delivery-ui/bundle',format:'esm',jsx:'automatic',jsxImportSource:'react',target:'es2022',loader:{'.woff2':'dataurl'},define:{'process.env.NODE_ENV':'"development"'},tsconfig:'tsconfig.json'});
const js=b.outputFiles.find(f=>f.path.endsWith('.js')).text,css=b.outputFiles.find(f=>f.path.endsWith('.css')).text;
createServer((req,res)=>{let data,type;if(req.url==='/preview.js'){data=js;type='text/javascript';}else if(req.url==='/preview.css'){data=css;type='text/css';}else{data='<!doctype html><html data-theme="blue"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/preview.css"><title>Delivery UAT fixture</title></head><body><div id="app"></div><script type="module" src="/preview.js"></script></body></html>';type='text/html';}res.writeHead(200,{'content-type':type});res.end(data)}).listen(4179,'127.0.0.1',()=>console.log('Synthetic Delivery preview on 4179'));
