"""Minimal Linux build toolchain. Runtime SDK/JRE never enter Git or the APK."""
import pathlib,subprocess,json,base64,hashlib,os
ROOT=pathlib.Path(__file__).resolve().parents[1];DEST=ROOT/'.local/android';DEST.mkdir(parents=True,exist_ok=True)
subprocess.run(['python3','-m','pip','install','--target',str(DEST/'python'),'jdk4py==21.0.8.2'],check=True)
blobs=[('android.jar','Sable/android-platforms','2d6652edf0fb6046a23638f3a2f2c6246c745b08'),('r8.jar','yaap/prebuilts_r8','ad478158d083e3f36967aac17229475bda01f3c1')]
for name,repo,sha in blobs:
 path=DEST/name
 if path.exists() and hashlib.sha1(b'blob '+str(path.stat().st_size).encode()+b'\0'+path.read_bytes()).hexdigest()==sha:continue
 d=json.loads(subprocess.check_output(['gh','api',f'repos/{repo}/git/blobs/{sha}']));data=base64.b64decode(d['content'])
 if hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()!=sha:raise RuntimeError('Git blob integrity mismatch: '+name)
 path.write_bytes(data)
path=ROOT/'node_modules/aaptjs3/bin/x64/linux/aapt2';path.chmod(path.stat().st_mode|0o111)
print('Android toolchain ready in .local/android (ignored by Git).')
