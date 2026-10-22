"""Rebuild the version-pinned vanilla catalog (Python 3 + Pillow, Node 22).
Run: python scripts/import-crafting.py /tmp/vanilla /tmp/terrabook-data/terrabook-main
Inputs are fetched from the pinned GitHub tree if absent. Download terrabook at
its pinned revision from SOURCES.md. No source code is shipped to the browser.
The recipe declarations run in an isolated, time-limited JS VM with stub items;
unknown C# syntax fails closed. Counts, ingredient groups and reverse recipes
are validated before the generated factual data is written.
"""
import base64, hashlib, json, pathlib, re, subprocess, sys, urllib.request
from PIL import Image
REV='69b5a80eab473dca8a08f491bf7a090d9e7f22dc'
REPO='codingwatching/terraria-1.4.4.5-source-code'
cache=pathlib.Path(sys.argv[1]); cache.mkdir(parents=True,exist_ok=True)
book=pathlib.Path(sys.argv[2]); out=pathlib.Path('public/assets/catalog');out.mkdir(parents=True,exist_ok=True)
files=['Recipe.cs','Item.cs','ItemID.cs','TileID.cs','.en-US.Items.json','.ru-RU.Items.json']
paths={}
for name in files:
    p=cache/name
    if not p.exists():
        if not paths:
            tree=json.load(urllib.request.urlopen(f'https://api.github.com/repos/{REPO}/git/trees/{REV}?recursive=1'))['tree']
            paths={n:next(x for x in tree if x['path'].endswith('/'+n) or x['path'].endswith(n)) for n in files}
        blob=json.load(urllib.request.urlopen(paths[name]['url']));p.write_bytes(base64.b64decode(blob['content']))
EXPECTED_SHA256={'Recipe.cs': '5cc18954b14b41679f4ca8d171196e9f340f1750a3fa2af5899c4d60f1f590ac', 'Item.cs': '75795e0582441c1ed7850c016f92374a7d285fcbb101d20071f56a5521c9c06c', 'ItemID.cs': 'b779306b8314a24dd0eb1d2bdf72dae582675c58f9d3af1ecd0a9647f856e9c5', 'TileID.cs': 'c0441ec0258a797bb1e0201f9c6f686317d45751eeb9528cac92b4280af9de01', '.en-US.Items.json': '21351046f1ca024652df0dc0d5d0aed7b396fbcac629306313dde445bee82732', '.ru-RU.Items.json': '845b20c365fb612d5d314e346dc6810bb1fe078a68e092817105eae4e4f80915'}
for name,expected in EXPECTED_SHA256.items():
    if hashlib.sha256((cache/name).read_bytes()).hexdigest()!=expected:
        raise ValueError('Source checksum mismatch: '+name)
def text(n):return (cache/n).read_text()
def jsonc(n):return json.loads(re.sub(r',\s*([}\]])',r'\1',text(n)))
en=jsonc('.en-US.Items.json')['ItemName']; ru=jsonc('.ru-RU.Items.json')['ItemName']
ids={k:int(v) for k,v in re.findall(r'public const short (\w+) = (\d+);',text('ItemID.cs'))}
items={v:{'en':en.get(k,k),'name':ru.get(k,en.get(k,k))} for k,v in ids.items() if k in en}
source=text('Recipe.cs')
def body(name):
    pos=source.index('static void '+name+'()');a=source.index('{',pos);depth=1;b=a+1
    while depth:
        depth+=(source[b]=='{')-(source[b]=='}');b+=1
    return source[a+1:b-1]
# The registration order in SetupRecipeGroups (not the default ID constants) is authoritative.
groupbody=body('SetupRecipeGroups'); groups={};groupids={}
for index,(expr,key) in enumerate(re.findall(r'new RecipeGroup\((.*?)\);\s*RecipeGroupID\.(\w+) =',groupbody,re.S)):
    nums=re.search(r',\s*([\d,\s]+)$',expr).group(1)
    members=[int(n) for n in nums.split(',')]
    groupids[key]=index;groups[index]={'key':key,'items':members}
