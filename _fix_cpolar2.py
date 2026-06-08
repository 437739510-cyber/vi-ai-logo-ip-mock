import pathlib
p = pathlib.Path.home() / '.cpolar' / 'cpolar.yml'
c = p.read_text(encoding='utf-8')
c = c.replace('"3000"', '"3001"')
p.write_text(c, encoding='utf-8')
print('Config updated: 3000 -> 3001')
print(c)
