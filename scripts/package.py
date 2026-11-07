"""Copy the static site into dist/ for GitHub Pages.

The site is plain HTML, CSS and ES modules with relative paths, so packaging is
a copy of the files the page loads, the kid-a/ page that sends old links to
the Piano, and the classic app for older projects.
"""
from pathlib import Path
import shutil
import time

root = Path(__file__).resolve().parent.parent
dist = root / 'dist'
if dist.exists():
    shutil.rmtree(dist)
dist.mkdir()
for name in ['index.html', 'mac.css', 'icon.svg', 'manifest.webmanifest', 'sw.js', '.nojekyll']:
    shutil.copy2(root / name, dist / name)
# Each build gets its own stylesheet and script address, so a browser holding
# the last version's copies fetches the new ones with the new page.
stamp = time.strftime('%Y%m%d%H%M%S')
page = dist / 'index.html'
page.write_text(page.read_text().replace('?v=dev', f'?v={stamp}'))
for folder in ['src', 'assets', 'kid-a']:
    shutil.copytree(root / folder, dist / folder)
shutil.copytree(root / 'classic', dist / 'classic', ignore=shutil.ignore_patterns('tests', '*.md'))
print('Packaged dist/ with', sum(1 for p in dist.rglob('*') if p.is_file()), 'files.')
