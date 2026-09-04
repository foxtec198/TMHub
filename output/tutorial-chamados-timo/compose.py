"""Render the local TMHub demonstration as a narrated Full HD video.

No production requests. Uses captured real React components, demo data,
the existing Timo GLB animations, and local pt-BR synthetic speech.
"""
from pathlib import Path
import json, math, subprocess, wave, textwrap, sys
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT=Path(__file__).resolve().parent
FF=ROOT/'vendor/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
for folder in ('boards','segments'): (ROOT/folder).mkdir(exist_ok=True)
GREEN='#66efad'; WHITE='#f2faf6'; MUTED='#9bb5a7'
FONT=Path('C:/Windows/Fonts')
def font(size,bold=False):return ImageFont.truetype(str(FONT/('segoeuib.ttf' if bold else 'segoeui.ttf')),size)
def run(args):
    p=subprocess.run([str(FF),'-hide_banner','-loglevel','error','-y',*map(str,args)],capture_output=True,text=True)
    if p.returncode:raise RuntimeError(p.stderr)
def fitlines(draw,text,f,width):
    lines=[];line=''
    for word in text.split():
        new=(line+' '+word).strip()
        if draw.textlength(new,font=f)>width and line:lines.append(line);line=word
        else:line=new
    if line:lines.append(line)
    return lines

TITLES=['Como abrir e acompanhar um chamado','Confira a filial e acesse Chamados','Abra um chamado com um título claro','Explique o que aconteceu','Revise e envie a solicitação','Acompanhe e mantenha a conversa','Encontre o chamado quando precisar']
STEPS=['BOAS-VINDAS','FILIAL E ACESSO','NOVO CHAMADO','MOTIVO E DESCRIÇÃO','REVISÃO E ENVIO','ACOMPANHAMENTO','BUSCA E ENCERRAMENTO']
SCREENS={4:'01-central',5:'01-central',6:'01-central',7:'01-central',8:'02-form',9:'02-form',10:'03-title',11:'03-title',12:'03-title',13:'03-title',14:'04-reason',15:'05-description',16:'05-description',17:'05-description',18:'05-description',19:'05-description',20:'05-description',21:'05-description',22:'06-confirmation',23:'07-detail',24:'07-detail',25:'07-detail',26:'07-detail',27:'08-comment',28:'09-sent',29:'10-list',30:'11-search',31:'13-all',32:'13-all',33:'01-central',34:'10-list'}

