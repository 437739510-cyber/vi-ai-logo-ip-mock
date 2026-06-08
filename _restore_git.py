import os, subprocess

base = r'C:\Users\Administrator\Documents\Codex\vi-ai-logo-ip-mock'

# Files that need to be restored (corrupted by add_file)
files_to_restore = [
    'src/components/client/HeroSection.tsx',
    'src/components/client/ProcessSection.tsx',
    'src/components/client/AdvantageCards.tsx',
    'src/components/client/CaseCarousel.tsx',
    'src/components/client/FaqSection.tsx',
    'src/components/shared/ClientLayout.tsx',
    'src/components/shared/AdminLayout.tsx',
    'src/components/admin/StatCard.tsx',
    'src/components/admin/PlanCard.tsx',
]

# Try to restore from git
for relpath in files_to_restore:
    abspath = os.path.join(base, relpath)
    try:
        result = subprocess.run(
            ['git', 'show', 'HEAD:' + relpath.replace('\\', '/')],
            capture_output=True, timeout=10,
            cwd=base
        )
        if result.returncode == 0:
            with open(abspath, 'wb') as f:
                f.write(result.stdout)
            print(f'Restored: {relpath}')
        else:
            print(f'Failed to restore {relpath}: {result.stderr.decode()}')
    except Exception as e:
        print(f'Error restoring {relpath}: {e}')

print('Done restoring original files')
