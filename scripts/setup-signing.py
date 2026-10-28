"""Create a new private signing key once. Never commit it or silently replace it."""
import os
import pathlib
import secrets
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[1]
java = ROOT / '.local/android/python/jdk4py/java-runtime/bin'
key = ROOT / '.android-signing/kosmopilot.p12'
password = ROOT / '.android-signing/password.txt'
if key.exists() or password.exists():
    if key.exists() and password.exists():
        raise SystemExit('Signing key already exists; it will not be replaced. Back it up securely.')
    raise SystemExit('Signing files are incomplete. Restore the original key instead of replacing it.')
if not (java / 'keytool').exists():
    raise SystemExit('Run npm run setup:android first.')
key.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
fd = os.open(password, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(fd, 'w') as file:
    file.write(secrets.token_urlsafe(32))
try:
    subprocess.run([
        str(java / 'keytool'), '-genkeypair', '-noprompt', '-alias', 'kosmopilot',
        '-keystore', str(key), '-storetype', 'PKCS12', '-storepass:file', str(password),
        '-keyalg', 'RSA', '-keysize', '3072', '-sigalg', 'SHA256withRSA',
        '-validity', '10000', '-dname', 'CN=Kosmopilot Android',
    ], check=True)
    key.chmod(0o600)
except Exception:
    key.unlink(missing_ok=True)
    password.unlink(missing_ok=True)
    raise
print('Created a new private signing key in .android-signing. Back up both files securely; never commit them.')
