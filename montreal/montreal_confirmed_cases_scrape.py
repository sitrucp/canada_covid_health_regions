import json
import csv
import requests
from bs4 import BeautifulSoup
from datetime import datetime
import pandas as pd

today_date = datetime.today().strftime('%Y-%m-%d %I:%M %p').lstrip("0").replace(" 0", " ")
json_file = 'montreal_confirmed_cases.json'
df_montreal_regions_lookup = pd.read_csv('montreal_regions_lookup.csv')

# get last update total to compare to new total
file_last_update_total = open("last_update_total.txt","r")
str_last_update_total = file_last_update_total.read()

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
print(list(df_table_data_all_cols))
# rename columns and only keep two first columns
df_table_data_all_cols.columns = ['region_name', 'case_count','case_percent','case_per_100k','mortalities', 'mort_per_100k']
df_table_data = df_table_data_all_cols[['region_name','case_count']]
# join lookup table on website name & region_name to get geojson_name field to use on map
df_table_data_w_lookup = pd.merge(df_montreal_regions_lookup, df_table_data, left_on='website_name', right_on='region_name', how='left')
df_table_data_final = df_table_data_w_lookup[['website_name', 'region_name', 'geojson_name', 'case_count']]
# get total value to compare to old value to see if data is updated 
str_new_total = df_table_data_final[df_table_data_final['website_name'].str.contains("total", case=False)]["case_count"].to_string(index=False)

print('new total:', str_new_total, 'last updated total:', str_last_update_total)

# check if new total different from last update total
if str_last_update_total == str_new_total:
    print('new total is same as last updated total')
else:
    # transform pandas dataframe into dictionary to write as json
    json_table = df_table_data_final.to_dict('records')
    # write updated montreal data json with variable name into new json file
    with open(json_file, 'w') as f:
        f.write('var covid_data = \n')
        json.dump(json_table, f, ensure_ascii=True)
    # write new total for next time
    with open('last_update_total.txt', 'w') as f:
        f.write(str_new_total)
        # write today's date to use in index page as last updated date
    with open('last_update_date.json', 'w') as f:
        f.write('var last_update_date = \n')
        json.dump(today_date, f)



