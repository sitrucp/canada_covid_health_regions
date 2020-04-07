import csv, json

csvfile = 'Public_COVID-19_Canada_final.csv'
jsonfile = 'Public_COVID-19_Canada_final.json'

with open(csvfile) as f:
    reader = csv.DictReader(f)
    rows = list(reader)

with open(jsonfile, 'w') as f:
    json.dump(rows, f, ensure_ascii=False)