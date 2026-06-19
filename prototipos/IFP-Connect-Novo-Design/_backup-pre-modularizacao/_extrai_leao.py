# Extrai o leão oficial (página 1 do brandbook: leão branco sobre laranja)
# como máscara alpha transparente -> usada com CSS mask-image p/ recolorir.
from PIL import Image
import numpy as np, os

folder = r"C:\Users\Erick\Desktop\Brandbook Instituto PNG"
out = r"C:\Users\Erick\Desktop\IFP-Connect-Novo-Design"
src = os.path.join(folder, "BRANDBOOK INSTITUTO_EM CONSTRUCAO (1)_Página_01.png")

im = Image.open(src).convert("RGB")
arr = np.asarray(im).astype(np.int16)
B = arr[:, :, 2]
# leão é branco (B~255), fundo laranja (B~46) -> chave pelo canal azul
a = np.clip((B - 80) / (235 - 80), 0, 1)
alpha = (a * 255).astype("uint8")
mask = alpha > 140

ys = np.where(mask.sum(axis=1) > 8)[0]
xs = np.where(mask.sum(axis=0) > 8)[0]
top, bot, left, right = ys.min(), ys.max(), xs.min(), xs.max()
h = bot - top
rc = mask.sum(axis=1)
thr = max(3, int(0.004 * (right - left)))
low = rc < thr

# acha o vão (gap) que separa o emblema (cima) do logotipo de texto (baixo)
runs = []
s = None
for y in range(top, bot + 1):
    if low[y]:
        s = y if s is None else s
    else:
        if s is not None:
            runs.append((s, y - 1)); s = None
if s is not None:
    runs.append((s, bot))

emblem_bot = bot
for (rs, re) in runs:
    if rs - top > 0.45 * h:
        emblem_bot = rs - 1
        break

em = mask.copy(); em[emblem_bot + 1:, :] = False
eys = np.where(em.sum(axis=1) > 3)[0]; exs = np.where(em.sum(axis=0) > 3)[0]
et, eb, el, er = eys.min(), eys.max(), exs.min(), exs.max()
pad = 24
et = max(0, et - pad); el = max(0, el - pad); eb = min(arr.shape[0], eb + pad); er = min(arr.shape[1], er + pad)

crop = alpha[et:eb, el:er]
rgba = np.zeros((crop.shape[0], crop.shape[1], 4), "uint8")
rgba[:, :, 0:3] = 255
rgba[:, :, 3] = crop
Image.fromarray(rgba, "RGBA").save(os.path.join(out, "leao-oficial-mask.png"))

# versão de preview marrom sobre transparente (p/ conferir o desenho)
prev = np.zeros((crop.shape[0], crop.shape[1], 4), "uint8")
prev[:, :, 0] = 0x75; prev[:, :, 1] = 0x2C; prev[:, :, 2] = 0x05
prev[:, :, 3] = crop
Image.fromarray(prev, "RGBA").save(os.path.join(out, "leao-oficial-preview.png"))

print("emblema:", er - el, "x", eb - et, "px  -> leao-oficial-mask.png")
