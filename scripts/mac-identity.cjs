// Give reskinned Electron launchers their own build UUID before code signing.
// Apple TN3178 / TN3179: shared LC_UUID can misattribute local-network permissions.
const {createHash}=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
function patchMachOUuids(input,namespace){
 const data=Buffer.from(input);const offsets=[];
 const slice=(base,end)=>{
  if(base<0||base+32>end||end>data.length||data.readUInt32LE(base)!==0xfeedfacf)throw Error('Unsupported or invalid Mach-O slice');
  const cpu=data.readUInt32LE(base+4),count=data.readUInt32LE(base+16),size=data.readUInt32LE(base+20);
  if(count>10000||base+32+size>end)throw Error('Invalid Mach-O load commands');
  let at=base+32,found=0;
  for(let i=0;i<count;i++){
   if(at+8>base+32+size)throw Error('Truncated Mach-O command');
   const cmd=data.readUInt32LE(at),length=data.readUInt32LE(at+4);
   if(length<8||at+length>base+32+size)throw Error('Invalid Mach-O command size');
   if(cmd===0x1b){
    if(length!==24)throw Error('Invalid LC_UUID');
    const uuid=createHash('sha256').update(namespace+':'+cpu).digest().subarray(0,16);
    uuid[6]=(uuid[6]&15)|0x50;uuid[8]=(uuid[8]&63)|0x80;
    uuid.copy(data,at+8);offsets.push(at+8);found++;
   }
   at+=length;
  }
  if(found!==1)throw Error('Expected exactly one LC_UUID');
 };
 if(data.length<8)throw Error('Truncated Mach-O');
 const magic=data.readUInt32BE(0);
 if(magic===0xcafebabe||magic===0xcafebabf){
  const count=data.readUInt32BE(4),width=magic===0xcafebabf?32:20;
  if(count<1||count>32||8+count*width>data.length)throw Error('Invalid fat Mach-O');
  for(let i=0;i<count;i++){
   const at=8+i*width;
   const start=width===32?Number(data.readBigUInt64BE(at+8)):data.readUInt32BE(at+8);
   const size=width===32?Number(data.readBigUInt64BE(at+16)):data.readUInt32BE(at+12);
   if(!Number.isSafeInteger(start+size))throw Error('Invalid fat Mach-O bounds');
   slice(start,start+size);
  }
 }else slice(0,data.length);
 return {data,offsets};
}
async function afterPack(context){
 if(context.electronPlatformName!=='darwin')return;
 const info=context.packager.appInfo;
 const app=path.join(context.appOutDir,info.productFilename+'.app');
 const binaries=[path.join(app,'Contents','MacOS',context.packager.config.executableName||info.productFilename)];
 const frameworks=path.join(app,'Contents','Frameworks');
 for(const name of fs.readdirSync(frameworks))if(name.endsWith('.app')){
  const dir=path.join(frameworks,name,'Contents','MacOS');
  if(fs.existsSync(dir))for(const executable of fs.readdirSync(dir))binaries.push(path.join(dir,executable));
 }
 for(const file of binaries){
  const ns=`${info.id}:${info.version}:${path.basename(file)}`;
  const {data}=patchMachOUuids(fs.readFileSync(file),ns);fs.writeFileSync(file,data);
 }
 console.log('Assigned app-specific build UUIDs to '+binaries.length+' Electron executables before signing.');
}
module.exports=afterPack;module.exports.patchMachOUuids=patchMachOUuids;