texture=re.search(r'TextureCopyLoad = Factory.CreateIntSet\(-1, ([\d, ]+)\)',text('ItemID.cs')).group(1)
texture=[int(n) for n in texture.split(',')];texture=dict(zip(texture[::2],texture[1::2]))
helpers=sorted(set(re.findall(r'\b(Add\w+)\(\);',body('SetupRecipes')))-{'AddRecipe'})
code='function SetupRecipes(){'+body('SetupRecipes')+'}\n'+''.join('function '+n+'(){'+body(n)+'}\n' for n in helpers)
# Data-maintenance calls do not register recipes. Reverse recipes are generated below
# from the actual item placement fields and verified separately.
for n in ['SetupRecipeGroups','CreateReverseWallRecipes','CreateReversePlatformRecipes','UpdateWhichItemsAreMaterials','UpdateWhichItemsAreCrafted','UpdateMaterialFieldForAllRecipes','ReplaceItemUseFlagsWithRecipeGroups','CreateRequiredItemQuickLookups']:
    code=code.replace(n+'();','')
code=code.replace('ShimmerTransforms.UpdateRecipeSets();','').replace('(int)((float)num * 2.5f)','Math.trunc(num * 2.5)')
def array(m):
    value=m.group(1)
    return value.replace('{','[').replace('}',']')
code=re.sub(r'new int\[[\d, ]+\]\s*(\{(?:[^{}]|\{[^{}]*\})*\})',array,code)
code=re.sub(r'\b(?:int(?:\[,*\])?|RecipeGroup|Recipe)\s+(\w+)\s*=',r'let \1 =',code)
code=re.sub(r'(\w+)\.GetLength\(0\)',r'\1.length',code)
code=re.sub(r'(\w+)\[([^\[\],]+),\s*(\d+)\]',r'\1[\2][\3]',code)
# Only the known recipe declaration vocabulary may reach the VM.
allowed=set('Math trunc function let for if true false currentRecipe createItem SetDefaults stack requiredItem requiredTile SetIngredients SetCraftingStation RequireGroup AddRecipe SetupRecipes RecipeGroup recipeGroups IconicItemId RecipeGroupID ItemID Sets TextureCopyLoad length anyWood anyIronBar anyPressurePlate anySand anyFragment needHoney needWater needLava alchemy needSnowBiome needGraveyardBiome needEverythingSeed crimson corruption notDecraftable'.split())|set(helpers)|set(groupids)
allowed |= set(re.findall(r'let (\w+)',code))
unknown=set(re.findall(r'\b[A-Za-z_]\w*\b',code))-allowed
if unknown:raise ValueError('Unexpected source vocabulary: '+str(unknown))
runner=r'''
const vm=require('node:vm'),fs=require('node:fs');const input=JSON.parse(fs.readFileSync(0,'utf8'));
let recipes=[];function item(){return {type:0,stack:1,SetDefaults(id){if(!Number.isInteger(id)||id<=0)throw Error('Bad item '+id);this.type=id;this.stack=1}}}
function recipe(){return {createItem:item(),requiredItem:Array.from({length:15},item),requiredTile:Array(15).fill(-1),groups:[],SetIngredients(...args){if(Array.isArray(args[0]))args=args[0];if(args.length===1)args.push(1);if(args.length%2)throw Error('Bad ingredients');for(let n=0;n<args.length;n+=2){this.requiredItem[n/2].SetDefaults(args[n]);this.requiredItem[n/2].stack=args[n+1]}},SetCraftingStation(...ids){ids.forEach((id,n)=>this.requiredTile[n]=id)},RequireGroup(id){if(!input.groups[id])throw Error('Bad group');this.groups.push(id)}}}
const context={currentRecipe:recipe(),ItemID:{Sets:{TextureCopyLoad:input.texture}},RecipeGroupID:input.groupids,RecipeGroup:{recipeGroups:Object.fromEntries(Object.entries(input.groups).map(([k,g])=>[k,{IconicItemId:g.items[0]}]))},AddRecipe(){let r=context.currentRecipe;recipes.push(JSON.parse(JSON.stringify(r)));context.currentRecipe=recipe()}};
vm.runInNewContext(input.code+'\nSetupRecipes();',context,{timeout:5000,contextCodeGeneration:{strings:false,wasm:false}});process.stdout.write(JSON.stringify(recipes));
'''
result=subprocess.run(['node','-e',runner],input=json.dumps({'code':code,'groups':groups,'groupids':groupids,'texture':texture}),text=True,capture_output=True,check=True)
registered=json.loads(result.stdout)
# Read placement fields from item definitions, including grouped switch cases.
placements={}
for m in re.finditer(r'((?:\s*case \d+:\s*)+)(.*?)(?=\n\s*case \d+:|\n\s*default:)',text('Item.cs'),re.S):
    caseids=[int(x) for x in re.findall(r'case (\d+):',m[1])];chunk=m[2]
    for prop in ['createTile','createWall']:
        val=re.search(prop+r' = (\d+);',chunk)
        if not val:val=re.search(('DefaultToPlaceableTile' if prop=='createTile' else 'DefaultToPlaceableWall')+r'\((\d+)',chunk)
        if val:
            for i in caseids:placements.setdefault(i,{})[prop]=int(val[1])
