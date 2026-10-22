"""Reproducible reference landscape, composed with unmodified Terraria sprite frames.
Needs Pillow; source archive is pinned. Output is NOT an in-game capture or .wld.
python scripts/render-atlas.py /tmp/terraria-art --download
The app/build only needs checked-in output, not Python or network.
"""
import argparse, concurrent.futures, hashlib, json, math, pathlib, random, subprocess
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter
REV='f238436b44c1a433f4d9e27c5d073637607c9107'
TILES=[0,1,2,3,4,5,6,7,8,9,10,12,14,15,17,18,19,21,22,23,25,28,30,41,48,53,54,56,57,58,59,60,61,62,70,71,72,75,76,80,82,109,117,124,147,161,189,191,192,199,201,202,203,396,397,404]
NAMES=[f'Tiles_{i}.png' for i in TILES]+[f'Wall_{i}.png' for i in [1,2,4,5,7,14,15]]+[f'Tree_Tops_{i}.png' for i in [0,1,2,3,4,5,6,7,8,9]]+[f'Tree_Branches_{i}.png' for i in [0,1,2,3]]+[f'Background_{i}.png' for i in [0,3,4,7,8,9,10,11,12,13,14]]+['Cloud_0.png','Cloud_1.png','Sun.png','Liquid_0.png','Liquid_1.png','Shroom_Tops.png','NPC_195.png']
p=argparse.ArgumentParser();p.add_argument('source',type=pathlib.Path);p.add_argument('--download',action='store_true');p.add_argument('--inspect',action='store_true');args=p.parse_args();args.source.mkdir(parents=True,exist_ok=True)
manifest=json.loads(pathlib.Path(__file__).with_name('atlas-art-manifest.json').read_text())
if manifest['revision']!=REV or set(manifest['blobs'])!=set(NAMES):raise ValueError('Asset manifest does not match renderer input')
def verified(name):
 path=args.source/name
 if not path.exists():return False
 data=path.read_bytes()
 return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()==manifest['blobs'][name]
if args.download:
 tree=json.loads(subprocess.check_output(['gh','api',f'repos/JevonLee/Stardew/git/trees/{REV}?recursive=1']))['tree'];files={a['path'].split('/')[-1]:a['sha'] for a in tree if a['path'].startswith('Art/Terraria/images/')}
 def fetch(name):
  dest=args.source/name
  if not verified(name):dest.write_bytes(subprocess.check_output(['gh','api',f'repos/JevonLee/Stardew/git/blobs/{files[name]}','-H','Accept: application/vnd.github.raw+json']))
 with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:list(pool.map(fetch,NAMES))
for name in NAMES:
 if not verified(name):raise ValueError(f'Original asset missing or hash mismatch: {name}; use --download with GitHub access')
