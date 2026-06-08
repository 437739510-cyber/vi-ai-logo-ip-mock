import pathlib
path = pathlib.Path.home() / '.cpolar' / 'cpolar.yml'
content = path.read_text(encoding='utf-8')
content = content.replace('"3000"', '"3001"')
path.write_text(content, encoding='utf-8')
print('Updated cpolar config to port 3001')
print(content)
