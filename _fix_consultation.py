with open(r'C:\Users\Administrator\Documents\Codex\vi-ai-logo-ip-mock\src\components\client\ConsultationForm.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: Remove preview object build
old_block = (
    '  // Build UploadedFile-like preview data from actual File objects\n'
    '  const logoPreview = logoFileList.map((f) => ({ name: f.name, size: f.size }));\n'
    '  const mascotPreview = mascotFileList.map((f, i) => ({\n'
    '    name: f.name,\n'
    '    size: f.size,\n'
    '    name_value: mascotNames[i] || "",\n'
    '    personality_value: mascotPersonalities[i] || "",\n'
    '  }));\n'
    '  const referencePreview = referenceFileList.length > 0\n'
    '    ? { name: referenceFileList[0].name, size: referenceFileList[0].size }\n'
    '    : null;'
)
new_block = '  // Uploaded file previews are derived from File[] state directly in component renders'
content = content.replace(old_block, new_block)

# Fix 2: Pass File arrays directly
content = content.replace(
    '          <LogoUploadArea\n            files={logoPreview}',
    '          <LogoUploadArea\n            files={logoFileList}'
)
content = content.replace(
    '            file={referencePreview}',
    '            file={referenceFileList[0] || null}'
)

with open(r'C:\Users\Administrator\Documents\Codex\vi-ai-logo-ip-mock\src\components\client\ConsultationForm.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('All fixes applied')
