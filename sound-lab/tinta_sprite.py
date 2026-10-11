"""Crea lo sprite "tinta" per i puntini del verde (parchi, boschi, cimiteri) dello stile Toner e Nolli.

Perché: lo sprite "toner" ha il bianco opaco e i puntini come buchi trasparenti; il nero del riempimento sotto
si vede solo nei buchi. Così il bianco copriva le celle LCZ. Lo sprite "tinta" tiene solo i puntini: il bianco
diventa trasparente e i buchi diventano nero opaco (alpha = 255 − alpha di toner). Su un fondo bianco il risultato
è lo stesso di prima; sopra le celle resta solo il puntinato.

Uso (dalla radice del progetto): python3 -I sound-lab/tinta_sprite.py
Legge public/data/mappa/sprites/toner{,@2x}.png e .json, scrive tinta{,@2x}.png e .json.
"""
import shutil
from pathlib import Path

from PIL import Image

SPRITES = Path(__file__).resolve().parent.parent / 'public' / 'data' / 'mappa' / 'sprites'


def crea_tinta(sorgente, destinazione):
    alpha = Image.open(sorgente).convert('RGBA').getchannel('A')
    nero = Image.new('L', alpha.size, 0)
    Image.merge('RGBA', (nero, nero, nero, alpha.point(lambda v: 255 - v))).save(destinazione)


for scala in ['', '@2x']:
    crea_tinta(SPRITES / f'toner{scala}.png', SPRITES / f'tinta{scala}.png')
    # Stessi nomi di pattern (dots-t, cross-t, dash-t, hatch-t) e geometria: cambia solo l'immagine
    shutil.copyfile(SPRITES / f'toner{scala}.json', SPRITES / f'tinta{scala}.json')
    print('scritto tinta' + scala)