platforms={19,427,435,436,437,438,439}
recipes=[]
for r in registered:
    r['requiredItem']=[i for i in r['requiredItem'] if i['type']]
    r['requiredTile']=[i for i in r['requiredTile'] if i>=0]
    recipes.append(r)
# Reproduce vanilla's auto-registered wall/platform reversal predicates.
def is_wall(i):
    name=items[i]['en']
    return placements.get(i,{}).get('createWall',-1)>0 or name.endswith(('Wall','Fence')) or 'Stained Glass' in name

def is_platform(i):
    return placements.get(i,{}).get('createTile') in platforms or items[i]['en'].endswith('Platform')

# Use the exact two vanilla passes (including insert order and fixed loop limits),
# not a recursive "uncrafting" algorithm. Shelves are platforms; fences are walls.
for kind in ['wall','platform']:
    initial_count=len(recipes)
    for n in range(initial_count):
        r=recipes[n];ing=r['requiredItem'];i=r['createItem']['type']
        match=(is_wall(i) and len(ing)==1 and not is_wall(ing[0]['type'])) if kind=='wall' else (is_platform(i) and len(ing)==1)
        if match:
            recipes.insert(n+1,{'createItem':dict(ing[0]),'requiredItem':[dict(r['createItem'])],'requiredTile':r['requiredTile'],'groups':[],'notDecraftable':True,'reverse':True})
# Station alternatives are accepted by the game, not separate recipes.
station_keys={13:'Bottle',14:'WoodenTable',15:'WoodenChair',16:'IronAnvil',17:'Furnace',18:'WorkBench',77:'Hellforge',86:'Loom',94:'Keg',96:'CookingPot',101:'Bookcase',106:'Sawmill',114:'TinkerersWorkshop',125:'CrystalBall',133:'AdamantiteForge',134:'MythrilAnvil',217:'BlendOMatic',218:'MeatGrinder',220:'Solidifier',228:'DyeVat',243:'ImbuingStation',247:'Autohammer',283:'HeavyWorkBench',300:'BoneWelder',301:'FleshCloningVaat',302:'GlassKiln',303:'LihzahrdFurnace',304:'LivingLoom',305:'SkyMill',306:'IceMachine',307:'SteampunkBoiler',308:'HoneyDispenser',412:'LunarCraftingStation',499:'LesionStation',622:'TeaKettle'}
station_items={t:ids[k] for t,k in station_keys.items()}
labels={26:'Демонический / Багровый алтарь',13:'Бутылка на столе / Алхимический стол',16:'Железная / Свинцовая наковальня',134:'Мифриловая / Орихалковая наковальня',133:'Адамантитовая / Титановая печь'}
stations={}
usedtiles=sorted({t for r in recipes for t in r['requiredTile']})
for t in usedtiles:
    i=station_items.get(t,0);stations[t]={'item':i,'name':labels.get(t,items.get(i,{}).get('name',f'Станция {t}'))}
