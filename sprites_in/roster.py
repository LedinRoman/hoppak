from PIL import Image, ImageDraw, ImageFont
B='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'; R='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
F1=ImageFont.truetype(B,40);F2=ImageFont.truetype(B,26);F3=ImageFont.truetype(R,22);FT=ImageFont.truetype(B,54)
heroes=[
 ('gpt1.png',(0,0,260,330),(1180,40,1536,330),'КАПИТАН','Стартовый, бесплатно','Рывок ранцем','Короткий быстрый взлёт вверх.\nТип: движение'),
 ('gpt2.png',(0,0,260,330),(1180,40,1536,330),'ПИРАТ','Покупной','Крюк-кошка','Цепляется за ближайшую платформу\nили монету, тянет по дуге\nи сбивает моба на пути. Тип: манёвр'),
 ('gpt3.png',(0,0,260,330),(1080,0,1536,330),'РОБОТ','Покупной','Космощит','Отражает мобов и снаряды,\nодин раз спасает от падения.\nТип: защита'),
 ('gpt4.png',(0,0,260,330),(1080,0,1536,330),'РЫЦАРЬ','Покупной','Таран щитом','Пике вниз: давит мобов и ломкие\nплатформы, с платформы суперпрыжок x2.\nТип: риск и награда'),
 ('mage.jpg',(0,20,200,260),(820,30,1050,260),'МАГ','Покупной','Телепорт','Мгновенно переносится\nна платформу выше.\nТип: перемещение без физики'),
 ('ninja.jpg',(0,20,170,250),(800,30,1040,250),'НИНДЗЯ','Покупной','Прыжок от стен','Цепляется за край экрана\nи отталкивается от него.\nТип: контроль движения'),
]
CW,CH=900,420;W=CW*2+60;H=150+CH*3+40
img=Image.new('RGB',(W,H),(28,32,58));d=ImageDraw.Draw(img)
d.text((W//2,75),'ХОППАК: ГЕРОИ',font=FT,fill=(255,214,90),anchor='mm')
def fit(im,box):
    im=im.convert('RGBA');im.thumbnail(box,Image.LANCZOS);return im
for i,(f,idle,ab,name,price,abn,desc) in enumerate(heroes):
    x=20+(i%2)*(CW+20);y=140+(i//2)*CH
    d.rounded_rectangle((x,y,x+CW,y+CH-20),24,fill=(236,238,248))
    src=Image.open(f)
    a=fit(src.crop(idle),(230,300));img.paste(a,(x+20,y+20+(300-a.height)),a)
    b=fit(src.crop(ab),(260,300));img.paste(b,(x+260,y+20+(300-b.height)),b)
    d.text((x+20,y+335),'обычный вид',font=F3,fill=(110,110,140));d.text((x+260,y+335),'способность',font=F3,fill=(110,110,140))
    tx=x+545
    d.text((tx,y+30),name,font=F1,fill=(30,30,60))
    d.text((tx,y+82),price,font=F3,fill=(60,140,90) if 'бесп' in price else (180,120,30))
    d.rounded_rectangle((tx-6,y+125,tx+330,y+170),12,fill=(70,90,200))
    d.text((tx+6,y+132),abn,font=F2,fill='white')
    d.multiline_text((tx,y+190),desc,font=F3,fill=(40,40,70),spacing=8)
img.save('/workspace/jumper/heroes_roster.png');print(img.size)
