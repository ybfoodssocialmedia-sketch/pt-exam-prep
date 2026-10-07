import json,glob,collections,itertools,re
W={'Anatomy':4,'Physiology':4,'Biochemistry':2,'Fundamentals of Exercise Therapy':5,'Fundamentals of Electro Therapy':12,'Pharmacology':2,'Pathology & Microbiology':4,'Psychology':1,'Psychiatry':1,'Kinesio Therapeutics':7,'General Surgery & Orthopedics':6,'Medicine':6,'OBGY':3,'Physical Diagnosis & Manipulative Skills':8,'Physiotherapy in Musculoskeletal Condition':10,'Physiotherapy in Neurosciences':10,'Physiotherapy in General Medical & Surgical Condition':10,'Physiotherapy in Community Health':5}
P={}
for f in sorted(glob.glob('papers/generated/*-paper-*.json')):
    p=json.load(open(f,encoding='utf-8')); P[p['paperId']]=p
print('papers',len(P))
bad=0
for pid,p in P.items():
    qs=p['questions']
    assert len(qs)==100,(pid,len(qs))
    refs=[q['bankRef'] for q in qs]; assert len(set(refs))==100,(pid,'dup refs')
    texts=[re.sub(r'\W+','',q['question'].lower()) for q in qs]; assert len(set(texts))==100,(pid,'dup text')
    c=collections.Counter(q['subject'] for q in qs)
    if dict(c)!=W: print('weightage mismatch',pid,{k:(c.get(k),v) for k,v in W.items() if c.get(k)!=v}); bad+=1
    for q in qs:
        assert set(q['options'])=={'A','B','C','D'} and q['correctAnswer'] in q['options'] and len(set(q['options'].values()))==4,(pid,q['id'])
mx=0;worst=None
ids=list(P)
sets={i:set(q['bankRef'] for q in P[i]['questions']) for i in ids}
over=[]
for a,b in itertools.combinations(ids,2):
    n=len(sets[a]&sets[b]); 
    if n>mx: mx=n;worst=(a,b)
    if n>5: over.append((a,b,n))
print('max pair overlap',mx,worst,'pairs >5:',len(over))
tiers=collections.Counter(p['difficulty'] for p in P.values()); print(tiers)
tot=collections.Counter(r for s in sets.values() for r in s)
print('distinct questions used',len(tot),'max reuse',max(tot.values()))
print('weightage problems',bad)
