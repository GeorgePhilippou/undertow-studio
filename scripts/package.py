"""Package the static site and the bundled HTML edition from the current source."""
from pathlib import Path
import re
import shutil

root = Path(__file__).resolve().parent.parent
styles = ['style.css', 'equipment.css', 'night.css', 'macintosh.css']
modules = ['audio.js', 'studies.js', 'lessons.js', 'beats.js', 'render.js', 'passages.js', 'app.js']
html = (root / 'index.html').read_text()
html = re.sub(r'<link rel="stylesheet"[^>]*>', '', html)
css = '\n'.join((root / name).read_text() for name in styles)
code = []
for name in modules:
    source = (root / name).read_text()
    source = re.sub(r'^import .*?;\n', '', source, flags=re.M)
    code.append(re.sub(r'^export\s+', '', source, flags=re.M))
html = html.replace('</head>', '<style>' + css + '</style></head>')
html, count = re.subn(r'<script type="module" src="\./app\.js(?:\?[^\"]*)?"></script>',
                     lambda _: '<script type="module">\n' + '\n'.join(code) + '\n</script>', html)
if count != 1:
    raise RuntimeError('Expected one app module entrypoint')
(root / 'prototype.html').write_text(html)
dist = root / 'dist'
dist.mkdir(exist_ok=True)
for name in ['index.html', 'icon.svg', 'prototype.html', *styles, *modules]:
    shutil.copy2(root / name, dist / name)
shutil.copytree(root / 'assets', dist / 'assets', dirs_exist_ok=True)
print('Packaged static site and bundled prototype.')
