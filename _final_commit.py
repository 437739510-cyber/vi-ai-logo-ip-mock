import os
import subprocess

f = r'C:\Users\Administrator\Documents\Codex\vi-ai-logo-ip-mock\.git\index.lock'
if os.path.exists(f):
    os.remove(f)
    print('removed lock')
else:
    print('no lock found')

# Now commit
subprocess.run(['git', 'commit', '-m', 'complete-all-windows'], cwd=r'C:\Users\Administrator\Documents\Codex\vi-ai-logo-ip-mock')
