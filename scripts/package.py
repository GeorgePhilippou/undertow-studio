"""Copy the static site into dist/ for GitHub Pages.

The site is plain HTML, CSS and ES modules with relative paths, so packaging is
a copy of the files the page loads plus the classic app for older projects.
"""
from pathlib import Path
import shutil

root = Path(__file__).resolve().parent.parent
dist = root / 'dist'
if dist.exists():
    shutil.rmtree(dist)
dist.mkdir()
for name in ['index.html', 'mac.css', 'icon.svg', '.nojekyll']:
    shutil.copy2(root / name, dist / name)
for folder in ['src', 'assets']:
    shutil.copytree(root / folder, dist / folder)
shutil.copytree(root / 'classic', dist / 'classic', ignore=shutil.ignore_patterns('tests', '*.md'))
print('Packaged dist/ with', sum(1 for p in dist.rglob('*') if p.is_file()), 'files.')
