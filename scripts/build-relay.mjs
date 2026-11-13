import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {prepareRelayPython, pythonVersion, pythonSha256} from './prepare-relay-python.mjs';
if(process.platform!=='darwin')process.exit(0);
const base='resources/relay/MuzcastNetwork.app/Contents';
fs.mkdirSync(base+'/MacOS',{recursive:true});
for(const arch of ['arm64','x86_64'])execFileSync('xcrun',['swiftc','-O','-target',arch+'-apple-macos13.0','native/relay/main.swift','-o',base+'/MacOS/relay-'+arch],{stdio:'inherit'});
execFileSync('lipo',['-create',base+'/MacOS/relay-arm64',base+'/MacOS/relay-x86_64','-output',base+'/MacOS/MuzcastNetwork']);
for(const arch of ['arm64','x86_64'])fs.unlinkSync(base+'/MacOS/relay-'+arch);
fs.writeFileSync(base+'/Info.plist',`<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>CFBundleIdentifier</key><string>co.muzcast.setup.network</string><key>CFBundleName</key><string>Muzcast Network</string><key>CFBundleDisplayName</key><string>Muzcast · Connexion TV</string><key>CFBundleExecutable</key><string>MuzcastNetwork</string><key>CFBundlePackageType</key><string>APPL</string><key>CFBundleVersion</key><string>1</string><key>LSMinimumSystemVersion</key><string>13.0</string><key>NSBonjourServices</key><array><string>_adb._tcp</string></array><key>NSLocalNetworkUsageDescription</key><string>Muzcast utilise cette connexion de secours pour communiquer avec votre téléviseur sur votre réseau local.</string></dict></plist>`);
// Build an interpreter into the helper, never depend on Python on the customer's Mac.
const runtime = prepareRelayPython();
const python = runtime.python;
execFileSync(python, ['-m','PyInstaller','--noconfirm','--clean','--onedir',
  '--target-arch','universal2','--name','python-relay','--distpath','.relay-build/dist','--workpath','.relay-build/work',
  '--specpath','.relay-build','native/relay/python/session.py'], {env:runtime.env,stdio:'inherit'});
fs.mkdirSync(base+'/Resources',{recursive:true});
fs.rmSync(base+'/Resources/python-relay',{recursive:true,force:true});
fs.cpSync('.relay-build/dist/python-relay',base+'/Resources/python-relay',{recursive:true,verbatimSymlinks:true});
fs.copyFileSync('native/relay/python/LICENSE',base+'/Resources/CleanMyTV-LICENSE');
fs.writeFileSync(base+'/Resources/python-arch.txt','universal2');
fs.copyFileSync(runtime.license,base+'/Resources/Python-LICENSE.txt');
fs.writeFileSync(base+'/Resources/python-runtime.json',JSON.stringify({version:pythonVersion,source:'https://www.python.org',packageSha256:pythonSha256,architecture:'universal2'},null,2));
execFileSync('codesign',['--force','--deep','--sign',process.env.MUZCAST_NETWORK_SIGN_IDENTITY || process.env.CSC_NAME || '-',path.dirname(base)],{stdio:'inherit'});
