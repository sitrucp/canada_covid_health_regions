Canada Confirmed COVID-19 Cases By Provincial Health Regions 

View map here:
<a href="https://sitrucp.github.io/canada_covid_health_regions/index.html">https://sitrucp.github.io/canada_covid_health_regions/index.html</a>

This Leaflet map uses modified Statscan arcinfo health region boundaries to show confirmed COVID-91 counts by health region. 

COVID-91 confirmed count data comes from <a href = "https://github.com/ishaberry/Covid19Canada">COVID-19 Canada Open Data Working Group</a> 'cases.csv' file.

The <a href="https://www150.statcan.gc.ca/n1/pub/82-402-x/2013003/reg-eng.htm">Statscan health region boundary data</a> is maintained in the file "canada_healthregions.json".

The COVID-19 Canada Open Data Working Group data comes from provincial COVID-91 reporting.

The Statscan health region data and working group data are not aligned as described below.

Health region names are either not current or have informal usage eg they are abbreviations or alternate names. For example, Quebec "Région de Montréal" is "Montréal" in Quebec COVID-91 reporting, and "City of Toronto Health Unit" is "Toronto" in Ontario COVID-91 reporting, etc.

Statscan arcinfo health region boundaries do not reflect current provincial status or COVID-19 reporting:

*  Sask and Nova Scotia updated boundaries. "canada_healthregions.json" Sask boundaries still need some work to 'dissolve' polygons into updated boundaries.

* BC Statscan arcinfo health region boundaries reference smaller health region areas, whereas BC is COVID-19 reporting references larger health authorities comprised of these smaller areas. 

These issues required manual edits to the Statscan arcinfo health region boundaries data in the file "canada_healthregions.json". In addition a mapping file "health_region_lookup.csv" was created to match Statscan health region names to the working group data in order to display the confirmed counts on the map.

Excel Power Query was used to join working group COVID-19 data to the mapping file to provide  Statscan arcinfo health region name to allow counts to be displayed on map.