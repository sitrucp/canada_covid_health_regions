import json
import csv
import requests
from bs4 import BeautifulSoup
from datetime import datetime
from pytz import timezone
import pandas as pd
from boto.s3.connection import S3Connection
from boto.s3.key import Key
from datetime import datetime
import os
from os import listdir
from os.path import isfile, join
import sys

def main():
    # set variables
    script_dir = os.path.dirname(__file__) 
    eastern = timezone('US/Eastern')
    todays_date = datetime.now(timezone('US/Eastern')).strftime('%Y-%m-%d %I:%M %p').lstrip("0").replace(" 0", " ")
    print(todays_date)

    # get lookup file to join to web scrape data
    df_montreal_regions_lookup = pd.read_csv(os.path.join(script_dir, 'montreal_regions_lookup.csv'))

    # get prev case total to compare to new case total
    with open('uploads/montreal_covid_data.json') as f:
        string = f.read()
        string = string.replace('var covid_data = ', '')
        json_string = json.loads(string)
    df_montreal_covid_data = pd.DataFrame.from_dict(json_string, orient='columns')
    df_total_row = df_montreal_covid_data[df_montreal_covid_data['website_name'].str.contains('total', regex=False, case=False, na=False)]
    str_total_case_prev = df_total_row['case_count'].values[0]

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
    # rename columns 
    df_table_data_all_cols.columns = ['region_name', 'case_count','case_percent','case_per_100k','mort_count', 'mort_per_100k']
    df_table_data = df_table_data_all_cols[['region_name','case_count','case_percent','case_per_100k','mort_count', 'mort_per_100k']]

    # join lookup table to scrape data to get geojson_name field to use on map
    df_table_data_w_lookup = pd.merge(df_montreal_regions_lookup, df_table_data, left_on='website_name', right_on='region_name', how='left')
    df_table_data_final = df_table_data_w_lookup[['website_name', 'region_name', 'geojson_name', 'case_count','case_percent','case_per_100k','mort_count', 'mort_per_100k']]

    # get new case total to compare to prev total
    str_total_case_new = df_table_data_final[df_table_data_final['website_name'].str.contains("total", case=False)]["case_count"].to_string(index=False).strip()

    # if new is diff from prev, update files and upload to aws
    if str_total_case_prev == str_total_case_new:
        scrape_result = 'no change, case total is still same as prev case total: ' + str_total_case_prev
    else:
        # create scrape result string to print to cron log
        scrape_result = 'new cases found: ' + str_total_case_new + ' prev case total: ' + str_total_case_prev
        # transform pandas dataframe into dictionary to write as json
        json_table = df_table_data_final.to_dict('records')
        # write new montreal covid_data to json file for map to use
        with open('uploads/montreal_covid_data.json', 'w') as f:
            f.write('var covid_data = \n')
            json.dump(json_table, f, ensure_ascii=True)
        # write new total to use in next run comparison
        with open('uploads/total_case_prev.txt', 'w') as f:
            f.write(str_total_case_new)
            # write today's date to use in index page as last updated date
        with open('uploads/last_update_date.json', 'w') as f:
            f.write('var last_update_date = \n')
            json.dump(todays_date, f)
        upload_to_aws()

    ## write success scrape result to cron log
    print(datetime.now().strftime('%Y-%m-%d %H:%M ') + scrape_result)
    
def upload_to_aws():
    # get config details for aws upload
    from config import config_details
    upload_path = config_details['upload_path']
    key_path = config_details['key_path']
    sys.path.insert(0, key_path)
    from aws_keys import canada_covid_aws_keys

    ## create aws S3 connection
    conn = S3Connection(canada_covid_aws_keys['AWS_KEY'], canada_covid_aws_keys['AWS_SECRET'])
    bucket = conn.get_bucket('canada-covid-data')
    
    # identify files to be uploaded to aws
    upload_files = [f for f in listdir(upload_path) if isfile(join(upload_path, f))]

    # delete existing files from bucket
    for key in bucket.list():
        bucket.delete_key(key)

    # write new files to bucket 
    for file in upload_files:
        k = Key(bucket)
        k.key = file
        k.set_contents_from_filename(upload_path + file)

if __name__ == "__main__":
    main()