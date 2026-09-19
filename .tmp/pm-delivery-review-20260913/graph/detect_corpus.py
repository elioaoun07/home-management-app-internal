import json, sys
from pathlib import Path
from graphify.detect import detect
base = Path.cwd().parents[2]
Path('.graphify_python').write_text(sys.executable, encoding='utf-8')
for label, rel in [('delivery-v2','scripts/delivery-v2'), ('pm-app','scripts/pm/app')]:
    result=detect(base / rel)
    Path(f'{label}-detect.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(label, {k:v for k,v in result.items() if k!='files'})
    print('counts', {k:len(v) for k,v in result.get('files',{}).items()})
