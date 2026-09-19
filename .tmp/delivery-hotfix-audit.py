import sqlite3, json, sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')

db = sqlite3.connect('file:.delivery/v2/supervisor.sqlite?mode=ro', uri=True)
db.row_factory = sqlite3.Row
run = 'r-c1d69bb666cf'
if sys.argv[1:] == ['diff']:
    import difflib
    r=db.execute('select journal_dir from applications where run_id=?',(run,)).fetchone()
    root=Path(r['journal_dir'])
    before=(root/'before/0.bin').read_text(encoding='utf-8').splitlines()
    after=(root/'after/0.bin').read_text(encoding='utf-8').splitlines()
    print('\n'.join(difflib.unified_diff(before,after,fromfile='Before Work.tsx',tofile='Candidate Work.tsx',lineterm='')))
    print((root/'journal.ndjson').read_text())
    sys.exit()
if sys.argv[1:] == ['summary']:
    policy = json.loads(Path('.delivery/v2/execution-policy.json').read_text())
    print('POLICY', json.dumps({k:policy.get(k) for k in ['resources','dispatch','concurrency','executors']}, ensure_ascii=False))
    for table in ['contracts','grants','usage_readings','check_receipts','results','candidates']:
        cols=[r['name'] for r in db.execute('pragma table_info(' + table + ')')]
        print('SCHEMA',table,cols)
        if 'run_id' not in cols: continue
        for row in db.execute('select * from '+table+' where run_id=?',(run,)):
            r=dict(row)
            for k in ['record_json','receipt_json']:
                if r.get(k): r[k]=json.loads(r[k])
            if table=='candidates':
                d=r['record_json']; r={k:d.get(k) for k in ['candidate_id','generation','root','changed','workerClaims']}
            if table=='results':
                d=r['record_json']; r={'version':r['result_version'],'created_at':r['created_at'],'record':d}
            print(json.dumps(r,ensure_ascii=False))
    sys.exit()
tables = ['runs','jobs','plans','candidates','results','applications','run_events','resource_ledger','receipts','activity']
for table in (sys.argv[1:] or tables):
    cols = [r['name'] for r in db.execute('pragma table_info(' + table + ')')]
    if not cols:
        continue
    print('\nTABLE', table, cols)
    if 'run_id' not in cols:
        continue
    for row in db.execute('select * from ' + table + ' where run_id=?', (run,)):
        data = dict(row)
        for key, value in list(data.items()):
            if key.endswith('_json') and value:
                try: data[key] = json.loads(value)
                except ValueError: pass
        if table == 'jobs':
            data.pop('request_json', None)
            data.pop('intent_json', None)
        if table == 'runs':
            data.pop('base_manifest_json', None)
        print(json.dumps(data, ensure_ascii=False))