def board(item,subtitle=True):
    idx=item['index'];ch=item['chapter'];im=Image.new('RGB',(1920,1080),'#060c0a');d=ImageDraw.Draw(im)
    # Quiet editorial grid, dark glass cards, emerald brand accents.
    for x in range(0,1920,80):d.line((x,0,x,940),fill='#0d1913')
    for y in range(0,940,80):d.line((0,y,1920,y),fill='#0d1913')
    d.rounded_rectangle((35,28,1885,143),24,fill='#0e1c15',outline='#284937',width=2)
    d.text((62,45),'TMHUB  /  TUTORIAL COM TIMO',font=font(19,True),fill=GREEN)
    d.text((60,77),TITLES[ch-1],font=font(40,True),fill=WHITE)
    d.text((1570,53),f'{ch:02d} / 07',font=font(34,True),fill=GREEN)
    d.text((1570,102),'CENÁRIO FICTÍCIO',font=font(16,True),fill=MUTED)
    d.rounded_rectangle((35,168,411,918),25,fill='#102019',outline='#254a36',width=2)
    d.text((66,202),'TIMO',font=font(47,True),fill=WHITE)
    d.text((67,264),'Seu guia no TMHub',font=font(21),fill=MUTED)
    d.ellipse((99,811,342,854),fill='#17472f',outline='#297b50',width=2)
    d.text((67,873),'PASSO A PASSO',font=font(19,True),fill=GREEN)
    screen_rect=(439,168,1885,918)
    d.rounded_rectangle(screen_rect,24,fill='#08100c',outline='#31553e',width=2)
    if idx<4 or idx==35:
        thumb=Image.open(ROOT/'../../public/obs/courses/posters/thumbnail-abertura-chamados.png').convert('RGB')
        thumb=ImageOps.fit(thumb,(1426,730))
        im.paste(thumb,(449,178));d=ImageDraw.Draw(im)
        d.rounded_rectangle((497,758,1836,880),20,fill='#0d2119',outline='#4faa7b',width=2)
        title='Abra. Descreva. Acompanhe.' if idx<4 else 'Tudo organizado no mesmo chamado.'
        d.text((530,787),title,font=font(43,True),fill=WHITE)
    else:
        screen=Image.open(ROOT/'screens'/f'{SCREENS[idx]}.png').convert('RGB')
        if 8<=idx<=21:crop=(399,196,1044,694)
        elif idx in (4,5,6):crop=(0,0,1000,520)
        elif idx==25:crop=(200,661,541,858)
        elif idx in (26,27,28):crop=(532,280,1403,900)
        elif idx==23:crop=(188,105,1402,318)
        elif idx==24:crop=(195,205,1402,850)
        elif idx==30:crop=(195,377,1408,725)
        elif idx in (7,29,31,32,33,34):crop=(172,97,1420,745)
        else:crop=(0,0,1440,850)
        screen_height=650 if idx in (26,27,28) else 688
        center_y=512 if idx in (26,27,28) else 537
        screen=screen.crop(crop);screen.thumbnail((1400,screen_height),Image.Resampling.LANCZOS)
        # Upscale tight crop for readable on-screen controls.
        factor=min(1400/screen.width,screen_height/screen.height)
        screen=screen.resize((int(screen.width*factor),int(screen.height*factor)),Image.Resampling.LANCZOS)
        xy=(1162-screen.width//2,center_y-screen.height//2);im.paste(screen,xy);d=ImageDraw.Draw(im)
        tips={4:'Uma filial por solicitação',5:'O seletor depende do acesso da sua conta',6:'Menu lateral → Chamados',7:'Central de Chamados',8:'Novo chamado → Abrir novo chamado',9:'Título: curto e objetivo',10:'Exemplo fictício: erro ao abrir relatório',11:'Evite “ajuda” ou “urgente” sem contexto',12:'Um bom título facilita o atendimento',13:'Motivo é opcional',14:'Sem opção adequada? Deixe em branco',15:'Descrição: explique o contexto',16:'Tela → tentativa → resultado → expectativa',17:'Transcreva a mensagem de erro',18:'Clareza ajuda a equipe a entender',19:'Nunca inclua senhas ou dados sensíveis',20:'Título e descrição são obrigatórios',21:'Abrir chamado cria o registro',22:'Confirmação e página de acompanhamento',23:'Guarde o número do chamado',24:'Prazo exibido ≠ garantia de solução em 24 horas',25:'Ainda não há um responsável atribuído',26:'Todas as atualizações no mesmo histórico',27:'Mensagem: depende da permissão e do status',28:'Complemente o chamado existente',29:'Voltar aos chamados',30:'Busque pelo número ou título',31:'Ver todos amplia a consulta',32:'Solicitação registrada. Histórico organizado.',33:'Filial → Chamados → Novo chamado → Enviar',34:'Acompanhe o atendimento pela central'}
        d.rounded_rectangle((461,859,1863,905),10,fill='#173728')
        tip=tips.get(idx,'Demonstração local, sem registro em produção')
        d.text((483,865),tip,font=font(25,True),fill=GREEN)
    # Seven-position chapter tracker.
    for n in range(7):
        x=56+n*50;d.rounded_rectangle((x,837,x+34,843),3,fill=GREEN if n<ch else '#294535')
    d.rounded_rectangle((35,939,1885,1050),18,fill='#111e18',outline='#365541',width=2)
    if subtitle:
        lines=fitlines(d,item['text'],font(32),1760)
        y=951+(84-len(lines)*41)//2
        for line in lines:
            w=d.textlength(line,font=font(32));d.text(((1920-w)/2,y),line,font=font(32),fill=WHITE);y+=41
    d.text((44,1058),'Demonstração local • voz sintética pt-BR • nenhum chamado criado em produção',font=font(13),fill='#789181')
    return im

def stamp(t):
    ms=round(t*1000);return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}'

