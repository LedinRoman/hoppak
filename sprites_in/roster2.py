from PIL import Image, ImageDraw, ImageFont
import numpy as np
from scipy import ndimage
B='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'; R='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
F1=ImageFont.truetype(B,40);F2=ImageFont.truetype(B,26);F3=ImageFont.truetype(R,21);FT=ImageFont.truetype(B,54)
heroes=[
 ('gpt1.png',(0,0,260,325),(1220,0,1536,325),'КАПИТАН','Стартовый, бесплатно','Рывок ранцем','Короткий быстрый\nвзлёт вверх.\nТип: движение'),
 ('gpt2.png',(0,0,260,325),(1220,0,1536,325),'ПИРАТ','Покупной','Крюк-кошка','Тянет к ближайшей\nплатформе или монете\nпо дуге, сбивает моба.\nТип: манёвр'),
 ('gpt3.png',(0,0,260,325),(1220,0,1536,325),'РОБОТ','Покупной','Космощит','Отражает мобов\nи снаряды, один раз\nспасает от падения.\nТип: защита'),
 ('gpt4.png',(0,0,260,325),(1220,0,1536,325),'РЫЦАРЬ','Покупной','Таран щитом','Пике вниз: давит мобов,\nс платформы даёт\nсуперпрыжок x2.\nТип: риск и награда'),
 ('mage.jpg',(0,0,230,280),(930,0,1152,280),'МАГ','Покупной','Телепорт','Мгновенно переносится\nна платформу выше.\nТип: перемещение'),
 ('ninja.jpg',(0,0,200,260),(925,40,1152,260),'НИНДЗЯ','Покупной','Прыжок от стен','Цепляется за край\nэкрана и отталкивается.\nТип: контроль\nдвижения'),
]
def cut(src,box,raw=False):
    if raw:
        im=src.crop(box).convert('RGBA');return im
    im=src.crop(box).convert('RGBA');a=np.array(im).astype(int)
    rgb=a[...,:3];al=a[...,3]
    mx=rgb.max(-1);mn=rgb.min(-1);sat=mx-mn
    white=(mn>225)
    fg=(al>205)&~white
    lab,n=ndimage.label(ndimage.binary_closing(fg,iterations=2))
    if n==0: return im
    sizes=ndimage.sum(fg,lab,range(1,n+1));big=1+int(np.argmax(sizes))
    keep=np.zeros_like(fg)
    for k in range(1,n+1):
        if k==big: keep|=(lab==k)
    keep&=fg
    out=a.copy();out[...,3]=np.where(keep,255,0)
    o=Image.fromarray(out.astype('uint8'),'RGBA');return o.crop(o.getbbox())
CW,CH=900,420;W=CW*2+60;H=150+CH*3+40
img=Image.new('RGB',(W,H),(28,32,58));d=ImageDraw.Draw(img)
d.text((W//2,75),'ХОППАК: ГЕРОИ',font=FT,fill=(255,214,90),anchor='mm')
for i,(f,idle,ab,name,price,abn,desc) in enumerate(heroes):
    x=20+(i%2)*(CW+20);y=140+(i//2)*CH
    d.rounded_rectangle((x,y,x+CW,y+CH-20),24,fill=(236,238,248))
    src=Image.open(f)
    d.rounded_rectangle((x+14,y+14,x+530,y+322),18,fill=(52,58,92))
    for j,(bx,w) in enumerate([(idle,230),(ab,260)]):
        s=cut(src,bx,raw=f in ('gpt3.png','gpt4.png'));s.thumbnail((w,290),Image.NEAREST if s.width<w else Image.LANCZOS)
        px=x+20+j*250;img.paste(s,(px+(w-s.width)//2,y+24+(290-s.height)),s)
    d.text((x+20+115,y+335),'обычный вид',font=F3,fill=(110,110,140),anchor='mt');d.text((x+270+130,y+335),'способность',font=F3,fill=(110,110,140),anchor='mt')
    tx=x+560
    d.text((tx,y+30),name,font=F1,fill=(30,30,60))
    d.text((tx,y+82),price,font=F3,fill=(60,140,90) if 'бесп' in price else (180,120,30))
    tw=d.textlength(abn,font=F2)
    d.rounded_rectangle((tx-8,y+122,tx+tw+12,y+166),12,fill=(70,90,200))
    d.text((tx+2,y+129),abn,font=F2,fill='white')
    d.multiline_text((tx,y+188),desc,font=F3,fill=(40,40,70),spacing=8)
img.save('/workspace/jumper/heroes_roster.png');print(img.size)
