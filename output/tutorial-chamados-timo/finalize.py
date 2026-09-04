"""Normalize narration, add chapter markers, and validate the exported MP4."""
from pathlib import Path
import subprocess,json,re
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parent
FF=ROOT/'vendor/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
timeline=json.loads((ROOT/'timeline.json').read_text(encoding='utf-8'))
titles=['Abertura','Filial e acesso','Novo chamado e título','Motivo e descrição','Revisar e enviar','Acompanhar e conversar','Encontrar depois e encerrar']
starts=[next(x['start'] for x in timeline if x['chapter']==n) for n in range(1,8)]
starts[0]=0
end=timeline[-1]['start']+timeline[-1]['duration']+3
metadata=';FFMETADATA1\ntitle=Como abrir e acompanhar um chamado no TMHub\ncomment=Timo 3D, voz sintética pt-BR e dados demonstrativos.\n'
for n,start in enumerate(starts):
    stop=starts[n+1] if n<6 else end
    metadata+=f'[CHAPTER]\nTIMEBASE=1/1000\nSTART={round(start*1000)}\nEND={round(stop*1000)}\ntitle={titles[n]}\n'
(ROOT/'chapters.txt').write_text(metadata,encoding='utf-8')
final=ROOT/'TMHub-Chamados-com-Timo-FullHD.mp4'
args=[str(FF),'-hide_banner','-y','-i',str(ROOT/'TMHub-Chamados-com-Timo.mp4'),'-i',str(ROOT/'chapters.txt'),'-map','0:v:0','-map','0:a:0','-map_metadata','1','-map_chapters','1','-c:v','copy','-af','loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json','-c:a','aac','-b:a','160k','-ar','48000','-movflags','+faststart',str(final)]
proc=subprocess.run(args,capture_output=True,text=True)
(ROOT/'normalization.log').write_text(proc.stderr,encoding='utf-8')
if proc.returncode:raise RuntimeError(proc.stderr)
print('Audio normalized and seven chapters added.',flush=True)
check=subprocess.run([str(FF),'-v','error','-i',str(final),'-f','null','-'],capture_output=True,text=True)
if check.returncode or check.stderr.strip():raise RuntimeError('Decode check: '+check.stderr)
meta=subprocess.run([str(FF),'-hide_banner','-i',str(final)],capture_output=True,text=True).stderr
(ROOT/'video-info.txt').write_text(meta,encoding='utf-8')
sheet=Image.new('RGB',(1920,2160),'#08110b')
for n,idx in enumerate([1,5,10,16,22,27,30,35]):
    time=timeline[idx]['start']+min(2,timeline[idx]['duration']/2)
    target=ROOT/f'qa-{n}.png'
    p=subprocess.run([str(FF),'-v','error','-y','-ss',str(time),'-i',str(final),'-frames:v','1',str(target)],capture_output=True,text=True)
    if p.returncode:raise RuntimeError(p.stderr)
    frame=Image.open(target).resize((960,540),Image.Resampling.LANCZOS)
    sheet.paste(frame,((n%2)*960,(n//2)*540))
sheet.save(ROOT/'validacao-cenas.jpg',quality=90)
print(json.dumps({'video':str(final),'duration':re.search(r'Duration: ([\d:.]+)',meta).group(1),'size_MiB':round(final.stat().st_size/1024**2,2),'full_decode':'passed','chapters':7,'samples':8},ensure_ascii=False),flush=True)
