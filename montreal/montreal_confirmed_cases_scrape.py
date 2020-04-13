import json
import csv
import requests
from bs4 import BeautifulSoup
from datetime import datetime
import pandas as pd

todaydate = datetime.today().strftime('%Y-%m-%d')
jsonfile = 'montreal_confirmed_cases.json'
montreal_regions_lookup = pd.read_csv('montreal_regions_lookup.csv')

# second re-open to rewrite as json format
with open(jsonfile, 'w') as file:
    url = 'https://santemontreal.qc.ca/en/public/coronavirus-covid-19/'
    page = requests.get(url)
    soup = BeautifulSoup(page.content, 'html.parser')
    tables = soup.find_all('table')
    table = tables[3]
    table_data_all_cols = pd.read_html(str(table))[0]
    # rename columns and only keep two first columns
    table_data_all_cols.columns = ['region_name', 'case_count','distribution','rate']
    table_data = table_data_all_cols[['region_name','case_count']]
    # do join to lookup table on website name & region_name to get geojson_name field for map to use
    print(table_data)
    table_data_w_lookup = pd.merge(montreal_regions_lookup, table_data, left_on='website_name', right_on='region_name', how='left')
    table_data_final = table_data_w_lookup[['website_name', 'region_name', 'geojson_name', 'case_count']]
    # transform bs table to dictionary to write as json
    json_table = table_data_final.to_dict('records')

with open(jsonfile, 'w') as f:
    f.write('var covid_data = \n')
    json.dump(json_table, f, ensure_ascii=True)
