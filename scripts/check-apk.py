"""Check signature, manifest, offline assets, compression, alignment, and checksum."""
import hashlib
import json
import pathlib
import re
import subprocess
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
package_json = json.loads((ROOT / 'package.json').read_text())
version = package_json['version']
manifest_xml = (ROOT / 'android/app/src/main/AndroidManifest.xml').read_text()
android_version = re.search(r'android:versionCode="(\d+)" android:versionName="([^"]+)"', manifest_xml)
assert android_version and android_version.group(2) == version, (version, manifest_xml)
apk = ROOT / 'downloads' / f'Zabroshka-{version}.apk'
java = ROOT / '.local/android/python/jdk4py/java-runtime/bin/java'
signer = ROOT / 'node_modules/@postar/apktool-node/lib/apksigner.jar'
aapt = ROOT / 'node_modules/aaptjs3/bin/x64/linux/aapt2'
verification = subprocess.check_output([str(java), '-jar', str(signer), 'verify', '--verbose', '--print-certs', str(apk)], text=True)
print(verification)
assert 'Verified using v2 scheme (APK Signature Scheme v2): true' in verification
badging = subprocess.check_output([str(aapt), 'dump', 'badging', str(apk)], text=True)
permissions = subprocess.check_output([str(aapt), 'dump', 'permissions', str(apk)], text=True)
manifest = subprocess.check_output([str(aapt), 'dump', 'xmltree', str(apk), '--file', 'AndroidManifest.xml'], text=True)
assert "name='io.github.vpn86156.zabroshka'" in badging, badging
expected_code = android_version.group(1)
assert f"versionCode='{expected_code}'" in badging and f"versionName='{version}'" in badging, badging
assert "minSdkVersion:'26'" in badging and "targetSdkVersion:'35'" in badging
assert 'uses-permission' not in permissions, permissions
assert re.search(r'screenOrientation\(0x[0-9a-f]+\)=6\b', manifest), manifest  # sensorLandscape
with zipfile.ZipFile(apk) as archive:
    assert archive.testzip() is None
    names = set(archive.namelist())
    for required in ['classes.dex', 'assets/index.html', 'assets/audio/manifest.json',
                     'assets/fonts/manrope-cyrillic-400-normal.woff2',
                     'assets/fonts/russo-one-cyrillic-400-normal.woff2',
                     'assets/licenses/Manrope-OFL.txt', 'assets/licenses/Russo-One-OFL.txt']:
        assert required in names, required
    # The game must ship its own sounds and music — that is most of the download size.
    assert sum(1 for name in names if name.startswith('assets/audio/sfx/')) >= 60, len(names)
    assert sum(1 for name in names if name.startswith('assets/audio/music/')) >= 8, len(names)
    # The signed APK must contain the exact production bundle that was tested.
    dist = ROOT / 'dist'
    for file in dist.rglob('*'):
        if file.is_file():
            entry = 'assets/' + file.relative_to(dist).as_posix()
            assert entry in names and archive.read(entry) == file.read_bytes(), entry
    assert not any('.android-signing' in name or name.endswith('.p12') for name in names)
    resource = archive.getinfo('resources.arsc')
    assert resource.compress_type == zipfile.ZIP_STORED
    with apk.open('rb') as file:
        file.seek(resource.header_offset + 26)
        name_length = int.from_bytes(file.read(2), 'little')
        extra_length = int.from_bytes(file.read(2), 'little')
    assert (resource.header_offset + 30 + name_length + extra_length) % 4 == 0
    html = archive.read('assets/index.html').decode()
    assert "connect-src 'self'" in html
digest = hashlib.sha256()
with apk.open('rb') as file:
    for chunk in iter(lambda: file.read(1024 * 1024), b''):
        digest.update(chunk)
sha = digest.hexdigest()
assert (ROOT / 'downloads/SHA256SUMS.txt').read_text().split()[0] == sha
print('\nManifest and archive checks passed. No permissions; landscape; offline assets; aligned resources.')
print('SHA-256:', sha)
