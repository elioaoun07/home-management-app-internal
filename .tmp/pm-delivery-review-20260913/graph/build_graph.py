import json
from pathlib import Path
from graphify.extract import extract
from graphify.build import build_from_json
from graphify.cluster import cluster, score_all
from graphify.analyze import god_nodes, surprising_connections, suggest_questions
from graphify.report import generate
from graphify.export import to_json

parts=[json.loads(Path(f'{label}-detect.json').read_text()) for label in ['delivery-v2','pm-app']]
detection={'total_files':sum(p['total_files'] for p in parts), 'total_words':sum(p['total_words'] for p in parts), 'needs_graph':True, 'warning':None, 'files':{key:sum([p['files'].get(key,[]) for p in parts],[]) for key in parts[0]['files']}}
Path('.graphify_detect.json').write_text(json.dumps(detection), encoding='utf-8')
extraction=extract([Path(p) for p in detection['files']['code']])
Path('.graphify_extract.json').write_text(json.dumps(extraction,indent=2),encoding='utf-8')
G=build_from_json(extraction)
communities=cluster(G)
cohesion=score_all(G,communities)
gods=god_nodes(G)
surprises=surprising_connections(G,communities)
analysis={'communities':{str(k):v for k,v in communities.items()},'cohesion':{str(k):v for k,v in cohesion.items()},'gods':gods,'surprises':surprises}
Path('.graphify_analysis.json').write_text(json.dumps(analysis,indent=2),encoding='utf-8')
Path('graphify-out').mkdir(exist_ok=True)
to_json(G,communities,'graphify-out/graph.json')
print('Graph:',G.number_of_nodes(),'nodes,',G.number_of_edges(),'edges,',len(communities),'communities')
print('God nodes',json.dumps(gods))
for cid,nodes in communities.items():
    ranked=sorted(nodes,key=lambda n:G.degree(n),reverse=True)
    print('COMMUNITY',cid,'count',len(nodes),'cohesion',cohesion[cid], 'top',[(G.nodes[n].get('label'),G.degree(n),G.nodes[n].get('source_file')) for n in ranked[:8]])
