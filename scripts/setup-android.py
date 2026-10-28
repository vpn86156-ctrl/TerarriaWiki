"""Download a small, pinned Android build toolchain into the ignored .local directory."""
import base64
import hashlib
import json
import pathlib
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[1]
DEST = ROOT / '.local/android'
DEST.mkdir(parents=True, exist_ok=True)
java = DEST / 'python/jdk4py/java-runtime/bin/java'
if not java.exists():
    subprocess.run(['python3', '-m', 'pip', 'install', '--disable-pip-version-check', '--target', str(DEST / 'python'), 'jdk4py==21.0.8.2'], check=True)

for name, repo, sha in [
    ('android.jar', 'Sable/android-platforms', '2d6652edf0fb6046a23638f3a2f2c6246c745b08'),
    ('r8.jar', 'yaap/prebuilts_r8', 'ad478158d083e3f36967aac17229475bda01f3c1'),
]:
    path = DEST / name
    def blob_hash(data):
        return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
    if path.exists() and blob_hash(path.read_bytes()) == sha:
        continue
    print('Downloading', name, flush=True)
    result = json.loads(subprocess.check_output(['gh', 'api', f'repos/{repo}/git/blobs/{sha}']))
    data = base64.b64decode(result['content'])
    if blob_hash(data) != sha:
        raise SystemExit('Integrity check failed for ' + name)
    path.write_bytes(data)
print('Android toolchain is ready in .local/android.')
