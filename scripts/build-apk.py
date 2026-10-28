"""Compile and sign the self-contained game APK with aapt2, javac, D8 and apksigner."""
import hashlib
import json
import os
import pathlib
import shutil
import struct
import subprocess
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
TOOLS = ROOT / '.local/android'
OUT = ROOT / 'build/native'
DOWNLOADS = ROOT / 'downloads'
JAVA = TOOLS / 'python/jdk4py/java-runtime/bin/java'
PLATFORM = TOOLS / 'android.jar'
AAPT = ROOT / 'node_modules/aaptjs3/bin/x64/linux/aapt2'
JAVAC = ROOT / 'node_modules/dataslope-tools-jar/tools.jar'
SIGNER = ROOT / 'node_modules/@postar/apktool-node/lib/apksigner.jar'
R8 = TOOLS / 'r8.jar'
SOURCE = ROOT / 'android/app/src/main'
KEY = pathlib.Path(os.environ.get('KOSMO_KEYSTORE', str(ROOT / '.android-signing/kosmopilot.p12')))
PASSWORD = pathlib.Path(os.environ.get('KOSMO_KEYPASS_FILE', str(ROOT / '.android-signing/password.txt')))
ALIAS = os.environ.get('KOSMO_KEY_ALIAS', 'kosmopilot')

def run(*args):
    subprocess.run([str(arg) for arg in args], check=True, cwd=ROOT)

for path in [JAVA, PLATFORM, AAPT, JAVAC, SIGNER, R8]:
    if not path.exists():
        raise SystemExit(f'Missing {path}. Run npm install and npm run setup:android.')
if not (ROOT / 'dist/index.html').exists():
    raise SystemExit('Build the game assets first with npm run build:web.')
if not KEY.exists() or not PASSWORD.exists():
    raise SystemExit('The signing key is missing. Restore it, or run npm run setup:signing for the first build only.')
AAPT.chmod(AAPT.stat().st_mode | 0o111)
shutil.rmtree(OUT, ignore_errors=True)
(OUT / 'classes').mkdir(parents=True)
(OUT / 'dex').mkdir()
DOWNLOADS.mkdir(exist_ok=True)

run(AAPT, 'compile', '--dir', SOURCE / 'res', '-o', OUT / 'resources.zip')
run(AAPT, 'link', '-I', PLATFORM, '--manifest', SOURCE / 'AndroidManifest.xml',
    '--min-sdk-version', '26', '--target-sdk-version', '35', '-A', ROOT / 'dist',
    OUT / 'resources.zip', '-o', OUT / 'resource.apk')
java_sources = sorted(SOURCE.glob('java/**/*.java'))
run(JAVA, '-cp', JAVAC, 'com.sun.tools.javac.Main', '-source', '8', '-target', '8',
    '-encoding', 'UTF-8', '-g:none', '-bootclasspath', PLATFORM, '-d', OUT / 'classes', *java_sources)
classes = sorted((OUT / 'classes').rglob('*.class'))
run(JAVA, '-cp', R8, 'com.android.tools.r8.D8', '--release', '--min-api', '26', '--lib', PLATFORM,
    '--output', OUT / 'dex', *classes)

# A fixed timestamp keeps the archive byte-for-byte reproducible, so a published
# checksum always matches a rebuild from the same sources.
ZIP_DATE = (1980, 1, 1, 0, 0, 0)

# Align stored entries to four bytes before signing. resources.arsc must remain uncompressed.
unsigned = OUT / 'unsigned-aligned.apk'
with zipfile.ZipFile(OUT / 'resource.apk') as src, zipfile.ZipFile(unsigned, 'w') as dst:
    for old in src.infolist():
        info = zipfile.ZipInfo(old.filename, ZIP_DATE)
        info.compress_type = old.compress_type
        info.external_attr = old.external_attr
        if info.compress_type == zipfile.ZIP_STORED:
            offset = dst.fp.tell() + 30 + len(info.filename.encode('utf-8'))
            if offset % 4:
                padding = (-offset - 4) % 4
                info.extra = struct.pack('<HH', 0xd935, padding) + b'\0' * padding
        dst.writestr(info, src.read(old))
    for dex in sorted((OUT / 'dex').glob('*.dex')):
        info = zipfile.ZipInfo(dex.name, ZIP_DATE)
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        dst.writestr(info, dex.read_bytes())

version = json.loads((ROOT / 'package.json').read_text())['version']
apk = DOWNLOADS / f'Kosmopilot-{version}.apk'
run(JAVA, '-jar', SIGNER, 'sign', '--ks', KEY, '--ks-key-alias', ALIAS,
    '--ks-pass', 'file:' + str(PASSWORD), '--v1-signing-enabled', 'true',
    '--v2-signing-enabled', 'true', '--v4-signing-enabled', 'false', '--out', apk, unsigned)
run(JAVA, '-jar', SIGNER, 'verify', '--verbose', '--print-certs', apk)
digest = hashlib.sha256()
with apk.open('rb') as file:
    for chunk in iter(lambda: file.read(1024 * 1024), b''):
        digest.update(chunk)
sha = digest.hexdigest()
(DOWNLOADS / 'SHA256SUMS.txt').write_text(f'{sha}  {apk.name}\n')
print(f'Signed APK: {apk.relative_to(ROOT)} ({apk.stat().st_size:,} bytes, SHA-256 {sha})')
