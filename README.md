**Canada Confirmed COVID-19 Cases By Provincial Health Regions**

View map here:
<a href="https://sitrucp.github.io/canada_covid_health_regions/index.html">https://sitrucp.github.io/canada_covid_health_regions/index.html</a>

This Leaflet map is based on the <a href="https://www150.statcan.gc.ca/n1/pub/82-402-x/2018001/hrbf-flrs-eng.htm">Statscan ArcGIS health region boundary Canada file</a> with some modifications required as described below. The Statscan health region boundary ArcGIS data was converted to GeoJSON format using QGIS as described <a href="https://gis.stackexchange.com/questions/354142/what-is-this-coordinate-system-from-esri-and-how-do-i-convert-it-to-regular-coor/354144?noredirect=1#comment584986_354144">here</a> and maintained in the "health_regions.json" file.

The COVID-91 confirmed case and mortality data come from the <a href = "https://github.com/ishaberry/Covid19Canada">COVID-19 Canada Open Data Working Group</a> "cases.csv" and "mortality.csv" files. The working group gets this data from provincial COVID-91 reporting. 

The Statscan and COVID-19 Canada Open Data Working Group data health region boundaries references have some variances that need to be addressed to allow matching counts to health region boundaries: 

* Many health region names used in provincial health authority public reporting are either given in an informal manner eg using abbreviations or alternate names of the fully qualified names used in Statscan data. For example, Quebec "Région de Montréal" is "Montréal" in Quebec COVID-91 reporting, and "City of Toronto Health Unit" is "Toronto" in Ontario COVID-91 reporting, etc.

* Statscan ArcGIS health region boundaries do not have current provincial health region boundaries. For example, Saskatchewan has newer health region boundaries that are not yet reflected in Statscan data. Statscan Saskatchewan boundaries were replaced with <a href="https://hub-saskatchewan.opendata.arcgis.com/datasets/saskatchewan-covid-19-boundaries">new Saskatchewan COVID-19 boundaries</a>.

* Public reporting boundaries do not match Statscan boundaries. For example, BC is reporting COVID-19 data grouped by Health Authorities, but the Statscan health region files has Health Regions boundaries which are sub-units of Health Authorities. Therefore the "health_regions.json" was manually edited to replace Health Region boundaries with Health Authority boundaries obtained from the <a href="https://catalogue.data.gov.bc.ca/dataset/health-authority-boundaries">BC Data Catalogue</a>.

To address boundary naming variance issues above, a lookup or mapping table was created in file "health_regions_lookup.csv" to match Statscan health region names with working group cases and mortality data health region names.

Montreal Map: A separate map was created for Montreal as it is Canada's "covid hotspot". The boundaries used on the Montreal map are Montreal island neighbourhood or linked cities. The confirmed cases counts come from the <a href = "https://santemontreal.qc.ca/en/public/coronavirus-covid-19/">Quebec Health Montreal website</a>. This map is updated manually using Excel Power Query to retrieve and transform webpage table data.

Edit: As of April 9 the map now retrieves COVID-19 Canada Open Data Working Group data  automatically directly from working group Github repository when the map web page is opened or refreshed in browser by using D3.js to get and transform data from cases.csv and mortaliy.csv files. This code is included in "leaflet_map.js" file. Previously, the  data manipulation was done manually using Excel Power Query to retrieve and transform data files to create map "covid_data" json dataset.

