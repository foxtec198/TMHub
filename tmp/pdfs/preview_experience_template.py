from io import BytesIO
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from reportlab.lib.colors import black
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas


TEMPLATE = Path(r"C:\Users\Bryan Gabriel\Downloads\AVALIAÇÃO PERÍODO DE EXPERIÊNCIA- REVISADA 2025 (28).pdf")
OUTPUT = Path(r"C:\Users\Bryan Gabriel\Desktop\_projetos_\tmhub\output\pdf\avaliacao_experiencia_modelo_preenchido.pdf")


def lines(value, width, font="Helvetica", size=7.5):
    result, current = [], ""
    for word in str(value or "-").split():
        candidate = f"{current} {word}".strip()
        if current and stringWidth(candidate, font, size) > width:
            result.append(current)
            current = word
        else:
            current = candidate
    return result + ([current] if current else [])


OUTPUT.parent.mkdir(parents=True, exist_ok=True)
overlay = BytesIO()
pdf = canvas.Canvas(overlay, pagesize=A4)
pdf.setFillColor(black)


def text(x, y, value, size=7.5, width=None):
    pdf.setFont("Helvetica", size)
    for index, line in enumerate(lines(value, width, size=size) if width else [str(value or "-")]):
        pdf.drawString(x, y - index * (size + 1.5), line)


def check(x, y):
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawCentredString(x, y, "X")


text(77, 775, "CMTU - ROÇADA ZONA NORTE", 7, 180)
text(304, 775, "92000", 7, 72)
text(438, 775, "CONRADO CIRILO DE NOVAIS", 7, 110)
text(100, 675, "CELSO SANTOS DA SILVA", 7.5, 265)
text(405, 675, "92", 7.5, 140)
text(74, 660, "OPERADOR DE ROCADEIRA", 7.5, 290)
text(422, 660, "28/05/2026", 7.5, 120)
text(136, 645, "28/05/2026 a 25/08/2026", 7.5, 225)
text(442, 645, "25/08/2026", 7.5, 100)
text(52, 617, "Advertências: 1    Suspensões: 0    Ausências: 0", 7.5, 490)
text(52, 606, "Por tipo: Nenhuma", 7.5, 490)
text(52, 595, "Por classificação: Nenhuma", 7.5, 490)
for y in (544, 510, 476, 442, 408):
    check(320, y)
check(52, 366)
check(52, 302)
text(52, 274, "Supervisor: Teste", 7.5, 485)
text(52, 264, "RH: Teste", 7.5, 485)
text(69, 178, "18", 7.5)
text(92, 178, "08", 7.5)
text(115, 178, "2026", 7.5)
text(69, 133, "18", 7.5)
text(92, 133, "08", 7.5)
text(115, 133, "2026", 7.5)
pdf.save()
overlay.seek(0)

base = PdfReader(str(TEMPLATE))
filled = PdfReader(overlay)
page = base.pages[0]
page.merge_page(filled.pages[0])
writer = PdfWriter()
writer.add_page(page)
with OUTPUT.open("wb") as stream:
    writer.write(stream)
