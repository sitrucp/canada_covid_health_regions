import csv, json

csvfile = 'Public_COVID-19_Canada_final.csv'
jsonfile = 'Public_COVID-19_Canada_final.json'

# first open csv to rewrite without Microsoft BOM character
with open(csvfile) as f:
   newText=f.read().replace('\u00ef\u00bb\u00bf', '')

with open(csvfile, "w") as f:
    f.write(newText)

# second re-open to rewrite as json format
with open(csvfile) as f:
    reader = csv.DictReader(f)
    rows = list(reader)
    
with open(jsonfile, 'w') as f:
    f.write('var covid_data = \n')
    json.dump(rows, f, ensure_ascii=False)

