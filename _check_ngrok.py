import urllib.request, ssl, re
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

# 1. Check local
r = urllib.request.urlopen('http://localhost:3001/', timeout=5)
body = r.read().decode('utf-8', errors='ignore')
m = re.search(r'<title>(.*?)</title>', body)
print('Local port 3001:', r.status)
print('Title:', m.group(1) if m else 'N/A')

# 2. Check ngrok tunnel
r2 = urllib.request.urlopen('https://defensive-clump-bonnet.ngrok-free.dev/', timeout=10, context=ctx)
body2 = r2.read().decode('utf-8', errors='ignore')
m2 = re.search(r'<title>(.*?)</title>', body2)
print()
print('Ngrok URL:', r2.status)
print('Title:', m2.group(1) if m2 else 'N/A')
print('Size:', len(body2), 'bytes')
print('First 150 chars:', body2[:150])
