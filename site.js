
//GET DATA=================================
// get case, mortality csv files from working group github repository
// get health region lookup csv from my github repository
var file_cases = "https://raw.githubusercontent.com/ishaberry/Covid19Canada/master/cases.csv";
var file_mortality = "https://raw.githubusercontent.com/ishaberry/Covid19Canada/master/mortality.csv";
var file_update_time = "https://raw.githubusercontent.com/ishaberry/Covid19Canada/master/update_time.txt";
var file_hr_lookup = "https://raw.githubusercontent.com/sitrucp/canada_covid_health_regions/master/health_regions_lookup.csv";

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

    // summarize cases and mortalities counts overall for header
    var caseTotalCanada = cases.length;
    var mortTotalCanada = mortalities.length;
    //var div_total_cases = document.getElementById('total_cases');
    document.getElementById('total_cases').innerHTML += caseTotalCanada.toLocaleString();
    document.getElementById('total_morts').innerHTML += mortTotalCanada.toLocaleString();
    document.getElementById('new_cases').innerHTML += caseTotalCanada.toLocaleString();
    document.getElementById('new_morts').innerHTML += mortTotalCanada.toLocaleString();
    document.getElementById('title').innerHTML += ' <small class="text-muted">Last updated: ' + lastUpdated + '</small>';
     
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

    // summarize case counts by prov | health_region concat
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
    
    // summarize mortality counts by prov | health_region concat
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
        var regionCaseCount = getCaseCount(statscanRegion);
        var regionMortCount = getMortCount(statscanRegion);
        var regionProvince = getProvince(statscanRegion);
        var regionAuthorityName = getAuthorityName(statscanRegion);
        var casePctCanada = parseFloat(regionCaseCount / caseTotalCanada * 100).toFixed(2)+"%";
        var mortPctCanada = parseFloat(regionMortCount / mortTotalCanada * 100).toFixed(2)+"%";
        
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
    
        var timeDiff = (new Date(lastUpdated)) - (new Date(maxCaseDate));
        var daysLastCase = parseInt(Math.round((timeDiff / (1000 * 60 * 60 * 24)-1)));

        function fillColor(days) {
            var daysColor = '';
            if (days === 0) {
                var daysColor = '#ff6666'; // red
                var colorWord = 'red';
            } else if (days < 8) {
                var daysColor = '#ffc266'; // orange
                var colorWord = 'orange';
            } else {
                var daysColor = '#99e699'; // green
                var colorWord = 'green';
            }
            return daysColor
        }

        // write region details to index page region_details div
        document.getElementById('region_details').innerHTML = '<small><p><strong>' + regionProvince + '<br>' + statscanRegion + '</strong><br>Cases: ' + regionCaseCount.toLocaleString() + ' (' + casePctCanada + ' Canada)' + '<br>Mortalities: ' + regionMortCount.toLocaleString() + ' (' + mortPctCanada + ' Canada)' + '<br>First case: ' + minCaseDate + '<br>First mortality: ' + minMortDate + '<br>Mort per case: ' + getRatioMortCase(regionMortCount,regionCaseCount)  + '<br>Days since last case: <span style="font-weight:bold; color:' + fillColor(daysLastCase) + '";>' + daysLastCase + '</span></p></small>';
        
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

        function getRatioMortCase(numerator, denominator) {
            if (denominator === 0 || isNaN(denominator)) {
                    return null;
            }
            else {
                    return (numerator / denominator).toFixed(3);
            }
        }

        // sort array by report_date bc orig csv is not always in date order
        var caseRegionByDateSorted = caseRegionByDate.sort(function(a, b) {
            return new Date(a.report_date) - new Date(b.report_date);
        });

        // create cum case counts from sorted dataset
        caseRegionByDateCum = 
        caseRegionByDateSorted.reduce((acc, i, index) => {
            acc[index] = {
            report_date: i.report_date,
            case_count: i.case_count + (index > 0 ? acc[index - 1].case_count : 0)
            };
            return acc;
        }, []);

        // create daily new case counts from sorted dataset
        caseRegionByDateNew = 
        caseRegionByDateSorted.reduce((acc, i, index) => {
            acc[index] = {
            report_date: i.report_date,
            case_count: i.case_count + (index > 0 ? acc[index - 1].case_count : 0)
            };
            return acc;
        }, []);

        // sort array by report_date bc orig csv is not always in date order
        var mortRegionByDateSorted = mortRegionByDate.sort(function(a, b) {
            return new Date(a.report_date) - new Date(b.report_date);
        });

        // create cum mort counts from sorted dataset
        mortRegionByDateCum = 
        mortRegionByDateSorted.reduce((acc, i, index) => {
            acc[index] = {
            report_date: i.report_date,
            mort_count: i.mort_count + (index > 0 ? acc[index - 1].mort_count : 0)
            };
            return acc;
        }, []);

        // not used by could be used to transform daily counts to log
        function log(x) {
            return Math.log(x) / Math.LN10;
        }

        // create daily cases chart==================
        // get max case count for region for y axis
        var regionMaxDailyCaseCount = d3.max(caseRegionByDate.map(d=>d.case_count));
        var yaxis2_type = 'linear';
        var yaxis2RangeMax = regionCaseCount;
        
        // not used but could be used to change y2 scale to log
        function changeY2scale() {
            var yaxis2_type = 'log';
            var yaxis2RangeMax = log(regionCaseCount);
        }
        
        //document.getElementById('region_daily_cases_chart').innerHTML = '<button onclick="changeY2scale()">Log</button>';

        if(regionMaxDailyCaseCount > 0) {
            // create x and y axis data sets
            var xCases = [];
            var yCases = [];
            var xCasesCum = [];
            var yCasesCum = [];

            for (var i=0; i<caseRegionByDate.length; i++) {
                row = caseRegionByDate[i];
                xCases.push( row['report_date']);
                yCases.push( row['case_count']);
            }
            for (var i=0; i<caseRegionByDateCum.length; i++) {
                row = caseRegionByDateCum[i];
                xCasesCum.push( row['report_date']);
                yCasesCum.push( row['case_count']);
            }
            // set up plotly chart
            var casesDaily = {
                name: 'Daily',
                x: xCases,
                y: yCases,
                type: 'bar',
                width: 1000*3600*24,
                marker: {
                    color: 'rgb(54,144,192)',
                    line: {
                      color: 'rgb(4,90,141)',
                      width: 1
                    }
                  }
            };
            var casesCum = {
                name: 'Cumulative',
                x: xCasesCum,
                y: yCasesCum,
                yaxis: 'y2',
                type: 'scatter',
                mode: 'lines'
            };
            var caseChartData = [casesDaily, casesCum];
            var caseChartLayout = {
                title: {
                    text:'Cases by day',
                    font: {
                        weight: "bold",
                        size: 12
                    },
                },
                showlegend: true,
                legend: {
                    "orientation": "h",
                    x: 0,
                    xanchor: 'left',
                    y: 1.3,
                    bgcolor: 'rgba(0,0,0,0)',
                    font: {
                        //family: 'sans-serif',
                        size: 10
                        //color: '#000'
                      },
                },
                autosize: false,
                autoscale: false,
                width: 250,
                height: 150,
                margin: {
                    l: 30,
                    r: 40,
                    b: 30,
                    t: 25,
                    pad: 2
                },
                xaxis: { 
                    autotick: true,
                    mirror: 'allticks',
                    type: "date",
                    tickformat: "%b-%d",
                    tickfont: {
                        size: 10
                    },
                    tickangle: 0,
                    //autorange: false,
                    range:[
                        new Date(minCaseDate).getTime(),
                        new Date(maxCaseDate).getTime()
                    ],
                    //tickmode: 'auto',
                    //nticks: 5,
                    //tick0: '2020-03-05',
                    //dtick: 1209600000.0,
                    //autotick: false,
                    //nticks: 5,
                   // autorange: false,
                },
                yaxis: { 
                    //autorange: true, 
                    tickfont: {
                        size: 10
                    },
                    range:[0, regionMaxDailyCaseCount],
                    showgrid: false
                },
                yaxis2 : {
                    //autorange: true, 
                    type: yaxis2_type,
                    tickfont: {
                        size: 10
                    },
                    range:[0, yaxis2RangeMax],
                    overlaying: 'y',
                    side: 'right',
                    showgrid: false
                }
            };
            Plotly.newPlot('region_daily_cases_chart', caseChartData, caseChartLayout);
        } else {
            document.getElementById('region_daily_cases_chart').innerHTML = '';
        }

        // daily mort chart==================
        // get max mort count for region for y axis
        regionMaxDailyMortCount = d3.max(mortRegionByDate.map(d=>d.mort_count));

        if(regionMaxDailyMortCount > 0) {
            // create x and y axis data sets
            var xMort = [];
            var yMort = [];
            var xMortCum = [];
            var yMortCum = [];

            for (var i=0; i<mortRegionByDate.length; i++) {
                row = mortRegionByDate[i];
                xMort.push( row['report_date'] );
                yMort.push( row['mort_count'] );
            }
            for (var i=0; i<mortRegionByDateCum.length; i++) {
                row = mortRegionByDateCum[i];
                xMortCum.push( row['report_date']);
                yMortCum.push( row['mort_count']);
            }
            // set up plotly chart
            var mortsDaily = {
                name: 'Daily',
                x: xMort,
                y: yMort,
                type: 'bar',
                width: 1000*3600*24,
                marker: {
                    color: 'rgb(54,144,192)',
                    line: {
                      color: 'rgb(4,90,141)',
                      width: 1
                    }
                  }
            };
            var mortsCum = {
                name: 'Cumulative',
                x: xMortCum,
                y: yMortCum,
                yaxis: 'y2',
                type: 'scatter',
                mode: 'lines',
            };
            var mortChartData = [mortsDaily, mortsCum];
            var mortChartLayout = {
                title: {
                    text:'Mortalities by day',
                    font: {
                        weight: "bold",
                        size: 12
                    },
                },
                showlegend: false,
                legend: {
                    "orientation": "v",
                    x: 0,
                    xanchor: 'left',
                    y: 1,
                    font: {
                        size: 10
                    },
                },
                autosize: false,
                autoscale: false,
                width: 250,
                height: 150,
                margin: {
                    l: 30,
                    r: 35,
                    b: 50,
                    t: 25,
                    pad: 5
                },
                xaxis: { 
                    autotick: true,
                    mirror: 'allticks',
                    type: "date",
                    tickformat: "%b-%d",
                    tickfont: {
                        size: 10
                    },
                    tickangle: 0,
                    range:[
                        new Date(minCaseDate).getTime(), 
                        new Date(maxCaseDate).getTime()
                    ],
                    //tickmode: 'auto',
                    //nticks: 5,
                    //tick0: '2020-03-05',
                    //dtick: 1209600000.0,
                    //tickmode: 'linear',
                    //tick0: '2020-03-05'
                    //dtick: 432000000,
                },
                yaxis: { 
                    tickfont: {
                        size: 10
                    },
                    tickformat: ',d',
                    autorange: false, 
                    range:[0, regionMaxDailyMortCount],
                    showgrid:false
                },
                yaxis2 : {
                    tickfont: {
                        size: 10
                    },
                    tickformat: ',d',
                    autorange: false, 
                    range:[0, regionMortCount],
                    overlaying: 'y',
                    side: 'right',
                    showgrid:false
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
        var regionCaseCount = getCaseCount(regionName);
        var regionMortCount = getMortCount(regionName);
        var regionProvince = getProvince(regionName);
        var casePctCanada = parseFloat(regionCaseCount / caseTotalCanada * 100).toFixed(2)+"%";
        var mortPctCanada = parseFloat(regionMortCount / mortTotalCanada * 100).toFixed(2)+"%";

        document.getElementsByClassName('infobox')[0].innerHTML = '<p">Province:' + regionProvince + ' <br>' + 'Health Region: ' + regionName + '<br>' + 'Confirmed cases: ' + regionCaseCount.toLocaleString() + ' (' + casePctCanada + ' Canada)' + '<br>' + 'Mortalities: ' + regionMortCount.toLocaleString() + ' (' + mortPctCanada + ' Canada)<br>' + 'Mort per case: ' + getRatioMortCase(regionMortCount,regionCaseCount) + '</p>';
    };

    function getRatioMortCase(numerator, denominator) {
        if (denominator === 0 || isNaN(denominator)) {
                return '0.000';
        }
        else {
                return (numerator / denominator).toFixed(3);
        }
    }

    function mouseOutActions(e) {
        geojson.resetStyle(e.target);
        //geojsonUS.resetStyle(e.target);
        document.getElementsByClassName('infobox')[0].innerHTML = '<p>Hover mouse over region to see details here.<br> Click on region to show details in right side panel.<br> Scroll to zoom.</p>';
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
        var regionCaseCount = 0;
        for(var i = 0; i < covidData.length; i++) {
            var obj = covidData[i];
            if (obj.statscan_arcgis_health_region === regionName) {
                regionCaseCount = obj.case_count;
                break;
            }
        }
        if (regionCaseCount == null) {
            regionCaseCount = 0; 
    }
    return regionCaseCount;
    }

    // get mortality counts from working group data
    function getMortCount(regionName) {
        var regionMortCount = 0;
        for(var i = 0; i < covidData.length; i++) {
            var obj = covidData[i];
            if (obj.statscan_arcgis_health_region === regionName) {
                regionMortCount = obj.mort_count;
                break;
            }
        }
        if (regionMortCount == null) {
            regionMortCount = 0; 
    }
    return regionMortCount;
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
        var useCaseOrMort = 'case_count';
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
        return n > 3000 ? '#023858'
            : n > 2000 ? '#045a8d' 
            : n > 1000 ? '#0570b0' 
            : n > 500 ? '#3690c0'
            : n > 250  ? '#74a9cf'
            : n > 100  ? '#a6bddb'
            : n > 50  ? '#d0d1e6'
            : n > 10  ? '#ece7f2'
            : n > -1  ? '#fff7fb'
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
        div.innerHTML = '<p>Hover mouse over region to see details here.<br> Click on region to show details in right side panel.<br> Scroll to zoom.</p>';
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
        thead_tr.append("<th style='text-align: right';>Case % Canada</th>");
        thead_tr.append("<th style='text-align: right';>Mort % Canada</th>");
        thead_tr.append("<th style='text-align: right';>Mort per Case</th>");
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
            tbody_tr.append("<td style='text-align: right';>" + parseFloat(obj.case_count / caseTotalCanada * 100).toFixed(2) + "</td>");
            
            tbody_tr.append("<td style='text-align: right';>" + parseFloat(obj.mort_count / mortTotalCanada * 100).toFixed(2) + "</td>");
            tbody_tr.append("<td style='text-align: right';>" + getRatioMortCase(obj.mort_count, obj.case_count) + "</td>");
            tbody.append(tbody_tr);
        }
    });

    // add tablesorter js to allow user to sort table by column headers
    $(document).ready(function($){ 
        $("#covid_tabular").tablesorter();
    }); 

});
