"""Build the minimal black/red SVG slides for the 2026 Black Friday campaign."""
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / 'apps/web/public/assets/slides'

def make(name: str, mobile: bool, claim: bool) -> None:
    width, height = (720, 760) if mobile else (1600, 480)
    main = 'تخفیف واقعی تا ۶۵٪' if claim else 'تخفیف‌های واقعی بلک فرایدی'
    sub = 'روی بیش از ۲۰۰ قلم کالا' if claim else 'کالاهای منتخب با تسویهٔ نقدی'
    if mobile:
        body = f'''<path d="M96 74h528M96 686h528" stroke="#7f1d1d" stroke-width="2"/>
  <text x="360" y="238" text-anchor="middle" class="latin" font-size="75">BLACK</text>
  <text x="360" y="322" text-anchor="middle" class="latin" font-size="75">FRIDAY</text>
  <path d="M245 371h230" stroke="#dc2626" stroke-width="4"/>
  <text x="360" y="453" text-anchor="middle" class="fa main" font-size="41" direction="rtl">{main}</text>
  <text x="360" y="529" text-anchor="middle" class="fa sub" font-size="31" direction="rtl">{sub}</text>
  <text x="360" y="646" text-anchor="middle" class="fa action" font-size="26" direction="rtl">مشاهدهٔ کالاها  ←</text>'''
    else:
        body = f'''<path d="M64 46h1472M64 434h1472" stroke="#7f1d1d" stroke-width="2"/>
  <path d="M90 102v276" stroke="#dc2626" stroke-width="8"/>
  <text x="800" y="169" text-anchor="middle" class="latin" font-size="109">BLACK FRIDAY</text>
  <path d="M650 205h300" stroke="#dc2626" stroke-width="4"/>
  <text x="800" y="284" text-anchor="middle" class="fa main" font-size="55" direction="rtl">{main}</text>
  <text x="800" y="348" text-anchor="middle" class="fa sub" font-size="36" direction="rtl">{sub}</text>
  <text x="800" y="407" text-anchor="middle" class="fa action" font-size="24" direction="rtl">مشاهدهٔ کالاها  ←</text>'''
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-label="بلک فرایدی تماس مارکت">
  <style>.latin{{font-family:Arial,Helvetica,sans-serif;font-weight:900;letter-spacing:7px;fill:#ef4444}}.fa{{font-family:Vazirmatn,Tahoma,Arial,sans-serif;fill:#ef4444;unicode-bidi:plaintext}}.main{{font-weight:900}}.sub{{font-weight:600}}.action{{font-weight:700;fill:#f87171}}</style>
  <rect width="{width}" height="{height}" fill="#090909"/>
  {body}
</svg>'''
    (OUT / name).write_text(svg, encoding='utf-8')

make('black-friday-2026-200.svg', False, True)
make('black-friday-2026-200-mobile.svg', True, True)
