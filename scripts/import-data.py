"""Normalize pinned wiki snapshots. Run with tracker and terrariamuzz checkout paths.
Source commits and licensing are documented in ATTRIBUTION.md. No generated translations.
"""
import json,sys,pathlib,re
tracker=pathlib.Path(sys.argv[1]); muzz=pathlib.Path(sys.argv[2]); base=tracker/'web/public/data'
load=lambda f:json.loads((base/(f+'.json')).read_text())
locale=json.loads((muzz/'terrariamuzz/localization/db-ru.json').read_text())['ItemName']
localeDir=pathlib.Path(sys.argv[3]) if len(sys.argv)>3 else pathlib.Path('/tmp')
archive=json.loads((localeDir/'ru-Items.json').read_text(encoding='utf-8-sig'))
npcLocale=json.loads((localeDir/'ru-NPCs.json').read_text(encoding='utf-8-sig'))['NPCName']
items=load('items'); recipes=load('recipes'); sprites=load('sprites')
def resolve(s,depth=0):
 if depth>8:return s
 def sub(m):
  typ,key=m.group(1).split('.',1);raw=(locale.get(key)if typ=='ItemName' else archive.get(typ,{}).get(key))
  return resolve(raw,depth+1)if raw else m.group(0)
 return re.sub(r'\{\$([^}]+)\}',sub,s)
for i in items:
 raw=locale.get(i['key']) or archive['ItemName'].get(i['key']);i['ru']=resolve(raw)if raw else i['name'];i['localized']=bool(raw)
 tip=archive.get('ItemTooltip',{}).get(i['key']);i['ruTooltip']=resolve(tip)if tip else ''
 i['descriptionSource']='GameText/db-ru; official 1.4.4.5 fallback'if raw else 'English fallback, no generated translation'
for index,r in enumerate(recipes['recipes']):r['id']='recipe-'+str(index)
town=[e for e in load('bestiary')['entries']if e['type']=='town']
facts=json.loads(pathlib.Path(__file__).with_name('npc-preferences.json').read_text());byName={n['name']:dict(n,id=k)for k,n in facts.items()}
manual={'TownCat':'Городской кот','TownDog':'Городская собака','TownBunny':'Городской кролик','TownSlimeBlue':'Умный слизень','TownSlimeGreen':'Крутой слизень','TownSlimeOld':'Старый слизень','TownSlimePurple':'Неуклюжий слизень','TownSlimeRainbow':'Слизень-дива','TownSlimeRed':'Угрюмый слизень','TownSlimeYellow':'Мистический слизень','TownSlimeCopper':'Слизень-оруженосец','TravellingMerchant':'Странствующий торговец','SkeletonMerchant':'Скелет-торговец','OldMan':'Старик'}
for n in town:
 fact=byName.get(n['name']);n['ru']=npcLocale.get(n['id'])or manual.get(n['id'])or n['name'];n['main']=bool(fact);n['preferences']=fact or None
out={'meta':load('meta'),'items':items,'craft':recipes,'drops':load('drops'),'shops':load('shops'),'sprites':sprites,'npcs':town,'categories':load('categories'),'biomes':load('biomes'),'methods':load('obtain'),'conditions':load('conditions'),'vendors':load('vendors'),'versions':load('versions'),'platforms':load('platforms'),'extractinator':load('extractinator')}
enemyNames={e['name']:npcLocale.get(e['id']) for e in load('bestiary')['entries']}
itemNames={i['name']:i['ru'] for i in items}
for source in out['drops']['sources'].values():source['ru']=enemyNames.get(source['name']) or itemNames.get(source['name']) or source['name']
pathlib.Path('src/data/catalog.json').write_text(json.dumps(out,ensure_ascii=False,separators=(',',':')))
print('items',len(items),'localized',sum(i['localized']for i in items),'recipes',len(recipes['recipes']),'results',len(set(r['result']for r in recipes['recipes'])),'NPC',len(town))
print('missing sprite',sum(i.get('icon','').split('/')[-1]not in sprites['icons']for i in items))
assert len(items)==6186 and len(recipes['recipes'])==3655 and len(town)==40
