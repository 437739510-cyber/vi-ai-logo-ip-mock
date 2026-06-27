import zipfile, xml.etree.ElementTree as ET, sys
fn = sys.argv[1] if len(sys.argv) > 1 else 'D:\disk\HermesDisk\brand_brain\PPTX\new.pptx'
z = zipfile.ZipFile(fn)
ns = {'a': 'http://schemas.openxmlformats.org/drawingml/2006/main', 'p': 'http://schemas.openxmlformats.org/presentationml/2006/main'}
for i in range(1, 18):
    sfn = 'ppt/slides/slide%d.xml' % i
    if sfn not in z.namelist():
        continue
    root = ET.parse(z.open(sfn)).getroot()
    for sp in root.findall('.//p:sp', ns):
        texts = []
        for t in sp.iter('{http://schemas.openxmlformats.org/drawingml/2006/main}t'):
            if t.text:
                texts.append(t.text)
        full = ' '.join(texts).strip()
        if not full:
            continue
        xfrm = sp.find('.//a:xfrm', ns)
        if xfrm is None:
            continue
        ext = xfrm.find('a:ext', ns)
        if ext is None:
            continue
        w = int(ext.get('cx', 0))
        h = int(ext.get('cy', 0))
        szs = []
        for rp in sp.iter('{http://schemas.openxmlformats.org/drawingml/2006/main}rPr'):
            s = rp.get('sz')
            if s:
                szs.append(int(s))
        avg = (sum(szs) / len(szs)) if szs else 1200
        chars_per_line = w / (avg * 50) if avg else 80
        needed = len(full) / chars_per_line if chars_per_line else 999
        max_lines = h / (avg * 1.5 * 100) if avg else 999
        if needed > max_lines * 1.1 and len(full) > 30:
            print('Slide %d: OVERFLOW - text=%dch box=%.1fx%.1f font=%.1fpt needs=%.0fln fits=%.0fln' % (
                i, len(full), w/914400, h/914400, avg/100, needed, max_lines))
z.close()
