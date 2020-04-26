
//GET DATA=================================
// get case, mortality csv files from working group github repository
// get health region lookup csv from my github repository
var file_cases = "https://raw.githubusercontent.com/ishaberry/Covid19Canada/master/cases.csv"
var file_mortality = "https://raw.githubusercontent.com/ishaberry/Covid19Canada/master/mortality.csv"
var file_update_time = "https://raw.githubusercontent.com/ishaberry/Covid19Canada/master/update_time.txt"
var file_hr_lookup = "https://raw.githubusercontent.com/sitrucp/canada_covid_health_regions/master/health_regions_lookup.csv"

Promise.all([
    d3.csv(file_cases),
    d3.csv(file_mortality),
    d3.csv(file_update_time),
    d3.csv(file_hr_lookup)
]).then(function(data) {
    //everthing else below is in d3 promise scope
    // get data sets from promise
    var cases = data[0];
    var mortalities = data[1];
    var updateTime = data[2];
    var regionLookup = data[3];

    // create reformatted case and mortality dates
    // case date orig format dd-mm-yyyy, but better as yyyy-mm-dd
    function reformatDate(oldDate) {
        var d = oldDate.split("-")
        var newDate = d[2] + '-' + d[1] + '-' + d[0]
        return newDate
    }

    // create new columns in case and mortalities data sets for use later
    // province + health_region concat field as unique index
    // reformatted proper date format to use in charts
    cases.forEach(function(d) {
        d.prov_health_region_case = d.province + '|' + d.health_region
        d.report_date = reformatDate(d.date_report)
    });
    mortalities.forEach(function(d) {
        d.prov_health_region_mort = d.province + '|' + d.health_region
        d.report_date = reformatDate(d.date_death_report)
    });

    // get update time from working group repository
    lastUpdated = updateTime.columns[0];

    // left join function used to join datasets below
    const equijoinWithDefault = (xs, ys, primary, foreign, sel, def) => {
        const iy = ys.reduce((iy, row) => iy.set(row[foreign], row), new Map);
        return xs.map(row => typeof iy.get(row[primary]) !== 'undefined' ? sel(row, iy.get(row[primary])): sel(row, def));
    };

    // summarize cases and mortalities counts overall
    var caseTotalCanada = cases.length;
    var mortTotalCanada = mortalities.length;
    var div = document.getElementById('header');
    div.innerHTML += 'Total cases: ' + caseTotalCanada.toLocaleString() + ' Total mortalities: ' + mortTotalCanada.toLocaleString() + ' Date data updated: ' + lastUpdated;

    // left join lookup to case to get statscan region name
    const caseWithStatscan = equijoinWithDefault(
        cases, regionLookup, 
        "prov_health_region_case", "province_health_region", 
        ({date_report, report_date}, {province, authority_report_health_region, statscan_arcgis_health_region}, ) => 
        ({date_report, report_date, province, authority_report_health_region, statscan_arcgis_health_region}), 
        {province_health_region:null});

    //left join lookup to mortalities to get statscan region name
    const mortWithStatscan = equijoinWithDefault(
        mortalities, regionLookup, 
        "prov_health_region_mort", "province_health_region", 
        ({date_death_report, report_date}, {province, authority_report_health_region, statscan_arcgis_health_region}) => 
        ({date_death_report, report_date, province, authority_report_health_region, statscan_arcgis_health_region}), 
        {province_health_region:null});

    // summarize cases and mortalities counts by province and health_region
    var caseByRegion = d3.nest()
        .key(function(d) { return d.prov_health_region_case; })
        .rollup(function(v) { return v.length; })
        .entries(cases)
        .map(function(group) {
            return {
            case_prov_health_region: group.key,
            case_count: group.value
            }
        });

    var mortByRegion = d3.nest()
        .key(function(d) { return d.prov_health_region_mort; })
        .rollup(function(v) { return v.length; })
        .entries(mortalities)
        .map(function(group) {
            return {
            mort_prov_health_region: group.key,
            mort_count: group.value
            }
        });

    // left join summarized case records to lookup
    const caseByRegionLookup = equijoinWithDefault(
        regionLookup, caseByRegion, 
        "province_health_region", "case_prov_health_region", 
        ({province, authority_report_health_region, statscan_arcgis_health_region}, {case_prov_health_region, case_count}) => 
        ({province, authority_report_health_region, statscan_arcgis_health_region, case_prov_health_region, case_count}), 
        {case_count:0, case_prov_health_region: "ProvinceName|Not Reported"});

    // left join summarized mort records to lookup
    const mortByRegionLookup = equijoinWithDefault(
        regionLookup, mortByRegion, 
        "province_health_region", "mort_prov_health_region", 
        ({province, authority_report_health_region, statscan_arcgis_health_region}, {mort_prov_health_region, mort_count}) => 
        ({province, authority_report_health_region, statscan_arcgis_health_region, mort_prov_health_region, mort_count}), 
        {mort_count:0, case_prov_health_region: "ProvinceName|Not Reported"});
    
    // add mortalities count value to cases array
    const caseMortByRegion = equijoinWithDefault(
        caseByRegionLookup, mortByRegionLookup, 
        "case_prov_health_region", "mort_prov_health_region", 
        ({case_prov_health_region, case_count}, {mort_count}) => 
        ({case_prov_health_region, case_count, mort_count}), 
        {mort_count:0});

    const covidData = equijoinWithDefault(
        regionLookup, caseMortByRegion, 
        "province_health_region", "case_prov_health_region", 
        ({province, authority_report_health_region, statscan_arcgis_health_region}, {mort_count, case_count}) => 
        ({province, authority_report_health_region, statscan_arcgis_health_region, case_count, mort_count}), 
        {province_health_region:null,case_count:0, mort_count:0});

//CREATE MAP=================================
    // create and populate map with covidData from above
    var map = L.map('map',{ zoomControl: false }).setView(['53.145743','-95.424717'], 4);
    map.once('focus', function() { map.scrollWheelZoom.enable(); });
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token=pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw', {
        maxZoom: 18,
        attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, ' +
            '<a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
            'Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
        id: 'mapbox/light-v9',
        tileSize: 512,
        zoomOffset: -1
    }).addTo(map);

    // add statscan health region boundaries to map
    var geojson = L.geoJson(health_regions, {
        style: function (feature) {
            return {
                color: 'grey', //shape border color
                dashArray: '3',
                weight: 1,
                opacity: 1,
                fillColor: getRegionColor(feature.properties.ENG_LABEL),
                fillOpacity: .7
            };
        },
        onEachFeature: function (feature, layer) {
            layer.on({
                mouseover: mouseOverActions,
                mouseout: mouseOutActions,
                click: showRegionDetails
            });
        }
    }).addTo(map);

    // action when user clicks on map boundary area
    function showRegionDetails(e) {
        var layer = e.target;
        // change region style when hover over
        layer.setStyle({
            color: 'black', //shape border color
            dashArray: '',
            weight: 2,
            opacity: 1,
            //fillColor: 'blue',
            //fillOpacity: 0.3
        });
        if (!L.Browser.ie && !L.Browser.opera) {
            layer.bringToFront();
        }
        var statscanRegion = layer.feature.properties.ENG_LABEL;
        var caseCount = getCaseCount(statscanRegion);
        var mortCount = getMortCount(statscanRegion);
        var regionProvince = getProvince(statscanRegion);
        var regionAuthorityName = getAuthorityName(statscanRegion);
        var casePctCanada = parseFloat(caseCount / caseTotalCanada * 100).toFixed(1)+"%"
        var mortPctCanada = parseFloat(mortCount / mortTotalCanada * 100).toFixed(1)+"%"

        // filter to case data to selected region
        var caseSelectedRegion = caseWithStatscan.filter(function(row) { 
            return row.statscan_arcgis_health_region === statscanRegion; 
        });

        // filter mortalities data to selected region
        var mortSelectedRegion = mortWithStatscan.filter(function(d) { 
            return d.statscan_arcgis_health_region === statscanRegion; 
        });

        // get min and max case dates for region details 
        caseDates = caseSelectedRegion.map(function(d) {
            return {"report_date": d.report_date};
        });
        minCaseDate = d3.min(caseDates.map(d=>d.report_date));
        maxCaseDate = d3.max(caseDates.map(d=>d.report_date));
    
        // get min and max mort dates for region details 
        mortDates = mortSelectedRegion.map(function(d) {
            return {"report_date": d.report_date};
        });
        minMortDate = d3.min(mortDates.map(d=>d.report_date));
        maxMortDate = d3.max(mortDates.map(d=>d.report_date));
    
        // write region details to index page div
        document.getElementById('region_details').innerHTML = '<p class="small">Province:' + regionProvince + ': <br>Statscan Region Name: ' + statscanRegion + '<br>Prov Region Name: ' + regionAuthorityName + '<br>Confirmed cases: ' + caseCount + ' (' + casePctCanada + ' Canada)' + '<br>Mortalities: ' + mortCount + ' (' + mortPctCanada + ' Canada)' + '<br>First case: ' + minCaseDate + '<br>First mortality: ' + minMortDate + '</p><p></p>';
        
        // write region details to index page div
        // document.getElementById('region_details').innerHTML = '<br>';

        // group case counts by date to use in selected region chart
        var caseRegionByDate = d3.nest()
        .key(function(d) { return d.report_date; })
        .rollup(function(v) { return v.length; })
        .entries(caseSelectedRegion)
        .map(function(group) {
            return {
                report_date: group.key,
                case_count: group.value
            }
        });

        // group mort counts by date to use in selected region chart
        var mortRegionByDate = d3.nest()
        .key(function(d) { return d.report_date; })
        .rollup(function(v) { return v.length; })
        .entries(mortSelectedRegion)
        .map(function(group) {
            return {
                report_date: group.key,
                mort_count: group.value
            }
        });

        //var parseDate = d3.timeParse("%m/%d/%Y");
        /// d3.cumsum([{a: 1.3}, {a: 2.2}, {a: 3.0}], d => d.a)
        //.d3.time.format("%Y-%m-%d");
        
        // daily cases chart==================
        // get max case count for region for y axis
        var maxCaseCount = d3.max(caseRegionByDate.map(d=>d.case_count));
        if(maxCaseCount > 0) {
            // create x and y axis data sets
            var xCases = [];
            var yCases = [];

            for (var i=0; i<caseRegionByDate.length; i++) {
                row = caseRegionByDate[i];
                xCases.push( row['report_date'] );
                yCases.push( row['case_count'] );
            }
            // set up plotly chart
            var casesDaily = {
                x: xCases,
                y: yCases,
                type: 'bar',
            };
            var caseChartData = [casesDaily];
            var caseChartLayout = {
                title: {
                    text:'Cases by day',
                    font: {
                        weight: "bold",
                        size: 14
                    },
                },
                autosize: false,
                autoscale: false,
                width: 250,
                height: 150,
                margin: {
                    l: 30,
                    r: 10,
                    b: 50,
                    t: 25,
                    pad: 5
                },
                xaxis: { 
                    tickformat: "%b-%d",
                    autorange: false, 
                    range:[
                        new Date(minCaseDate).getTime(), 
                        new Date(maxCaseDate).getTime()
                    ]
                },
                yaxis: { 
                autorange: false, 
                    range:[0, maxCaseCount]
                }
            };
            Plotly.newPlot('region_daily_cases_chart', caseChartData, caseChartLayout);
        } else {
            document.getElementById('region_daily_cases_chart').innerHTML = '';
        }

        // daily mort chart==================
        // get max mort count for region for y axis
        maxMortCount = d3.max(mortRegionByDate.map(d=>d.mort_count));
        if(maxMortCount > 0) {
            // create x and y axis data sets
            var xMort = [];
            var yMort = [];

            // get max case count for region for y axis
            var maxMortCount = d3.max(mortRegionByDate.map(d=>d.mort_count));

            for (var i=0; i<mortRegionByDate.length; i++) {
                row = mortRegionByDate[i];
                xMort.push( row['report_date'] );
                yMort.push( row['mort_count'] );
            }
            // set up plotly chart
            var mortsDaily = {
                x: xMort,
                y: yMort,
                //mode: 'lines',
                type: 'bar',
            };
            var mortChartData = [mortsDaily];
            var mortChartLayout = {
                    title: {
                        text:'Mortalities by day',
                        font: {
                            weight: "bold",
                            size: 14
                        },
                    },
                //autosize: false,
                autoscale: false,
                width: 250,
                height: 150,
                margin: {
                    l: 30,
                    r: 10,
                    b: 50,
                    t: 25,
                    pad: 5
                },
                xaxis: { 
                        tickformat: "%b-%d",
                        autorange: false, 
                        range:[
                            new Date(minCaseDate).getTime(), 
                            new Date(maxCaseDate).getTime()
                        ]
                },
                yaxis: { 
                        autorange: false, 
                    range:[0, maxMortCount]
                }
            };
            Plotly.newPlot('region_daily_morts_chart', mortChartData, mortChartLayout);
        } else {
            document.getElementById('region_daily_morts_chart').innerHTML = '';
        }
    };

    // action when user mouses over map
    function mouseOverActions(e) {
        var layer = e.target;
        // change region style when hover over
        layer.setStyle({
            color: 'black', //shape border color
            dashArray: '',
            weight: 2,
            opacity: 1,
            //fillColor: 'blue',
            //fillOpacity: 0.3
        });
        if (!L.Browser.ie && !L.Browser.opera) {
            layer.bringToFront();
        }
        var regionName = layer.feature.properties.ENG_LABEL;
        var caseCount = getCaseCount(regionName);
        var mortCount = getMortCount(regionName);
        var regionProvince = getProvince(regionName);
        var casePctCanada = parseFloat(caseCount / caseTotalCanada * 100).toFixed(1)+"%"
        var mortPctCanada = parseFloat(mortCount / mortTotalCanada * 100).toFixed(1)+"%"

        document.getElementsByClassName('infobox')[0].innerHTML = '<p">Province:' + regionProvince + ' <br>' + 'Health Region: ' + regionName + '<br>' + 'Confirmed cases: ' + caseCount + ' (' + casePctCanada + ' Canada)' + '<br>' + 'Mortalities: ' + mortCount + ' (' + mortPctCanada + ' Canada)' + '</p>';
    };

    function mouseOutActions(e) {
        geojson.resetStyle(e.target);
        //geojsonUS.resetStyle(e.target);
        document.getElementsByClassName('infobox')[0].innerHTML = '<p>Hover over health region to see name and counts. Scroll to zoom.</p>';
    }

    // not currently used, was prev used on mouse scroll on map 
    function zoomToFeature(e) {
        map.fitBounds(e.target.getBounds());
    }
    
    // get region name from working group data
    function getAuthorityName(statscanRegion) {
        var regionAuthorityName;
        for(var i = 0; i < covidData.length; i++) {
            var obj = covidData[i];
            if (obj.statscan_arcgis_health_region === statscanRegion) {
                regionAuthorityName = obj.authority_report_health_region;
                break;
            }
        }
    return regionAuthorityName;
    }

    // get case counts from working group data
    function getCaseCount(regionName) {
        var caseCount = 0;
        for(var i = 0; i < covidData.length; i++) {
            var obj = covidData[i];
            if (obj.statscan_arcgis_health_region === regionName) {
                caseCount = obj.case_count;
                break;
            }
        }
        if (caseCount == null) {
            caseCount = 0; 
    }
    return caseCount;
    }

    // get mortality counts from working group data
    getMortCount
    // get mortality counts from covidData.json file by health region 
    function getMortCount(regionName) {
        var mortCount = 0;
        for(var i = 0; i < covidData.length; i++) {
            var obj = covidData[i];
            if (obj.statscan_arcgis_health_region === regionName) {
                mortCount = obj.mort_count;
                break;
            }
        }
        if (mortCount == null) {
            mortCount = 0; 
    }
    return mortCount;
    }

    // get province from working group data 
    function getProvince(regionName) {
        var regionProvince;
        for(var i = 0; i < covidData.length; i++) {
            var obj = covidData[i];
            if (obj.statscan_arcgis_health_region === regionName) {
                regionProvince = obj.province;
                break;
            }
        }
    return regionProvince;
    }

    // case color for legend and health region shape
    function getRegionColor(regionName) {
        var regionColor;
        for(var i = 0; i < covidData.length; i++) {
            var obj = covidData[i];
            if (obj.statscan_arcgis_health_region === regionName) {
                regionColor = getColor(obj.case_count);
                break;
            }
        }
        return regionColor;
    }

    // get color based on case count
    function getColor(n) {
        return n > 3000 ? '#800026'
            : n > 2000 ? '#bd0026' 
            : n > 1000 ? '#e31a1c' 
            : n > 500 ? '#fc4e2a'
            : n > 250  ? '#fd8d3c'
            : n > 100  ? '#feb24c'
            : n > 50  ? '#fed976'
            : n > 10  ? '#ffeda0'
            : n > -1  ? '#ffffcc'
            : '#ffffff';
    }

    // add legend with color gradients by case count
    var legend = L.control({position: 'topright'});
    legend.onAdd = function (map) {
        var div = L.DomUtil.create('div', 'infobox legend'),
            grades = [0, 10, 50, 100, 250, 500, 1000, 2000, 3000],
            labels = [];
        // loop through our density intervals and generate a label with a colored square for each interval
        for (var i = 0; i < grades.length; i++) {
            div.innerHTML +=
                '<i style="background:' + getColor(grades[i] + 1) + '"></i> ' +
                grades[i] + (grades[i + 1] ? '&ndash;' + grades[i + 1] + '<br>' : '+');
        }
        return div;
    };
    legend.addTo(map);

    // control that shows state info on hover
    var infobox = L.control({position: 'topleft'});
    infobox.onAdd = function (map) {
        var div = L.DomUtil.create('div', 'infobox');
        var infobox = document.getElementsByClassName('infobox')[0];
        div.innerHTML = '<p>Hover over health region to see name and counts. Scroll to zoom.</p>';
        return div;
    };
    infobox.addTo(map);

