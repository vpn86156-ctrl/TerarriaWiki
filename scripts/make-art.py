"""Author composition using unchanged Terraria tile/sprite pixels. Optional Pillow tool, not part of build."""
from PIL import Image,ImageDraw
import json,random
from pathlib import Path
root=Path(__file__).resolve().parents[1]; public=root/'public'; random.seed(43)
d=json.load(open(root/'src/data/catalog.json')); by={i['key']:i for i in d['items']}
def sprite(icon):
 s,x,y,w,h=d['sprites']['icons'][icon.split('/')[-1]]
 return Image.open(public/'images'/Path(d['sprites']['sheets'][s]['file']).name).convert('RGBA').crop((x,y,x+w,y+h))
def tile(name):
 im=Image.open(public/'images/source-tiles'/name).convert('RGBA')
 return im.crop((18,18,34,34)) if name.startswith('Tiles') else im.crop((40,40,56,56))
wood=tile('Tiles_30.png');trunk=tile('Tiles_191.png');leaves=tile('Tiles_192.png');wall=tile('Wall_4.png')
im=Image.new('RGBA',(640,400)); dr=ImageDraw.Draw(im)
for y in range(400):dr.line((0,y,640,y),fill=(int(35-y*.035),int(67-y*.055),int(87-y*.06),255))
# Atmospheric backdrop, then an original arrangement of game tiles. Not a gameplay screenshot.
for x,y in [(65,75),(180,43),(512,52)]:
 for a,b,w,h in [(0,8,55,10),(12,0,30,12),(45,12,22,7)]:dr.rectangle((x+a,y+b,x+a+w,y+b+h),fill=(114,143,143,60))
for cx,cy,rx,ry in [(125,235,105,82),(497,218,155,95)]:dr.ellipse((cx-rx,cy-ry,cx+rx,cy+ry),fill='#25453f')
def put(t,x,y):im.alpha_composite(t,(int(x),int(y)))
for y in range(320,400,16):
 for x in range(0,640,16):put(sprite(by['DirtBlock']['icon']).resize((16,16),Image.Resampling.NEAREST),x,y)
# Branching living tree.
for y in range(140,330,16):
 for x in range(288-(y//48%2)*16,352+(y//64%2)*16,16):put(trunk,x,y)
for x,y in [(256,240),(240,224),(224,208),(208,192),(352,224),(368,208),(384,192),(400,176),(272,128),(256,112),(240,96),(336,112),(352,96)]:put(trunk,x,y)
for cx,cy,rx,ry in [(240,106,110,66),(370,90,110,70),(432,138,88,65),(174,154,68,49)]:
 for y in range(cy-ry,cy+ry,16):
  for x in range(cx-rx,cx+rx,16):
   if ((x-cx)/rx)**2+((y-cy)/ry)**2<1:put(leaves,x,y)
# A wooden room resting on the broad living branch.
for y in range(144,240,16):
 for x in range(288,464,16):put(wall,x,y)
for x in range(272,480,16):put(wood,x,128);put(wood,x,240)
for y in range(144,240,16):put(wood,272,y);put(wood,464,y)
# Sloping roof made from unchanged wood tiles.
for row in range(3):
 for x in range(256+row*16,496-row*16,16):put(wood,x,128-row*16)
# Windows and authentic interior objects.
dr=ImageDraw.Draw(im)
for x in [306,402]:
 dr.rectangle((x,162,x+28,192),fill='#54797d',outline='#bba97a',width=3);dr.line((x+14,164,x+14,191),fill='#bba97a',width=2);dr.line((x,178,x+28,178),fill='#bba97a',width=2)
for key,x,y,scale in [('WoodenChair',349,211,1.6),('WorkBench',374,215,1.6),('Torch',295,198,1.6)]:
 s=sprite(by[key]['icon']);s=s.resize((round(s.width*scale),round(s.height*scale)),Image.Resampling.NEAREST);put(s,x,y)
guide=next(n for n in d['npcs'] if n['id']=='Guide');s=sprite(guide['icon']);s.thumbnail((26,47),Image.Resampling.NEAREST);put(s,424,240-s.height)
for y in range(256,321,16):put(wood,448,y)
for x in range(0,640,16):put(sprite(by['GrassSeeds']['icon']).resize((12,12),Image.Resampling.NEAREST),x,313)
im.convert('RGB').save(public/'images/treehouse.webp',quality=90,method=6)
# Fan companion icon: authentic Acorn sprite, not an imitation of Terraria's official logo.
icon=Image.new('RGBA',(192,192),'#121c21');p=ImageDraw.Draw(icon);p.rounded_rectangle((8,8,184,184),radius=38,fill='#23352a',outline='#a0be64',width=3)
s=sprite(by['Acorn']['icon']);s.thumbnail((100,115));s=s.resize((s.width*5,s.height*5),Image.Resampling.NEAREST);s.thumbnail((115,125),Image.Resampling.NEAREST);icon.alpha_composite(s,((192-s.width)//2,(192-s.height)//2))
for name,size in [('icon-192.png',192)]:icon.resize((size,size),Image.Resampling.NEAREST).save(public/'icons'/name)
print('Created author treehouse composition and fan icons.')
