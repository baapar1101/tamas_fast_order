"""Run on the production host. Back up and validate before reloading Nginx."""
import argparse
import os
import re
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path

CONFIG = Path('/www/server/panel/vhost/nginx/tamasmarket.com.conf')
BACKUPS = Path('/www/wwwroot/tamas_fast_order/apps/api/.private/nginx-backups')
NGINX = '/www/server/nginx/sbin/nginx'
START = '# TAMAS-PRIVATE-UPLOAD-SHIELD-START'
END = '# TAMAS-PRIVATE-UPLOAD-SHIELD-END'

parser = argparse.ArgumentParser()
parser.add_argument('mode', choices=['shield', 'proxy'])
args = parser.parse_args()
original = CONFIG.read_text()
pattern = re.compile(r'    location (?:\^~ )?/uploads/\s*\{[^{}]*\}', re.S)
if len(pattern.findall(original)) != 1:
    raise SystemExit('Expected exactly one uploads location; no configuration changed')

if args.mode == 'shield':
    block = '''    location ^~ /uploads/ {
        rewrite ^/uploads/(certificate|other)/ /private-documents-migration-locked last;
        proxy_pass http://127.0.0.1:3102;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache off;
    }'''
    # During migration the old API must not receive new sensitive uploads.
    shield = f'''    {START}
    location = /private-documents-migration-locked {{ add_header Cache-Control "no-store" always; return 404; }}
    location = /api/uploads {{ add_header Retry-After 60 always; return 503; }}
    location = /api/credit/reports/upload {{ add_header Retry-After 60 always; return 503; }}
    location = /api/admin/uploads {{ add_header Retry-After 60 always; return 503; }}
    {END}
'''
    updated = pattern.sub(shield + block, original)
else:
    updated = re.sub(r'    ' + re.escape(START) + r'.*?' + re.escape(END) + r'\n', '', original, flags=re.S)
    proxy_pattern = re.compile(r'    location (?:\^~ )?/uploads/\s*\{[^{}]*\}', re.S)
    if len(proxy_pattern.findall(updated)) != 1:
        raise SystemExit('Expected exactly one uploads location')
    updated = proxy_pattern.sub('''    location ^~ /uploads/ {
        proxy_pass http://127.0.0.1:3102;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache off;
    }''', updated)

BACKUPS.mkdir(parents=True, exist_ok=True, mode=0o700)
backup = BACKUPS / ('nginx-' + datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S') + '.conf')
shutil.copy2(CONFIG, backup)
os.chmod(backup, 0o600)
CONFIG.write_text(updated)
test = subprocess.run([NGINX, '-t'], capture_output=True, text=True)
if test.returncode:
    CONFIG.write_text(original)
    raise SystemExit('Nginx validation failed; original configuration restored: ' + test.stderr)
subprocess.run([NGINX, '-s', 'reload'], check=True)
print({'mode': args.mode, 'backup': str(backup), 'validated': True})
