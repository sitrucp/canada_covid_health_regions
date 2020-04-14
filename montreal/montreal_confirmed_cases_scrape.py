import json
import csv
import requests
from bs4 import BeautifulSoup
from datetime import datetime
import pandas as pd

todaydate = datetime.today().strftime('%Y-%m-%d')
jsonfile = 'montreal_confirmed_cases.json'
montreal_regions_lookup = pd.read_csv('montreal_regions_lookup.csv')

# open json file to write new data into
with open(jsonfile, 'w') as file:
    # get health montreal webpage html
    url = 'https://santemontreal.qc.ca/en/public/coronavirus-covid-19/'
    page = requests.get(url)
    soup = BeautifulSoup(page.content, 'html.parser')
    # get all tables on webpage
    tables = soup.find_all('table')
    # select 4th table in list of tables on webpage
    table = tables[3]
    # read table into pandas dataframe
    table_data_all_cols = pd.read_html(str(table))[0]
    # rename columns and only keep two first columns
    table_data_all_cols.columns = ['region_name', 'case_count','distribution','rate']
    table_data = table_data_all_cols[['region_name','case_count']]
    # join lookup table on website name & region_name to get geojson_name field to use on map
    table_data_w_lookup = pd.merge(montreal_regions_lookup, table_data, left_on='website_name', right_on='region_name', how='left')
    table_data_final = table_data_w_lookup[['website_name', 'region_name', 'geojson_name', 'case_count']]
    # transform pandas dataframe into dictionary to write as json
    json_table = table_data_final.to_dict('records')

# write updated montreal data json with variable name into new json file
with open(jsonfile, 'w') as f:
    f.write('var covid_data = \n')
    json.dump(json_table, f, ensure_ascii=True)
