import subprocess, os
os.chdir(r'C:\Users\Administrator\Documents\Codex\vi-ai-logo-ip-mock')
subprocess.run(['git', 'add', '-A'])
subprocess.run(['git', 'commit', '-m', 'cleanup'])
