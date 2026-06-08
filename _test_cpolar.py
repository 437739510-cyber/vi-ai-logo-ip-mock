import urllib.request

# Try the new cpolar public URL
urls = [
    'http://64912adl.r9.cpolar.cn/',
    'https://64912adl.r9.cpolar.cn/',
    'http://64912adl.r9.cpolar.cn/admin/dashboard',
]
for url in urls:
    try:
        r = urllib.request.urlopen(url, timeout=8)
        print(f'OK {r.status:3d}  {url}')
    except Exception as e:
        print(f'ERR         {url}')
        print(f'   {type(e).__name__}: {e}')
