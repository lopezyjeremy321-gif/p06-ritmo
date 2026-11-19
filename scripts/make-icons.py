"""Genera los iconos de Ritmo (un solo simbolo legible a 16 px: pulso dentro de un arco). Solo PIL, sin descargas."""
from PIL import Image, ImageDraw
import os

OUT = os.path.join(os.path.dirname(__file__), '..', 'assets')
os.makedirs(OUT, exist_ok=True)
AMBER = (255, 185, 92, 255)      # amber 80
INK = (16, 20, 23, 255)          # slate 10
S = 1024


def pulse(d, color, scale=1.0, width=72):
    # polilinea de pulso centrada; scale reduce para la zona segura del icono adaptativo (66 %)
    pts = [(-0.42, 0.04), (-0.18, 0.04), (-0.08, -0.26), (0.06, 0.30), (0.17, -0.06), (0.24, 0.04), (0.42, 0.04)]
    c = S / 2
    xy = [(c + x * S * scale, c + y * S * scale) for x, y in pts]
    d.line(xy, fill=color, width=int(width * scale), joint='curve')
    r = int(width * scale / 2)
    for p in (xy[0], xy[-1]):
        d.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=color)


def save(name, bg, fg, scale):
    im = Image.new('RGBA', (S, S), bg)
    d = ImageDraw.Draw(im)
    if fg:
        pulse(d, fg, scale)
    im.save(os.path.join(OUT, name))


save('icon.png', INK, AMBER, 1.0)
save('android-icon-foreground.png', (0, 0, 0, 0), AMBER, 0.62)
save('android-icon-background.png', INK, None, 1)
save('android-icon-monochrome.png', (0, 0, 0, 0), (255, 255, 255, 255), 0.62)
save('splash-icon.png', (0, 0, 0, 0), AMBER, 0.62)
fav = Image.open(os.path.join(OUT, 'icon.png')).resize((48, 48), Image.LANCZOS)
fav.save(os.path.join(OUT, 'favicon.png'))
Image.open(os.path.join(OUT, 'icon.png')).resize((180, 180), Image.LANCZOS).save(os.path.join(OUT, 'apple-touch-icon.png'))
print('ok')
