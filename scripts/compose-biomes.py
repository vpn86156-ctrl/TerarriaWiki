from PIL import Image,ImageDraw,ImageEnhance
from pathlib import Path
import random
out=Path('public/images/biomes');out.mkdir(parents=True,exist_ok=True)
scenes=[('meadow','#243f42','#1c352d',[7,8,285]),('forest','#153940','#132a24',[8,9,286]),('moonforest','#101931','#101f2b',[8,10]),('corruption','#211330','#2d1536',[41,43,44]),('jungle','#112f29','#133327',[53,54,55]),('dungeon','#101b2e','#283143',[]),('underworld','#3b0c16','#6b1a15',[]),('snow','#152a3c','#244153',[35,98,100]),('deepjungle','#10271f','#14382c',[54,55]),('temple','#302017','#4a3522',[]),('celestial','#07172b','#193040',[211,213])]
W,H=960,540
for idx,(name,top,bot,layers) in enumerate(scenes):
 def rgb(s):return tuple(bytes.fromhex(s[1:]))
 a,b=rgb(top),rgb(bot);im=Image.new('RGB',(W,H));d=ImageDraw.Draw(im)
 for y in range(H):d.line((0,y,W,y),fill=tuple(int(a[k]+(b[k]-a[k])*y/H) for k in range(3)))
 rng=random.Random(idx+4)
 if idx in [0,1,2,7,10]:
  for _ in range(80):
   x=rng.randrange(W);y=rng.randrange(300);d.rectangle((x,y,x+1,y+1),fill=(100,135,145))
 if idx in [0,2,10]:
  x,y=(745,105);r=44 if idx!=10 else 75;d.ellipse((x-r,y-r,x+r,y+r),fill=('#f2dcb1' if idx==0 else '#b7d5d7'))
 for order,n in enumerate(layers):
  layer=Image.open(f'artwork/biome-layers/Background_{n}.png').convert('RGBA')
  h=(260+order*70) if idx!=6 else 390+order*70
  ratio=h/layer.height;layer=layer.resize((int(layer.width*ratio),h),Image.Resampling.NEAREST)
  layer=ImageEnhance.Brightness(layer).enhance(.55 if idx in [2,3,10] else .8)
  # Repeat side by side, preserving the original pixel aspect ratio.
  for x in range(-layer.width//3,W,layer.width):im.paste(layer,(x,H-h),layer)
 d=ImageDraw.Draw(im)
 if idx in [5,9]:
  tex=Image.open(f'artwork/biome-layers/Background_{119 if idx==5 else 84}.png').convert('RGB');tex=tex.resize((320,320),Image.Resampling.NEAREST)
  for x in range(0,W,320):
   for y in range(0,H,320):im.paste(tex,(x,y))
  shade=Image.new('RGB',(W,H),top);im=Image.blend(im,shade,.56);d=ImageDraw.Draw(im)
  for x in [64,280,600,820]:
   col='#293948' if idx==5 else '#685330';d.rectangle((x,90,x+48,H),fill=col);d.rectangle((x-14,80,x+62,106),fill=col)
   d.rectangle((x+12,110,x+17,H),fill='#0e1a25' if idx==5 else '#29271a')
  if idx==9:
   d.polygon([(350,400),(480,200),(610,400)],fill='#786435');d.polygon([(390,400),(480,260),(570,400)],fill='#22342a')
 if idx==6:
  tex=Image.open('artwork/biome-layers/Background_6.png').convert('RGB').resize((384,198),Image.Resampling.NEAREST)
  for x in range(0,W,384):
   for y in range(0,H,198):im.paste(tex,(x,y))
  im=Image.blend(im,Image.new('RGB',(W,H),'#5c1010'),.56);d=ImageDraw.Draw(im)
  for x,h in [(0,140),(120,180),(240,100),(720,160),(850,200)]:
   d.polygon([(x,0),(x+30,h),(x+55,h-40),(x+75,0)],fill='#1d0d14')
  for x,h in [(40,150),(200,100),(500,140),(700,190)]:
   d.rectangle((x,H-h,x+26,H),fill='#200f16');d.rectangle((x-8,H-h-10,x+34,H-h+10),fill='#28121b')
  d.rectangle((0,H-38,W,H),fill='#b63b16');d.rectangle((0,H-35,W,H-28),fill='#ffa632')
  for _ in range(38):
   x=rng.randrange(W);y=rng.randrange(60,H);d.rectangle((x,y,x+2,y+5),fill='#e97937')
 im.save(out/f'{name}.webp',quality=88,method=6)
 print(name,(out/f'{name}.webp').stat().st_size)
