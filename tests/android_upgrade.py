"""Verifica sui due APK reali i requisiti per l'upgrade della Suite."""
import re
import subprocess
import sys

signer, aapt, old, new = sys.argv[1:]

def certificate(apk):
    result = subprocess.check_output([signer, 'verify', '--print-certs', apk], text=True)
    # I tool recenti riportano il range SDK al posto del vecchio prefisso #1.
    digests = re.findall(r'certificate SHA-256 digest:\s*([0-9a-fA-F]{64})', result)
    assert digests, f'Certificato APK non trovato:\n{result}'
    return {digest.lower() for digest in digests}

def identity(apk):
    result = subprocess.check_output([aapt, 'dump', 'badging', apk], text=True)
    match = re.search(r"package: name='([^']+)' versionCode='(\d+)'", result)
    assert match, 'Identità APK non trovata'
    return match.group(1), int(match.group(2))

before, after = identity(old), identity(new)
assert before[0] == after[0] == 'it.daprod.suite', 'Il package ID deve restare invariato'
assert after[1] > before[1], 'Il versionCode deve aumentare'
assert certificate(old) == certificate(new), 'Il certificato deve essere compatibile'
print(f'OK upgrade APK: {before[0]}, versionCode {before[1]} -> {after[1]}, stesso certificato verificato.')
