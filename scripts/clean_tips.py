# -*- coding: utf-8 -*-
import re

with open(r'd:\AndroidStudioProjects\养生助手\www\js\data\habits.js', 'r', encoding='utf-8') as f:
    content = f.read()

shichens = ['卯时', '辰时', '巳时', '午时', '未时', '申时', '酉时', '戌时', '亥时', '子时', '丑时', '寅时']

def clean_tip(tip):
    for sc in shichens:
        if tip.startswith(sc):
            # 跳过开头的时辰+经脉说明，到首个全角逗号/书名号/数字
            idx_cn_comma = tip.find('，')
            idx_quote = tip.find('《')
            idx_digit = -1
            for i, ch in enumerate(tip):
                if ch.isdigit() and i > 0:
                    idx_digit = i
                    break
            candidates = [i for i in [idx_cn_comma, idx_quote, idx_digit] if i > 0]
            if candidates:
                cut = min(candidates)
                rest = tip[cut:]
                if rest.startswith('，'):
                    rest = rest[1:]
                return rest
            break
    return tip

def repl(m):
    tip = m.group(1)
    new_tip = clean_tip(tip)
    return "tip:'" + new_tip + "'"

new_content = re.sub(r"tip:'([^']*)'", repl, content)
with open(r'd:\AndroidStudioProjects\养生助手\www\js\data\habits.js', 'w', encoding='utf-8') as f:
    f.write(new_content)
print('done')
