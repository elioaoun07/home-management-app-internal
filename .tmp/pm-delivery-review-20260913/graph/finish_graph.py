import json
from pathlib import Path
from datetime import datetime, timezone
from graphify.build import build_from_json
from graphify.analyze import suggest_questions
from graphify.report import generate
from graphify.export import to_html
from graphify.detect import save_manifest
from graphify.benchmark import run_benchmark, print_benchmark

extraction=json.loads(Path('.graphify_extract.json').read_text())
detection=json.loads(Path('.graphify_detect.json').read_text())
analysis=json.loads(Path('.graphify_analysis.json').read_text())
G=build_from_json(extraction)
communities={int(k):v for k,v in analysis['communities'].items()}
cohesion={int(k):v for k,v in analysis['cohesion'].items()}
labels={0:'Contracts and Work References',1:'Provider Adapter Controls',2:'Queue and Job Coordination',3:'Journey and Execution Policy',4:'Candidate Application and Rollback',5:'PM Board and Navigation',6:'Delivery Routing and Pairing',7:'Qualification and Boundary Probes',8:'Criteria and Check Execution',9:'Delivery UI Session State',10:'Delivery Display Model',11:'Owner Plan Interaction',12:'Qualification Receipt Integrity',13:'Worker Isolation Configuration',14:'API Transport',15:'Worker Process Runtime',16:'Local Transport Errors',17:'PM Application Shell',18:'Auxiliary Editor',19:'Command Center Entry',20:'Legacy Delivery Launch',21:'PM Home',22:'PM Bootstrap',23:'PM Shared Types'}
questions=suggest_questions(G,communities,labels)
report=generate(G,communities,cohesion,labels,analysis['gods'],analysis['surprises'],detection,{'input':0,'output':0},'scripts/delivery-v2 + scripts/pm/app (code only)',suggested_questions=questions)
report+='\n\n## Review scope limitations\n\nCode-only deterministic AST extraction: no semantic extraction, no production/provider calls. The graph captures recognized declarations and relationships; isolated TSX components are an extractor limitation and must not be interpreted as proof of architectural isolation. Shared utility centrality (especially deepFreeze) is not a defect by itself.\n'
Path('graphify-out/GRAPH_REPORT.md').write_text(report,encoding='utf-8')
Path('.graphify_labels.json').write_text(json.dumps(labels,indent=2),encoding='utf-8')
to_html(G,communities,'graphify-out/graph.html',community_labels=labels)
save_manifest(detection['files'])
Path('graphify-out/cost.json').write_text(json.dumps({'runs':[{'date':datetime.now(timezone.utc).isoformat(),'input_tokens':0,'output_tokens':0,'files':detection['total_files']}],'total_input_tokens':0,'total_output_tokens':0},indent=2),encoding='utf-8')
print('Surprises:',json.dumps(analysis['surprises'][:10]))
print('Questions:',json.dumps(questions[:5]))
for term in ['routeDeliveryV2','buildDeliver','applyCandidate','authenticateLocal','resolveExecutorChoice','runCheck','recordPlan','coordinate']:
    for nid,d in G.nodes(data=True):
        if d.get('label')==term+'()':
            print('SEAM',term,'source',d.get('source_file'),d.get('source_location'))
            print([(G.nodes[n].get('label'),G.edges[nid,n].get('relation'),G.nodes[n].get('source_file')) for n in G.neighbors(nid)])
result=run_benchmark('graphify-out/graph.json',corpus_words=detection['total_words'])
Path('graphify-out/benchmark.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print_benchmark(result)
