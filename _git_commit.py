import subprocess
import os

os.chdir(r'D:\Projects\vi-ai-logo-ip-mock')

# Add all files
result = subprocess.run(['git', 'add', '-A'], capture_output=True, text=True)
print('git add:', result.stdout, result.stderr)

# Commit
result = subprocess.run(['git', 'commit', '-m', 'Window A complete - client pages'], capture_output=True, text=True)
print('git commit:', result.stdout, result.stderr)
print('Return code:', result.returncode)