art={name:Image.open(args.source/name).convert('RGBA') for name in NAMES}
if args.inspect:
 sheet=Image.new('RGB',(1000,math.ceil(len(NAMES)/8)*125),'#23303d');d=ImageDraw.Draw(sheet)
 for i,(name,im) in enumerate(art.items()):
  thumb=im.copy();thumb.thumbnail((118,100),Image.Resampling.NEAREST);sheet.paste(thumb,(i%8*125,i//8*125+18),thumb);d.text((i%8*125,i//8*125),name,fill='white');print(name,im.size)
 sheet.save('/tmp/atlas-textures.jpg');raise SystemExit
# Renderer below writes only final, local WebP assets.
from functools import lru_cache
ROOT=pathlib.Path(__file__).resolve().parents[1];OUT=ROOT/'public/assets/atlas';OUT.mkdir(parents=True,exist_ok=True)
S=4;W,H=1200*S,800*S;NX,NY=300,200
rng=random.Random(86156)
def surf(x):return round((267+math.sin(x/66)*13+math.sin(x/29)*7)/4)*4
@lru_cache(maxsize=None)
def tile(kind,fx=18,fy=18):return art[f'Tiles_{kind}.png'].crop((fx,fy,fx+16,fy+16))
def paste(im,src,x,y):im.alpha_composite(src,(int(x),int(y)))
def wall(kind):return art[f'Wall_{kind}.png'].crop((44,44,60,60))
def frame(kind,x,y,solid):
 t=not solid(x,y-1);b=not solid(x,y+1);l=not solid(x-1,y);r=not solid(x+1,y)
 v=(x*13+y*7)%3
 if t and l:return tile(kind,0,54)
 if t and r:return tile(kind,18,54)
 if b and l:return tile(kind,36,54)
 if b and r:return tile(kind,54,54)
 if t:return tile(kind,18+v*18,0)
 if b:return tile(kind,18+v*18,36)
 if l:return tile(kind,0,v*18)
 if r:return tile(kind,72,v*18)
 return tile(kind,18+v*18,18)
def surface_kind(x):return 53 if x<80 or x>1135 or 515<x<680 else 147 if x<265 else 23 if 680<x<810 else 60 if 810<x<1020 else 199 if 1020<x<1135 else 2
# The same deterministic empty spaces and deposits are retained in both phases.
grid=[[None for x in range(NX)] for y in range(NY)]
for y in range(NY):
 for x in range(NX):
  wx,wy=x*4,y*4;floor=surf(wx)
  if wx<75:floor=340+round(math.cos(wx/28)*8/4)*4
  if wx>1135:floor=340+round(math.cos(wx/28)*8/4)*4
  if wy<floor or 663<wy<780:continue
  mat=0 if wy<370+math.sin(wx/70)*16 else 1
  shift=math.sin(wy/37)*9+math.sin(wy/19)*5
  if 80+shift<wx<265+shift:mat=147 if wy<floor+22 else 161
  if 515+shift<wx<685+shift and wy<540:mat=53 if wy<floor+20 else 397 if wy<floor+75 else 396
  if 685+shift<wx<810+shift and wy<505:mat=25
  if 810+shift<wx<1020+shift and wy<615:mat=59
  if 1020+shift<wx<1135+shift and wy<535:mat=203
  if wy>=780:mat=57
  if wy==floor and wy<350:mat=surface_kind(wx)
  grid[y][x]=mat
# Winding worms: narrow passages connect irregular chambers, not rectangular cutouts.
for i in range(105):
 x=rng.uniform(18,282);y=rng.uniform(83,159);direction=rng.uniform(0,math.tau)
 for step in range(rng.randint(12,65)):
  radius=rng.uniform(1.2,2.7)+(1 if i%9==0 else 0)
  for yy in range(max(0,int(y-radius)),min(165,int(y+radius)+1)):
   for xx in range(max(0,int(x-radius)),min(NX,int(x+radius)+1)):
    if ((xx-x)/radius)**2+((yy-y)/(radius*.75))**2<1 and yy*4>surf(xx*4)+20:grid[yy][xx]=None
  direction+=rng.uniform(-.45,.45);x+=math.cos(direction);y+=math.sin(direction)*.5
  if not(10<x<290 and 82<y<161):break
# Wider mushroom grotto; jungle shafts and evil chasms.
for y in range(133,156):
 for x in range(140,198):
  if ((x-169)/30)**2+((y-145)/10)**2<1:grid[y][x]=None
for cx in [178,193,265]:
 for y in range(65,124):
  x=cx+round(math.sin(y/8)*2)
  for xx in range(x-2,x+3):
   if 0<=xx<NX:grid[y][xx]=None
# Deposits occupy real tile patches, not scattered item icons.
for i in range(380):
 x=rng.randint(8,NX-9);y=rng.randint(80,163);mat=[6,7,8,9,22,56][i%6]
 if 680<x*4<810:mat=22
 if 1020<x*4<1135:mat=203 if i%2 else 8
 for dy in range(-2,3):
  for dx in range(-3,4):
   if dx*dx+dy*dy*1.6<rng.uniform(3,10) and grid[y+dy][x+dx]!=None:grid[y+dy][x+dx]=mat
# Dungeon corridors, rooms and platforms.
for y in range(83,149):
 cx=49+round(math.sin(y/12)*5)
 for x in range(cx-9,cx+10):
  grid[y][x]=41 if abs(x-cx)>=7 or y%14 in [0,1] else None
  if y%14 in [0,1] and abs(x-cx)<2:grid[y][x]=None
# Cloud islands with soil and grass caps.
for cx,cy in [(122,34),(188,40)]:
 for y in range(cy-2,cy+8):
  for x in range(cx-17,cx+18):
   if ((x-cx)/18)**2+((y-cy)/7)**2<=1:grid[y][x]=2 if y==cy-2 else 0 if y<cy+1 else 189
# Building grid used in BOTH world and close-up; no unrelated reference photos.
BUILDINGS=[dict(id='forest',name='Дом путешественника',x=382,y=surf(410),w=18,h=10,mat=30,wall=4,roof=30),dict(id='snow',name='Снежное шале',x=180,y=surf(205),w=16,h=11,mat=30,wall=4,roof=147),dict(id='sky',name='Дом над облаками',x=727,y=152,w=15,h=9,mat=202,wall=5,roof=202),dict(id='jungle',name='Дом на сваях',x=922,y=surf(953)-8,w=18,h=10,mat=191,wall=4,roof=192)]
# Flat foundations and clear rooms; the jungle variant has support posts.
for b in BUILDINGS:
 for x in range(b['x']//4,b['x']//4+b['w']):
  floor=round(b['y']/4)
  for y in range(max(0,floor-b['h']),floor):grid[y][x]=None
  if b['id']!='jungle':
   for y in range(floor,min(200,math.ceil(surf(x*4)/4)+2)):grid[y][x]=1
shadow=Image.new('RGBA',(32,32))
for yy in range(2):
 for xx in range(2):paste(shadow,art['Tiles_21.png'].crop((108+xx*18,yy*18,124+xx*18,yy*18+16)),xx*16,yy*16)
shadow.save(OUT/'shadow-chest.webp',lossless=True)
def building(b,furniture=True):
 bw,bh=b['w'],b['h'];im=Image.new('RGBA',((bw+8)*16,(bh+8)*16));d=ImageDraw.Draw(im);ox,oy=4*16,5*16
 for y in range(bh):
  for x in range(bw):
   edge=y in [0,bh-1] or x in [0,bw-1];kind=b['mat'];src=tile(kind,18+(x%3)*18,18)
   if edge:paste(im,src,ox+x*16,oy+y*16)
   else:paste(im,wall(b['wall']),ox+x*16,oy+y*16)
 # Sloped roof follows a per-tile triangle, using actual edge pixels.
 for x in range(-2,bw+2):
  roofy=-1-round((1-abs(x-(bw-1)/2)/(bw/2+2))*4)
  for y in range(roofy,0):paste(im,tile(b['roof'],18+(x%3)*18,0 if y==roofy else 18),ox+x*16,oy+y*16)
 # Glass windows and wood crossbars.
 for wx in [3,bw-6]:
  for y in range(3,6):
   for x in range(wx,wx+3):
    paste(im,tile(54,18,18),ox+x*16,oy+y*16)
    d.rectangle((ox+x*16,oy+y*16,ox+x*16+15,oy+y*16+15),fill=(107,166,198,80))
  d.line((ox+(wx+1.5)*16,oy+3*16,ox+(wx+1.5)*16,oy+6*16),fill='#694d35',width=3)
 # Door: closed wooden door, 3 native frames.
 for j in range(3):paste(im,art['Tiles_10.png'].crop((0,j*18,16,j*18+16)),ox+(bw-1)*16,oy+(bh-4+j)*16)
 if furniture:
  objects=[(18,0,0,32,16,2,bh-2),(14,0,0,48,32,7,bh-3),(15,0,0,16,32,10,bh-3),(17,0,0,48,32,bw-5,bh-3),(21,36,0,32,32,4,bh-3)]
  for tid,sx,sy,w,h,x,y in objects:
   # Object tiles are separated by 2px gutters; join native 16px frames.
   for yy in range(h//16):
    for xx in range(w//16):paste(im,art[f'Tiles_{tid}.png'].crop((sx+xx*18,sy+yy*18,sx+xx*18+16,sy+yy*18+16)),ox+(x+xx)*16,oy+(y+yy)*16)
  for x in [1,bw-3]:paste(im,art['Tiles_4.png'].crop((0,0,20,20)),ox+x*16,oy+2*16)
 return im
# Emit building close-ups as independent lossless layers, same pixels as map.
for b in BUILDINGS:
 for mode in ['room','shell']:building(b,mode=='room').save(OUT/f"house-{b['id']}-{mode}.webp",lossless=True)
(OUT/'buildings.json').write_text(json.dumps([{k:v for k,v in b.items() if k not in ['mat','wall','roof']} for b in BUILDINGS],ensure_ascii=False))
def render(hard):
 im=Image.new('RGBA',(W,H));d=ImageDraw.Draw(im)
 # Sky sampled directly from the original sky texture; original distant mountains.
 sky=art['Background_0.png'].resize((W,round(1400*.8)),Image.Resampling.NEAREST);paste(im,sky,0,0)
 for x in range(-800,W,1024):paste(im,art['Background_7.png'],x,267*S-435)
 for left,right,bg in [(75,265,12),(265,515,10),(810,1020,11)]:
  layer=Image.new('RGBA',((right-left)*S,500));s=art[f'Background_{bg}.png']
  for x in range(0,layer.width,s.width):paste(layer,s,x,500-s.height)
  paste(im,layer,left*S,267*S-500)
 d.rectangle((0,285*S,75*S,360*S),fill='#385a87');d.rectangle((1135*S,280*S,W,360*S),fill='#385a87')
 d.rectangle((0,320*S,W,H),fill='#191a24')
 d.rectangle((0,285*S,75*S,345*S),fill='#315f9e');d.rectangle((1135*S,280*S,W,345*S),fill='#315f9e')
 # Cavern background/wall texture; dim but readable like an illuminated game view.
 bg=ImageEnhance.Brightness(art['Background_3.png']).enhance(.30)
 for y in range(315*S,H,bg.height):
  for x in range(0,W,bg.width):paste(im,bg,x,y)
 d.rectangle((0,665*S,W,H),fill='#21191d')
 cave=ImageEnhance.Brightness(wall(1)).enhance(.35);jwall=ImageEnhance.Brightness(wall(15)).enhance(.45)
 for y in range(80,165):
  for x in range(NX):
   if grid[y][x] is None and ((x*4>810 and x*4<1020) or x*4<265):paste(im,jwall if x*4>810 else cave,x*16,y*16)
 def solid(x,y):return 0<=x<NX and 0<=y<NY and grid[y][x] is not None
 for y in range(NY):
  for x in range(NX):
   mat=grid[y][x]
   if mat is None:continue
   if hard and 440<x*4<590 and 340<y*4<530:mat=117 if mat==1 else mat
   if 570<x*4<785 and 540<y*4<630 and y>142:mat=70 if not solid(x,y-1) else 59
   if y*4>770 and mat==57 and (x+y)%11<3:mat=58
   paste(im,frame(mat,x,y,solid),x*16,y*16)
 # Foliage, native tree trunks/tops. Each source pixel stays unfiltered.
 for wx in [93,116,143,167,225,250,277,300,330,355,445,470,494,708,740,777,832,856,887,911,1002,1034,1060,1093,1120,65,1140]:
  kind=3 if wx<265 and wx>75 else 1 if 685<wx<810 else 2 if 810<wx<1020 else 5 if 1020<wx<1135 else 6 if wx<80 or wx>1135 else 0
  top=art[f'Tree_Tops_{kind}.png'];fw=116 if kind==2 else 82;fh=top.height;head=top.crop((0,0,fw,fh))
  height=180+(wx*7%100);by=surf(wx)*S
  trunk=art['Tiles_5.png'].crop((0,22,20,42))
  for y in range(by-height,by,20):paste(im,trunk,wx*S-10,y)
  paste(im,head,wx*S-fw//2,by-height-fh+12)
  if kind in [0,1,2]:
   branches=art[f'Tree_Branches_{kind}.png'];paste(im,branches.crop((0,0,42,42)),wx*S-40,by-height+45)
 # Plants, cacti and glowing mushrooms.
 for x in range(20,NX-20):
  wx=x*4;sy=surf(wx)
  if 515<wx<685:
   if x%7==0:
    for k in range(4+(x%3)):paste(im,art['Tiles_80.png'].crop((0,18,16,34)),x*16,int(sy*S)-k*16-16)
  elif x%2==0:
   tid=61 if 810<wx<1020 else 201 if 1020<wx<1135 else 3
   if not(80<wx<265 or 680<wx<810):paste(im,art[f'Tiles_{tid}.png'].crop(((x%15)*18,0,(x%15)*18+16,22)),x*16,int(sy*S)-22)
 for wx,wy in [(605,595),(635,610),(665,580),(705,598),(747,610)]:
  for k in range(5):paste(im,art['Tiles_72.png'].crop((0,18,16,34)),wx*S,wy*S-16*k)
  cap=art['Shroom_Tops.png'].crop((0,0,60,42));paste(im,cap,wx*S-22,wy*S-101)
 # Dungeon wall lining and room sconces.
 for y in range(87,145):
  cx=49+round(math.sin(y/12)*5)
  for x in range(cx-6,cx+7):
   if grid[y][x] is None:paste(im,ImageEnhance.Brightness(wall(7)).enhance(.8),x*16,y*16)
 # Underworld's original lava texture, with ash islands and ruined towers.
 lava=art['Liquid_1.png'].crop((0,0,16,16))
 for x in range(NX):
  level=181+round(math.sin(x/12)*2)
  for y in range(level,195):paste(im,lava if y==level else Image.new('RGBA',(16,16),lava.getpixel((8,15))),x*16,y*16)
 for wx in [100,290,490,700,900,1090]:
  for y in range(172,183):
   for x in range(wx//4-4,wx//4+5):
    if x in [wx//4-4,wx//4+4] or y in [172,177,182]:paste(im,tile(75 if wx%3 else 76),x*16,y*16)
    elif (x+y)%13!=0:paste(im,ImageEnhance.Brightness(wall(14)).enhance(.75),x*16,y*16)
 for b in BUILDINGS:
  if b['id']=='jungle':
   for wx in [b['x']+4,b['x']+b['w']*4-8]:
    for wy in range(round(b['y']),round(surf(wx))+12,4):paste(im,tile(124,0,18),wx*S,wy*S)
  src=building(b);paste(im,src,b['x']*S-64,b['y']*S-(b['h']+5)*16)
 # Vines in hanging jungle passages.
 for x in range(208,252,3):
  for y in range(85,140):
   if grid[y][x] is not None and grid[y+1][x] is None:
    for j in range(1,5):
     if grid[y+j][x] is None:paste(im,art['Tiles_62.png'].crop((0,0,16,16)),x*16,(y+j)*16)
    break
 # Local, soft lighting at torches (not a claim to reproduce engine lighting).
 glow=Image.new('RGBA',im.size);gd=ImageDraw.Draw(glow)
 for wx,wy in [(310,400),(425,460),(530,530),(790,420),(940,480),(1070,550),(195,390),(200,470),(190,550),(610,590),(680,600)]:
  for r in range(85,0,-3):gd.ellipse((wx*S-r,wy*S-r,wx*S+r,wy*S+r),fill=(255,180,60,int((1-r/86)*22)))
  paste(im,art['Tiles_4.png'].crop((0,0,20,20)),wx*S,wy*S)
 im=Image.alpha_composite(im,glow)
 if hard:im.crop((440*S,340*S,596*S,536*S)).convert('RGB').save(OUT/'world-hard-overlay.webp',lossless=True,method=6)
 else:im.convert('RGB').save(OUT/'world-early.webp',lossless=True,method=6)
 # Low-res inspection output is scratch only.
 im.resize((1200,800),Image.Resampling.NEAREST).save(f"/tmp/atlas-world-{'hard' if hard else 'early'}.png")
render(False);render(True)
art['NPC_195.png'].crop((0,0,20,46)).save(OUT/'lost-girl.webp',lossless=True)
for name in ['Cloud_0.png','Cloud_1.png','Sun.png']:art[name].save(OUT/(name.replace('.png','.webp')),lossless=True)
print('Rendered original-texture reference landscape and 4 matching building close-ups:',OUT)
