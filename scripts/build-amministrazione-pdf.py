"""Genera i PDF in identità Victor&Co dal contenuto src/content/amministrazione-docs.json.

Uso: python3 scripts/build-amministrazione-pdf.py
Output: public/docs/*.pdf
"""
import json
import os
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (BaseDocTemplate, Frame, Image, KeepTogether, ListFlowable, ListItem,
                                PageTemplate, Paragraph, Spacer, Table, TableStyle)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTS = '/usr/share/fonts/truetype/google-fonts'
NAVY = colors.HexColor('#0d3447')
NAVY2 = colors.HexColor('#164a63')
S1 = colors.HexColor('#f7f7f7')
S2 = colors.HexColor('#eef1f4')
BD = colors.HexColor('#dddddd')
TEXT = colors.HexColor('#181a20')
MUTED = colors.HexColor('#4f5560')

for name, fn in [('Poppins', 'Poppins-Regular.ttf'), ('Poppins-Medium', 'Poppins-Medium.ttf'),
                 ('Poppins-Bold', 'Poppins-Bold.ttf'), ('Poppins-Light', 'Poppins-Light.ttf')]:
    pdfmetrics.registerFont(TTFont(name, os.path.join(FONTS, fn)))
pdfmetrics.registerFontFamily('Poppins', normal='Poppins', bold='Poppins-Bold', italic='Poppins', boldItalic='Poppins-Bold')

LOGO = os.path.join(ROOT, 'public/brand/logo-navy.png')
PAGE_W, PAGE_H = A4
MARGIN = 20 * mm

st = {
    'title': ParagraphStyle('title', fontName='Poppins-Bold', fontSize=22, leading=28, textColor=NAVY, spaceAfter=4),
    'sub': ParagraphStyle('sub', fontName='Poppins-Light', fontSize=10, leading=14, textColor=MUTED, spaceAfter=14),
    'h': ParagraphStyle('h', fontName='Poppins-Bold', fontSize=13, leading=18, textColor=NAVY, spaceBefore=14, spaceAfter=6),
    'p': ParagraphStyle('p', fontName='Poppins', fontSize=9.5, leading=14.5, textColor=TEXT, spaceAfter=6, alignment=TA_LEFT),
    'li': ParagraphStyle('li', fontName='Poppins', fontSize=9.5, leading=14.5, textColor=TEXT),
    'th': ParagraphStyle('th', fontName='Poppins-Bold', fontSize=8.5, leading=11.5, textColor=colors.white),
    'td': ParagraphStyle('td', fontName='Poppins', fontSize=8.5, leading=11.5, textColor=TEXT),
}


def p(text, style):
    return Paragraph(escape(text), style)


def table(block, width):
    head, rows = block['head'], block['rows']
    n = len(head)
    if n == 4:
        ratios = [0.22, 0.28, 0.27, 0.23]
    elif n == 2:
        ratios = [0.5, 0.5]
    else:
        ratios = [1 / n] * n
    data = [[p(h, st['th']) for h in head]] + [[p(c, st['td']) for c in r] for r in rows]
    t = Table(data, colWidths=[width * r for r in ratios], repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), NAVY),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, S1]),
        ('LINEBELOW', (0, 0), (-1, -1), 0.4, BD),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6), ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 5), ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    return t


def bullets(items):
    return ListFlowable(
        [ListItem(p(i, st['li']), leftIndent=14, bulletColor=NAVY) for i in items],
        bulletType='bullet', start='•', bulletFontName='Poppins-Bold', bulletFontSize=9, leftIndent=14, spaceAfter=6)


def on_page(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(NAVY)
    canvas.rect(0, PAGE_H - 4 * mm, PAGE_W, 4 * mm, stroke=0, fill=1)
    canvas.setFont('Poppins', 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(MARGIN, 10 * mm, 'Victor&Co Real Estate  ·  Amministrazione  ·  Documento interno')
    canvas.drawRightString(PAGE_W - MARGIN, 10 * mm, f'Pagina {doc.page}')
    canvas.setStrokeColor(BD)
    canvas.setLineWidth(0.4)
    canvas.line(MARGIN, 14 * mm, PAGE_W - MARGIN, 14 * mm)
    canvas.restoreState()


def build(doc_data, out_path, landscape_table=False):
    width = PAGE_W - 2 * MARGIN
    doc = BaseDocTemplate(out_path, pagesize=A4, leftMargin=MARGIN, rightMargin=MARGIN, topMargin=16 * mm, bottomMargin=20 * mm,
                          title=doc_data['title'], author='Victor&Co Real Estate')
    doc.addPageTemplates([PageTemplate(id='main', frames=[Frame(MARGIN, 20 * mm, width, PAGE_H - 36 * mm, id='f', leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)], onPage=on_page)])
    story = []
    logo_w = 42 * mm
    story.append(Image(LOGO, width=logo_w, height=logo_w * 384 / 958, hAlign='LEFT'))
    story.append(Spacer(1, 10 * mm))
    story.append(p(doc_data['title'], st['title']))
    story.append(p(doc_data['subtitle'], st['sub']))
    for sec in doc_data['sections']:
        head = [p(sec['h'], st['h'])]
        first = True
        for b in sec['blocks']:
            if b['type'] == 'p':
                f = p(b['text'], st['p'])
            elif b['type'] == 'ul':
                f = bullets(b['items'])
            else:
                f = table(b, width)
                f = [f, Spacer(1, 6)]
            flow = f if isinstance(f, list) else [f]
            if first:
                story.append(KeepTogether(head + flow))
                first = False
            else:
                story.extend(flow)
    doc.build(story)


if __name__ == '__main__':
    data = json.load(open(os.path.join(ROOT, 'src/content/amministrazione-docs.json'), encoding='utf-8'))
    out_dir = os.path.join(ROOT, 'public/docs')
    os.makedirs(out_dir, exist_ok=True)
    for key in ('analisi', 'jobdesc'):
        d = data[key]
        out = os.path.join(ROOT, 'public', d['pdf'].lstrip('/'))
        build(d, out)
        print('scritto', out)