def main():
    narration=json.loads((ROOT/'narration.json').read_text(encoding='utf-8-sig'))
    timeline=[];elapsed=2.0;srt=[]
    for item in narration:
        with wave.open(str(ROOT/'audio'/item['file'])) as wav:seconds=wav.getnframes()/wav.getframerate()/1.12
        pause=0.32
        if item['index'] in (3,7,12,19,23,28,35):pause+=0.75
        if item['index']==18:pause+=2
        duration=math.ceil((seconds+pause)*24)/24
        item.update(start=elapsed,duration=duration,speech_duration=seconds)
        srt.append(f"{len(srt)+1}\n{stamp(elapsed)} --> {stamp(elapsed+seconds)}\n"+'\n'.join(textwrap.wrap(item['text'],80))+'\n')
        elapsed+=duration;timeline.append(item)
        board(item).save(ROOT/'boards'/f"{item['index']:03}.png")
    (ROOT/'legendas.srt').write_text('\n'.join(srt),encoding='utf-8')
    (ROOT/'timeline.json').write_text(json.dumps(timeline,ensure_ascii=False,indent=2),encoding='utf-8')
    preview=board(timeline[16]);presenter=Image.open(ROOT/'frames/speaking-0018.png').convert('RGBA');preview.paste(presenter,(-1,276),presenter);preview.save(ROOT/'previa.png')
    print(f'Boards ready. Target duration: {elapsed+3:.2f}s',flush=True)
    if '--preview-only' in sys.argv:return
    for name,count in [('speaking',96),('wave',100)]:
        mov=ROOT/f'{name}.mov'
        if not mov.exists():run(['-framerate','24','-i',ROOT/f'frames/{name}-%04d.png','-frames:v',count,'-c:v','qtrle','-pix_fmt','argb',mov])
    # Intro / outro retain the existing course thumbnail.
    thumb=ROOT/'../../public/obs/courses/posters/thumbnail-abertura-chamados.png'
    for name,dur in [('intro',2),('outro',3)]:
        run(['-loop','1','-framerate','24','-i',thumb,'-f','lavfi','-i','anullsrc=r=48000:cl=stereo','-t',dur,'-vf','scale=1920:1080,setsar=1','-c:v','libx264','-preset','veryfast','-crf','22','-pix_fmt','yuv420p','-c:a','aac','-ar','48000','-ac','2',ROOT/f'segments/{name}.mp4'])
    for item in timeline:
        idx=item['index'];out=ROOT/f'segments/{idx:03}.mp4'
        if out.exists() and not ('--redo-comment' in sys.argv and idx in (26,27,28)):continue
        motion='wave' if idx<4 or idx==35 else 'speaking'
        filt=f"[0:v][1:v]overlay=-1:276:shortest=1[v];[2:a]atempo=1.12,apad,aresample=48000[a]"
        run(['-loop','1','-framerate','24','-i',ROOT/f'boards/{idx:03}.png','-stream_loop','-1','-i',ROOT/f'{motion}.mov','-i',ROOT/'audio'/item['file'],'-filter_complex',filt,'-map','[v]','-map','[a]','-t',f"{item['duration']:.6f}",'-r','24','-c:v','libx264','-preset','veryfast','-crf','22','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-ar','48000','-ac','2',out])
        print(f'Rendered {idx+1:02}/36 | chapter {item["chapter"]}',flush=True)
    files=[ROOT/'segments/intro.mp4']+[ROOT/f'segments/{x["index"]:03}.mp4' for x in timeline]+[ROOT/'segments/outro.mp4']
    (ROOT/'concat.txt').write_text('\n'.join("file '"+p.as_posix()+"'" for p in files),encoding='utf-8')
    final=ROOT/'TMHub-Chamados-com-Timo.mp4'
    run(['-f','concat','-safe','0','-i',ROOT/'concat.txt','-c','copy','-movflags','+faststart','-metadata','title=Como abrir e acompanhar um chamado no TMHub','-metadata','comment=Demonstração local com Timo 3D e voz sintética pt-BR. Sem dados reais.',final])
    print(f'FINAL: {final} ({final.stat().st_size/1024**2:.1f} MiB)',flush=True)

if __name__=='__main__':main()
