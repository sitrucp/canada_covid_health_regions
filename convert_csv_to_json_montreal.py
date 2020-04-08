import csv, json

csvfile = 'montreal_confirmed_cases.csv'
jsonfile = 'montreal_confirmed_cases.json'

# first open csv to rewrite without Microsoft BOM character
with open(csvfile) as f:
   newText=f.read().replace('\u00ef\u00bb\u00bf', '').replace('u2013', '')

with open(csvfile, "w") as f:
    f.write(newText)

# second re-open to rewrite as json format
with open(csvfile) as f:
    reader = csv.DictReader(f)
    rows = list(reader)
    
with open(jsonfile, 'w') as f:
    f.write('var covid_data = \n')
    json.dump(rows, f, ensure_ascii=False)

