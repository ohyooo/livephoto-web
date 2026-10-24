import hashlib
import json
import os
import re
import urllib.request
from pathlib import Path, PurePosixPath

manifest = json.loads(Path('web-ui-package-evidence.json').read_text(encoding='utf-8-sig'))
commit, run = manifest['commit'], str(manifest['run'])
assert re.fullmatch(r'[0-9a-f]{40}', commit) and run.isdigit(), 'Invalid source identity'
assert manifest['kotlinRuntime'] == 'wasmJs' and manifest['applicationWasm'] and manifest['workerWasm']
expected = set()
for entry in manifest['files']:
    relative = PurePosixPath(entry['path'])
    assert not relative.is_absolute() and '..' not in relative.parts
    assert entry['path'] not in expected, 'Duplicate file'
    expected.add(entry['path'])
    path = Path('site') / relative
    assert path.is_file() and not path.is_symlink(), 'Missing or linked asset'
    data = path.read_bytes()
    assert len(data) == entry['bytes'] and hashlib.sha256(data).hexdigest() == entry['sha256'], f'Asset mismatch: {relative}'
assert not any(path.is_symlink() for path in Path('site').rglob('*'))
assert {path.relative_to('site').as_posix() for path in Path('site').rglob('*') if path.is_file()} == expected
request = urllib.request.Request(f'https://api.github.com/repos/ohyooo/LivePhoto/actions/runs/{run}',
    headers={'Accept': 'application/vnd.github+json', 'Authorization': f'Bearer {os.environ["GH_TOKEN"]}'})
with urllib.request.urlopen(request, timeout=30) as response:
    source = json.load(response)
assert source['conclusion'] == 'success' and source['head_sha'] == commit
assert source['head_branch'] == 'main' and source['event'] in ('push', 'workflow_dispatch')
assert source['path'] == '.github/workflows/web.yml', 'Not the verified Web pipeline'
with open(os.environ['GITHUB_OUTPUT'], 'a') as output:
    output.write(f'commit={commit}\n')
print(f'VERIFIED {len(expected)} assets from Web run {run}, commit {commit}')
