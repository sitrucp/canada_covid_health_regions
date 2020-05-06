import json
import csv
import requests
from bs4 import BeautifulSoup
from datetime import datetime
import pandas as pd
import os

script_dir = os.path.dirname(__file__) #<-- absolute dir the script is in
today_date = datetime.today().strftime('%Y-%m-%d %I:%M %p').lstrip("0").replace(" 0", " ")
json_file = 'montreal_covid_data.json'

df_montreal_regions_lookup = pd.read_csv(os.path.join(script_dir, 'montreal_regions_lookup.csv'))

# get last update case total to compare to new total
file_total_case = open(os.path.join(script_dir, "total_case.txt"),"r")
str_total_case_prev = file_total_case.read()

# get health montreal webpage html
url = 'https://santemontreal.qc.ca/en/public/coronavirus-covid-19/'
page = requests.get(url)
soup = BeautifulSoup(page.content, 'html.parser')

# get all tables on webpage
tables = soup.find_all('table')
# select 4th table in list of tables on webpage
table = tables[3]

# read table into pandas dataframe
df_table_data_all_cols = pd.read_html(str(table))[0]
# print(list(df_table_data_all_cols))

# rename columns and only keep two first columns
df_table_data_all_cols.columns = ['region_name', 'case_count','case_percent','case_per_100k','mort_count', 'mort_per_100k']

df_table_data = df_table_data_all_cols[['region_name','case_count','case_percent','case_per_100k','mort_count', 'mort_per_100k']]

# join lookup table on website name & region_name to get geojson_name field to use on map
df_table_data_w_lookup = pd.merge(df_montreal_regions_lookup, df_table_data, left_on='website_name', right_on='region_name', how='left')
df_table_data_final = df_table_data_w_lookup[['website_name', 'region_name', 'geojson_name', 'case_count','case_percent','case_per_100k','mort_count', 'mort_per_100k']]

# get total value to compare to old value to see if data is updated 
str_total_case_new = df_table_data_final[df_table_data_final['website_name'].str.contains("total", case=False)]["case_count"].to_string(index=False)

str_total_mort_new = df_table_data_final[df_table_data_final['website_name'].str.contains("total", case=False)]["mort_count"].to_string(index=False)

# only write to file if data is new
if str_total_case_prev == str_total_case_new:
    print('no change, case total is still same as prev')
else:
    print('new cases found:', str_total_case_new, 'prev case total:', str_total_case_prev)
    # transform pandas dataframe into dictionary to write as json
    json_table = df_table_data_final.to_dict('records')
    # write updated montreal data json with variable name into new json file
    with open(json_file, 'w') as f:
        f.write('var covid_data = \n')
        json.dump(json_table, f, ensure_ascii=True)
    # write new total for next time
    with open('total_case.txt', 'w') as f:
        f.write(str_total_case_new)
    with open('total_mort.txt', 'w') as f:
        f.write(str_total_mort_new)
        # write today's date to use in index page as last updated date
    with open('last_update_date.json', 'w') as f:
        f.write('var last_update_date = \n')
        json.dump(today_date, f)



