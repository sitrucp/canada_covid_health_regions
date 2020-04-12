from boto.s3.connection import S3Connection
from boto.s3.key import Key
from datetime import datetime
import sys

upload_path = 'C:/Users/bb/OneDrive - 009co/www/ws_canadahr/montreal/'
#upload_path = '/home/sitrucp/cron/covid/'
upload_file = 'montreal_confirmed_cases.json'

sys.path.insert(0, 'C:/Users/bb/OneDrive - 009co/env_vars/')
#sys.path.insert(0, '/home/sitrucp/config/')

from aws_keys import canada_covid_aws_keys
conn = S3Connection(canada_covid_aws_keys['AWS_KEY'], canada_covid_aws_keys['AWS_SECRET'])
bucket = conn.get_bucket('canada-covid-data', validate=False)

#bucket.delete_key(upload_file)
k = Key(bucket)
k.set_contents_from_filename(upload_path + upload_file)

## write success to cron log
print(datetime.now()) + ' aws s3 twitter upload'