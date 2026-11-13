// Private, verified universal2 build runtime. Never installs Python on the host.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
export const pythonVersion = '3.14.10';
export const pythonSha256 = '286c7018aa2730f6747ca433dccdc2b31be45f078a9ea0ffa44d5f06368fd2d7';
export function prepareRelayPython() {
  const root = path.resolve('.release-python');
  fs.mkdirSync(root, {recursive:true});
  const pkg = path.join(root,'python.pkg');
  if (!fs.existsSync(pkg)) execFileSync('curl',['--fail','--location','--retry','3',`https://www.python.org/ftp/python/${pythonVersion}/python-${pythonVersion}-macos11.pkg`,'-o',pkg],{stdio:'inherit'});
  if (createHash('sha256').update(fs.readFileSync(pkg)).digest('hex') !== pythonSha256) throw new Error('CPython package checksum mismatch');
  const expanded = path.join(root,'expanded');
  if (!fs.existsSync(expanded)) execFileSync('pkgutil',['--expand-full',pkg,expanded],{stdio:'inherit'});
  const frameworks = path.join(root,'frameworks');
  fs.mkdirSync(frameworks,{recursive:true});
  const framework = path.join(frameworks,'Python.framework');
  if (!fs.existsSync(framework)) fs.symlinkSync('../expanded/Python_Framework.pkg/Payload',framework);
  const home = path.join(framework,'Versions/3.14');
  // PyInstaller sanitizes DYLD variables in child processes. Relocate this private
  // build framework itself; the downloaded package remains intact and hash-verified.
  const relocated = path.join(root,'relocated-3.14.10');
  if (!fs.existsSync(relocated)) {
    const prefix = '/Library/Frameworks/Python.framework/Versions/3.14';
    function walk(dir) {
      for (const entry of fs.readdirSync(dir,{withFileTypes:true})) {
        const file = path.join(dir,entry.name);
        if (entry.isDirectory()) { walk(file); continue; }
        if (!entry.isFile()) continue;
        const fd=fs.openSync(file,'r'); const magic=Buffer.alloc(4); fs.readSync(fd,magic,0,4,0); fs.closeSync(fd);
        if (!['cafebabe','cffaedfe','feedfacf','bebafeca'].includes(magic.toString('hex'))) continue;
        const linked=execFileSync('otool',['-L',file],{encoding:'utf8'});
        const dependencies=[...new Set(linked.split('\n').filter(line=>line.startsWith('\t')).map(line=>line.trim().split(' (')[0]).filter(line=>line.startsWith(prefix+'/') || line.startsWith(home+'/')))];
        for (const dep of dependencies) {
          const target=dep.startsWith(prefix+'/') ? home+dep.slice(prefix.length) : dep;
          execFileSync('install_name_tool',['-change',dep,'@loader_path/'+path.relative(path.dirname(file),target),file]);
        }
        if (dependencies.length) execFileSync('codesign',['--force','--sign','-',file],{stdio:'pipe'});
      }
    }
    walk(home);
    fs.writeFileSync(relocated,'private build framework relocated');
  }
  const env = {...process.env, DYLD_FRAMEWORK_PATH:frameworks, DYLD_LIBRARY_PATH:path.join(home,'lib'), PYTHONHOME:home};
  const python = path.join(root,'venv/bin/python');
  if (!fs.existsSync(python)) execFileSync(path.join(home,'bin/python3.14'),['-m','venv','--without-pip',path.join(root,'venv')],{env,stdio:'inherit'});
  execFileSync(python,['-m','ensurepip','--upgrade'],{env,stdio:'inherit'});
  execFileSync(python,['-m','pip','install','-r','native/relay/requirements-build.txt'],{env,stdio:'inherit'});
  return {python, env, license:path.join(home,'lib/python3.14/LICENSE.txt')};
}
