import pandas as pd
import sys

sys.stdout.reconfigure(encoding='utf-8')
xl = pd.ExcelFile('D:\\tamas_fast_order\\legacy\\tamas fast order.xlsx')
print('Sheets:', xl.sheet_names)
for sheet in xl.sheet_names:
    df = xl.parse(sheet, nrows=0)
    print(f'\n--- {sheet} ---')
    print(list(df.columns))