condition_names={'needHoney':'Рядом с мёдом','needWater':'Рядом с водой / раковиной','needLava':'Рядом с лавой','needSnowBiome':'Снежный биом','needGraveyardBiome':'Кладбище','needEverythingSeed':'Специальный мир get fixed boi','crimson':'Мир с Багрянцем','corruption':'Мир с Искажением'}
compact=[]
for r in recipes:
    groupkeys=r.get('groups',[])[:]
    for flag,key in [('anyWood','Wood'),('anyIronBar','IronBar'),('anySand','Sand'),('anyFragment','Fragment'),('anyPressurePlate','PressurePlate')]:
        if r.get(flag):groupkeys.append(groupids[key])
    ing=[]
    for i in r['requiredItem']:
        g=next((g for g in groupkeys if i['type'] in groups[g]['items']),None)
        ing.append([i['type'],i['stack'],g])
    compact.append({'item':r['createItem']['type'],'qty':r['createItem']['stack'],'ingredients':ing,'stations':r['requiredTile'],'conditions':[label for flag,label in condition_names.items() if r.get(flag)],'reverse':bool(r.get('reverse'))})
needed={r['item'] for r in compact}|{i[0] for r in compact for i in r['ingredients']}|{s['item'] for s in stations.values() if s['item']}|{i for g in groups.values() for i in g['items']}
images=book/'public/images';mapping={};missing=[]
def norm(s):return re.sub(r'[^a-z0-9]','',s.lower())
index={norm(p.stem):p for p in images.iterdir()}
for i in sorted(needed):
    assert i in items,(i,'Missing translation')
    name=items[i]['en'];p=index.get(norm(name))
    if not p:missing.append((i,name))
    else:mapping[i]=p
sprite_tree='f238436b44c1a433f4d9e27c5d073637607c9107'
spritecache=cache/'sprites';spritecache.mkdir(exist_ok=True);tree=None
for i,name in missing:
    p=spritecache/f'{i}.png'
    if not p.exists():
        if tree is None:tree=json.load(urllib.request.urlopen(f'https://api.github.com/repos/JevonLee/Stardew/git/trees/{sprite_tree}?recursive=1'))['tree']
        entry=next(x for x in tree if x['path']==f'Art/Terraria/images/Item_{i}.png')
        blob=json.load(urllib.request.urlopen(entry['url']));p.write_bytes(base64.b64decode(blob['content']))
    mapping[i]=p
# Compact atlas: avoids thousands of files and keeps the entire catalog available offline.
width=2048;x=y=row=0;coords={};sprites=[]
for i,p in mapping.items():
    im=Image.open(p).convert('RGBA')
    if im.width>128 or im.height>128:raise ValueError(('Unexpected sprite dimensions',p,im.size))
    if x+im.width+2>width:x=0;y+=row+2;row=0
    coords[i]=[x,y,im.width,im.height];sprites.append((im,x,y));x+=im.width+2;row=max(row,im.height)
height=y+row+2;atlas=Image.new('RGBA',(width,height));
for im,x,y in sprites:atlas.paste(im,(x,y))
atlas.save(out/'items.webp',lossless=True,method=6)
spritefile='items-'+hashlib.sha256((out/'items.webp').read_bytes()).hexdigest()[:12]+'.webp'
(out/'items.webp').replace(out/spritefile)
for i in needed:items[i]['sprite']=coords[i]
final={'meta':{'version':'1.4.4.5','registered':len(registered),'recipes':len(compact),'items':len({r['item'] for r in compact}),'atlas':[width,height],'spriteFile':spritefile,'spriteSources':{'terrabook':'0aa83be93a1881d15a98376643b4dbe331f16446','additionalTree':sprite_tree,'additionalItems':[i for i,name in missing]},'source':f'https://github.com/{REPO}/tree/{REV}','sourceSha256':{n:hashlib.sha256((cache/n).read_bytes()).hexdigest() for n in files}},'items':{i:items[i] for i in sorted(needed)},'stations':stations,'groups':groups,'recipes':compact}
assert 2500<len(compact)<3500
assert all(r['qty']>0 and r['ingredients'] and all(i[1]>0 for i in r['ingredients']) for r in compact)
assert len([r for r in compact if r['item']==4956])==1
(out/'recipes.json').write_text(json.dumps(final,ensure_ascii=False,separators=(',',':')))
print(json.dumps(final['meta'],ensure_ascii=False,indent=2))
