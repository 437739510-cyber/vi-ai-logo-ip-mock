import urllib.request, ssl, re
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

base = 'https://defensive-clump-bonnet.ngrok-free.dev'
headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}

paths = [
    ('/', 'Client Home'),
    ('/consultation', 'Consultation'),
    ('/confirm', 'Confirm'),
    ('/progress', 'Progress'),
    ('/admin/dashboard', 'Admin Dashboard'),
    ('/admin/projects', 'Projects'),
    ('/admin/favorites', 'Favorites'),
    ('/admin/clients', 'Clients'),
]

for path, name in paths:
    url = base + path
    try:
        req = urllib.request.Request(url, headers=headers)
        r = urllib.request.urlopen(req, timeout=15, context=ctx)
        body = r.read().decode('utf-8', errors='ignore')
        m = re.search(r'<title>(.*?)</title>', body)
        title = m.group(1) if m else 'N/A'
        ok = 'OK' if r.status == 200 else 'ERR'
        size_kb = len(body) / 1024
        print(f'{ok} {r.status:3d}  {name:20s}  {size_kb:5.1f} KB  Title: {title}')
    except Exception as e:
        err = str(type(e).__name__)
        print(f'ERR         {name:20s}  {err}')
