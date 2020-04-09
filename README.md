**bold text**Canada Confirmed COVID-19 Cases By Provincial Health Regions **bold text**

View map here:
<a href="https://sitrucp.github.io/canada_covid_health_regions/index.html">https://sitrucp.github.io/canada_covid_health_regions/index.html</a>

This Leaflet map is based on the <a href="https://www150.statcan.gc.ca/n1/pub/82-402-x/2018001/hrbf-flrs-eng.htm">Statscan ArcGIS Health region boundary Canada dataset</a>, with some modifications as described below. The Statscan health region boundary data is maintained in the file "canada_healthregions.json".

The COVID-91 confirmed count data comes from the <a href = "https://github.com/ishaberry/Covid19Canada">COVID-19 Canada Open Data Working Group</a> 'cases.csv' file which comes from provincial COVID-91 reporting. This data is maintained in the file "Public_COVID-19_Canada_final.json"

Note that the Statscan and COVID-19 Canada Open Data Working Group data health region boundaries have some differences. 

* Many health region names used in provincial health authority public reporting are either given in an informal manner eg using abbreviations or alternate names of the fully qualified names used in Statscan data. For example, Quebec "Région de Montréal" is "Montréal" in Quebec COVID-91 reporting, and "City of Toronto Health Unit" is "Toronto" in Ontario COVID-91 reporting, etc.

* Statscan arcinfo health region boundaries do not have current provincial health region boundaries. For example, Saskatchewan has newer health region boundaries that are not yet reflected in Statscan data. Updated Saskatchewan boundaries are included in the "canada_healthregions.json" although they still need some work to 'dissolve' polygons into updated boundaries.

* Public reporting does not match Statscan boundaries. For example, BC is reporting  COVID-19 data grouped by Health Authorities, but Statscan only has Health Regions which are sub0units of Health Authorities. To map by BC Health Authority, the "canada_healthregions.json" was manually edited to include Health Authority boundaries obtained from BC government website.

In addition, to lookup table was created in file "health_region_lookup.csv" to match Statscan health region names in "canada_healthregions.json" to the working group data in "Public_COVID-19_Canada_final.json" to enable presentation of confirmed counts on the map.The data manipulation is currently being done using Excel Power Query to do this matching.