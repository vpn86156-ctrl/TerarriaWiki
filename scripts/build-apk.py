"""Build/sign a sideloadable Android APK using aapt2, javac, D8 and official apksigner."""
import pathlib,subprocess,zipfile,shutil,os,hashlib,json,struct
ROOT=pathlib.Path(__file__).resolve().parents[1];TOOLS=ROOT/'.local/android';OUT=ROOT/'build/native';ART=ROOT/'artifacts';JAVA=TOOLS/'python/jdk4py/java-runtime/bin/java';KEYTOOL=JAVA.with_name('keytool')
AAPT=ROOT/'node_modules/aaptjs3/bin/x64/linux/aapt2';JAVAC=ROOT/'node_modules/dataslope-tools-jar/tools.jar';SIGNER=ROOT/'node_modules/@postar/apktool-node/lib/apksigner.jar';PLATFORM=TOOLS/'android.jar'
def run(*args):subprocess.run([str(a)for a in args],check=True,cwd=ROOT)
if not JAVA.exists()or not PLATFORM.exists():raise SystemExit('Run npm run setup:android first.')
shutil.rmtree(OUT,ignore_errors=True);OUT.mkdir(parents=True);ART.mkdir(exist_ok=True)
classes=OUT/'classes';classes.mkdir();dex=OUT/'dex';dex.mkdir();source=ROOT/'android/app/src/main';res=OUT/'res';shutil.copytree(source/'res',res);(res/'mipmap-hdpi').mkdir(exist_ok=True);shutil.copy(ROOT/'public/icons/icon-192.png',res/'mipmap-hdpi/ic_launcher.png')
preview=os.environ.get('TERRA_DESIGN_PREVIEW')=='1'
manifest=source/'AndroidManifest.xml'
if preview:
 text=manifest.read_text().replace('package="io.github.vpn86156.terraletopis"','package="io.github.vpn86156.terraletopis.design"').replace('android:name=".MainActivity"','android:name="io.github.vpn86156.terraletopis.MainActivity"').replace('android:label="TERRA Летопись"','android:label="TERRA Дизайн"')
 manifest=OUT/'AndroidManifest.xml';manifest.write_text(text)
run(AAPT,'compile' ,'--dir',res,'-o',OUT/'resources.zip')
run(AAPT,'link','-I',PLATFORM,'--manifest',manifest,'--min-sdk-version','26','--target-sdk-version','35','-A',ROOT/'build/ui',OUT/'resources.zip','-o',OUT/'resource.apk')
run(JAVA,'-cp',JAVAC,'com.sun.tools.javac.Main','-source','8','-target','8','-encoding','UTF-8','-g:none','-bootclasspath',PLATFORM,'-d',classes,*source.glob('java/**/*.java'))
run(JAVA,'-cp',TOOLS/'r8.jar','com.android.tools.r8.D8','--release','--min-api','26','--lib',PLATFORM,'--output',dex,*classes.rglob('*.class'))
# Align stored entries to four bytes before signing, preserving aapt2's resource table rules.
unsigned=OUT/'unsigned-aligned.apk'
with zipfile.ZipFile(OUT/'resource.apk')as src,zipfile.ZipFile(unsigned,'w')as dst:
 for old in src.infolist():
  info=zipfile.ZipInfo(old.filename,old.date_time);info.compress_type=old.compress_type;info.external_attr=old.external_attr
  if info.compress_type==zipfile.ZIP_STORED:
   offset=dst.fp.tell()+30+len(info.filename.encode('utf8'))
   if offset%4:
    n=(-offset-4)%4;info.extra=struct.pack('<HH',0xd935,n)+b'\0'*n
  dst.writestr(info,src.read(old))
 for file in dex.glob('*.dex'):dst.write(file,file.name,compress_type=zipfile.ZIP_DEFLATED)
# Only the separate preview may create a key. Never silently replace the release identity.
key=pathlib.Path(os.environ.get('TERRA_KEYSTORE',str(ROOT/('.android-signing/design-preview.p12' if preview else '.android-signing/terra.p12'))));password=pathlib.Path(os.environ.get('TERRA_KEYPASS_FILE',str(ROOT/('.android-signing/design-preview-password.txt' if preview else '.android-signing/password.txt'))))
if not key.exists():
 if os.environ.get('TERRA_KEYSTORE'):raise SystemExit('Specified keystore does not exist.')
 if not preview:raise SystemExit('Release signing key is missing. Use npm run build:design for a safe side-by-side APK, or supply the retained release key via TERRA_KEYSTORE and TERRA_KEYPASS_FILE. Never replace the installed app using an unrelated key.')
 import secrets
 key.parent.mkdir(parents=True,exist_ok=True);password.write_text(secrets.token_urlsafe(32));password.chmod(0o600)
 run(KEYTOOL,'-genkeypair','-keystore',key,'-storepass:file',password,'-keypass:file',password,'-alias','terra','-keyalg','RSA','-keysize','3072','-validity','10000','-dname','CN=TERRA Letopis, OU=Independent Fan Companion')
 key.chmod(0o600)
version=json.loads((ROOT/'package.json').read_text())['version']
apk=ART/f'TERRA-Letopis-{"Design-" if preview else ""}{version}.apk'
run(JAVA,'-jar',SIGNER,'sign','--ks',key,'--ks-key-alias','terra','--ks-pass','file:'+str(password),'--v1-signing-enabled','true','--v2-signing-enabled','true','--out',apk,unsigned)
run(JAVA,'-jar',SIGNER,'verify','--verbose','--print-certs',apk)
report=subprocess.check_output([str(AAPT),'dump','badging',str(apk)],text=True,stderr=subprocess.STDOUT);(ART/'apk-info.txt').write_text(report)
with zipfile.ZipFile(apk)as z:
 assert z.testzip()is None
 assert 'classes.dex'in z.namelist()and'assets/index.html'in z.namelist()
 with apk.open('rb')as f:sha=hashlib.file_digest(f,'sha256').hexdigest()
(ART/'SHA256SUMS.txt').write_text(sha+'  '+apk.name+'\n')
print('Verified signed APK:',apk,'bytes:',apk.stat().st_size)