//CREATE TABLE BELOW MAP=================================
    
    $(document).ready(function () {
        var thead;
        var thead_tr;
        thead = $("<thead>");
        thead_tr = $("<tr/>");
        thead_tr.append("<th>Province</th>");
        thead_tr.append("<th>Health Authority Name</th>");
        thead_tr.append("<th>Statscan Name</th>");
        thead_tr.append("<th style='text-align: right';>Case Count</th>");
        thead_tr.append("<th style='text-align: right';>Mortality Count</th>");
        thead_tr.append("</tr>");
        thead.append(thead_tr);
        $('table').append(thead);
        var tbody;
        var tbody_tr;
        tbody = $("<tbody>");
        $('table').append(tbody);
        for(var i = 0; i < covidData.length; i++) {
            var obj = covidData[i];
            tbody_tr = $('<tr/>');
            tbody_tr.append("<td>" + obj.province + "</td>");
            tbody_tr.append("<td>" + obj.authority_report_health_region + "</td>");
            tbody_tr.append("<td>" + obj.statscan_arcgis_health_region + "</td>");
            tbody_tr.append("<td style='text-align: right';>" + obj.case_count + "</td>");
            tbody_tr.append("<td style='text-align: right';>" + obj.mort_count + "</td>");
            tbody.append(tbody_tr);
        }
    });

    // add tablesorter js to allow user to sort table by column headers
    $(document).ready(function($){ 
        $("#covid_tabular").tablesorter();
    }); 

});
