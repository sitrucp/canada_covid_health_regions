import csv, json

#csvfile = open('Public_COVID-19_Canada.csv', 'r',encoding='utf-8') 
#jsonfile = open('Public_COVID-19_Canada.json', 'w',encoding='utf-8')

csvfile = 'Public_COVID-19_Canada_final.csv'
jsonfile = 'Public_COVID-19_Canada.json'

with open(csvfile) as f:
    reader = csv.DictReader(f)
    rows = list(reader)

with open(jsonfile, 'w') as f:
    json.dump(rows, f, ensure_ascii=False)