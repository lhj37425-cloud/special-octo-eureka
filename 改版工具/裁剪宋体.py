# 从本机的思源宋体（Windows 自带的 Noto Serif SC 可变字体）裁出字表里的字，固定成粗体 700，存成 woff2 网页字体
# 用法：python 裁剪宋体.py 字表.txt 输出.woff2
# 需要：python -m pip install fonttools brotli
import os, sys
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

SOURCE = r'C:\Windows\Fonts\NotoSerifSC-VF.ttf'
chars_file, out = sys.argv[1], sys.argv[2]
text = open(chars_file, encoding='utf-8').read()

font = TTFont(SOURCE)
options = subset.Options()
options.hinting = False  # 网页上的标题用不到 hinting，去掉能小不少
options.desubroutinize = True
# 保留版权（0）、名称（1–6）和授权说明（13、14）：思源宋体用 SIL OFL 授权，分发时字体里要带着授权信息
options.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]
subsetter = subset.Subsetter(options)
subsetter.populate(text=text)
subsetter.subset(font)
font = instancer.instantiateVariableFont(font, {'wght': 700})
font.flavor = 'woff2'
os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
font.save(out)

name = font['name']
print('字形数', font['maxp'].numGlyphs, '文件', os.path.getsize(out) // 1024, 'KB')
print('授权：', name.getDebugName(13))
