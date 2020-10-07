
//GET DATA=================================
// get csv files from working group github repository
// get health region lookup csv from my github repository
var file_cases = "https://raw.githubusercontent.com/ishaberry/Covid19Canada/master/timeseries_hr/cases_timeseries_hr.csv";
var file_mortality = "https://raw.githubusercontent.com/ishaberry/Covid19Canada/master/timeseries_hr/mortality_timeseries_hr.csv";
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

    // create province + health_region concat field as unique index
    // reformat proper date format to use in charts
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

    // ggt case and mortality totals for header
    var caseTotalCanada = cases.reduce((a, b) => +a + +b.cases, 0);
    var mortTotalCanada = mortalities.reduce((a, b) => +a + +b.deaths, 0);

    // get case and mort date max dates to get new counts
    maxOverallCaseDate = d3.max(cases.map(d=>d.report_date));
    maxOverallMortDate = d3.max(mortalities.map(d=>d.report_date));
    
    // create new case & mort count value where report date = max report date 
    cases.forEach(function(d) {
        if (d.report_date === maxOverallCaseDate) {
            d.case_new_count = d.cases
        } else {
            d.case_new_count = 0
        }
    });
    mortalities.forEach(function(d) {
        if (d.report_date === maxOverallCaseDate) {
            d.mort_new_count = d.deaths
        } else {
            d.mort_new_count = 0
        }
    });
    var caseNewCanada = cases.reduce((a, b) => +a + +b.case_new_count, 0);
    var mortNewCanada = mortalities.reduce((a, b) => +a + +b.mort_new_count, 0);

    // left join lookup to case to get statscan region name
    const caseWithStatscan = equijoinWithDefault(
        cases, regionLookup, 
        "prov_health_region_case", "province_health_region", 
        ({date_report, report_date, cases, cumulative_cases, case_new_count}, {province, authority_report_health_region, statscan_arcgis_health_region}, ) => 
        ({date_report, report_date, province, authority_report_health_region, statscan_arcgis_health_region, cases, cumulative_cases, case_new_count}), 
        {province_health_region:null});

    //left join lookup to morts to get statscan region name
    const mortWithStatscan = equijoinWithDefault(
        mortalities, regionLookup, 
        "prov_health_region_mort", "province_health_region", 
        ({date_death_report, report_date, deaths, cumulative_deaths, mort_new_count}, {province, authority_report_health_region, statscan_arcgis_health_region}) => 
        ({date_death_report, report_date, province, authority_report_health_region, statscan_arcgis_health_region, deaths, cumulative_deaths, mort_new_count}), 
        {province_health_region:null});

    // summarize case counts by prov | health_region concat
    var caseByRegion = d3.nest()
        .key(function(d) { return d.prov_health_region_case; })
        .rollup(function(v) { return {
            case_count: d3.sum(v, function(d) { return d.cases; }),
            case_new_count: d3.sum(v, function(d) { return d.case_new_count; }) 
            };
        })
        .entries(cases)
        .map(function(group) {
            return {
            case_prov_health_region: group.key,
            case_count: group.value.case_count,
            case_new_count: group.value.case_new_count
            }
        });
    
    // summarize mortality counts by prov | health_region concat
    var mortByRegion = d3.nest()
        .key(function(d) { return d.prov_health_region_mort; })
        .rollup(function(v) {
            return {
                mort_count: d3.sum(v, function(d) { return d.deaths; }),
                mort_new_count: d3.sum(v, function(d) { return d.mort_new_count; })
            }; 
        })
        .entries(mortalities)
        .map(function(group) {
            return {
            mort_prov_health_region: group.key,
            mort_count: group.value.mort_count,
            mort_new_count: group.value.mort_new_count
            }
        });

    // left join summarized case records to lookup
    const caseByRegionLookup = equijoinWithDefault(
        regionLookup, caseByRegion, 
        "province_health_region", "case_prov_health_region", 
        ({province, authority_report_health_region, statscan_arcgis_health_region}, {case_prov_health_region, case_count, case_new_count}) => 
        ({province, authority_report_health_region, statscan_arcgis_health_region, case_prov_health_region, case_count, case_new_count}), 
        {case_count:0, case_new_count:0, case_prov_health_region: "ProvinceName|Not Reported"});

    // left join summarized mort records to lookup
    const mortByRegionLookup = equijoinWithDefault(
        regionLookup, mortByRegion, 
        "province_health_region", "mort_prov_health_region", 
        ({province, authority_report_health_region, statscan_arcgis_health_region}, {mort_prov_health_region, mort_count, mort_new_count}) => 
        ({province, authority_report_health_region, statscan_arcgis_health_region, mort_prov_health_region, mort_count, mort_new_count}), 
        {mort_count:0, mort_new_count:0, case_prov_health_region: "ProvinceName|Not Reported"});
    
    // add mortalities count value to cases array
    const caseMortByRegion = equijoinWithDefault(
        caseByRegionLookup, mortByRegionLookup, 
        "case_prov_health_region", "mort_prov_health_region", 
        ({case_prov_health_region, case_count, case_new_count}, {mort_count, mort_new_count}) => 
        ({case_prov_health_region, case_count, case_new_count, mort_count, mort_new_count}), 
        {province_health_region:null,case_count:0, case_new_count:0, mort_count:0, mort_new_count:0});

    // create covid data set used in map
    const covidData = equijoinWithDefault(
        regionLookup, caseMortByRegion, 
        "province_health_region", "case_prov_health_region", 
        ({province, authority_report_health_region, statscan_arcgis_health_region}, {case_count, cum_case_count, case_new_count, mort_count, cum_mort_count, mort_new_count}) => 
        ({province, authority_report_health_region, statscan_arcgis_health_region, case_count, case_new_count, mort_count, mort_new_count}), 
        {province_health_region:null,case_count:0, case_new_count:0, mort_count:0, mort_new_count:0});
    
    // get case and mort date max dates to get new counts
    maxCaseByRegion = d3.max(covidData.map(d=>d.case_count));
    maxMortByRegion = d3.max(covidData.map(d=>d.mort_count));
    maxNewCaseByRegion = d3.max(covidData.map(d=>d.case_new_count));
    maxNewMortByRegion = d3.max(covidData.map(d=>d.mort_new_count));

   document.getElementById('title').innerHTML += ' <small class="text-muted">Last updated: ' + lastUpdated + '</small>';

//CREATE MAP=================================

    // set default map, chroma, chart and region detail variables
    var mapMetric = 'case_count';
    var colorHex = ['#deebf7','#08306b'];
    var classBreaks = [1,50,100,250,500,1000,2000,3000,6000,9000];
    var zoomCenter = ['53.145743','-95.424717'];
    var zoomMag = 4;
    // create and populate map with covidData from above
    var map = L.map('map',{ zoomControl: false }).setView(zoomCenter, zoomMag);
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

    // default info box content on mouseover action
    var infoBoxDefaultText = '<p>Hover mouse over region to see details here.<br> Click on region to show details in left side panel.<br> Scroll to zoom.</p>';
    // create info box control
    var infobox = L.control({position: 'topleft'});
    infobox.onAdd = function (map) {
        var div = L.DomUtil.create('div', 'infobox');
        div.innerHTML = infoBoxDefaultText;
        return div;
    };
    infobox.addTo(map);

     // initialize with default variables
    updateMap(mapMetric,classBreaks,colorHex);
    // update map, called by initial above, and map metric buttons
    function updateMap(mapMetric,classBreaks,colorHex) {
        // add statscan health region boundaries to map
        var layer_hr = L.geoJson(health_regions, {
            style: function (feature) {
                return {
                    color: 'grey', //shape border color
                    dashArray: '3',
                    weight: 1,
                    opacity: 1,
                    fillColor: getRegionCount(mapMetric,feature.properties.ENG_LABEL,classBreaks,colorHex),
                    fillOpacity: 1
                };
            },
            onEachFeature: function (feature, layer) {
                layer.on({
                    mouseover: mouseOverActions,
                    mouseout: function (e) {layer_hr.resetStyle(e.target);
                    document.getElementsByClassName('infobox')[0].innerHTML = infoBoxDefaultText; },
                    click: showRegionDetails
                });
            }
        }).addTo(map);

        // remove existing legend if exists
        var legends = document.getElementsByClassName('legend');
        while (legends.length > 0) {
            legends[0].remove();
        }

        // add updated legend
        var legend = L.control({position: 'topright'});
        legend.onAdd = function (map) {
            var div = L.DomUtil.create('div', 'legend');
            div.innerHTML +='<span>' + mapMetric.replace(/_/g,' ') + '</span><br>';
            div.innerHTML += '<i style="background:#ffffff"></i>0<br>';
            classBreaks.push(999); // add dummy class to extend to get last class color, chroma only returns class.length - 1 colors
            for (var i = 0; i < classBreaks.length; i++) {
                if (i+2 === classBreaks.length) {
                    div.innerHTML += '<i style="background:' + getColor(classBreaks[i], classBreaks, colorHex) + '"></i> ' +
                    classBreaks[i] + '+';
                    break
                } else {
                    div.innerHTML += '<i style="background:' + getColor(classBreaks[i], classBreaks, colorHex) + '"></i> ' +
                    classBreaks[i] + '&ndash;' + classBreaks[i+1] + '<br>';
                    
                }
            }
            return div;
        };
        legend.addTo(map);
    }

    // create charts default to canada
    var statscanRegion = 'Canada'
    createCharts(statscanRegion);

    // buttons to select map metrics
    // btnCase
    document.getElementById("btnCase").addEventListener("click", e => mapCaseTotal(e));
    const mapCaseTotal = e => {
       btnCase();
    };
    function btnCase() {
       var mapMetric = 'case_count';
       var classBreaks = [1,50,100,250,500,1000,2000,3000,6000,9000];
       var colorHex = ['#deebf7','#08306b']; // blue
       updateMap(mapMetric,classBreaks,colorHex);
    }

    // btnCaseNew
    document.getElementById("btnCaseNew").addEventListener("click", e => mapCaseNew(e));
    const mapCaseNew = e => {
        var mapMetric = 'case_new_count';
        var classBreaks = [1,5,15,20,30,50,75,100,200];
        var colorHex = ['#efedf5','#3f007d']; // purple
        updateMap(mapMetric,classBreaks,colorHex);
    };

    // btnMort
    document.getElementById("btnMort").addEventListener("click", e => mapMortTotal(e));
    const mapMortTotal = e => {
        var mapMetric = 'mort_count';
        var classBreaks = [1,10,20,50,100,200,300,400,500];
        var colorHex = ['#fee0d2','#a50f15']; // red
        updateMap(mapMetric,classBreaks,colorHex);
    };

    // btnMortNew
    document.getElementById("btnMortNew").addEventListener("click", e => mapMortNew(e));
    const mapMortNew = e => {
        var mapMetric = 'mort_new_count';
        var classBreaks = [1,2,5,7,10,15,20,25];
        var colorHex = ['#d4b9da','#67001f']; // pink
        var map;
        updateMap(mapMetric,classBreaks,colorHex);
    };

    // buttons to change map focus by canada region
    // btnCanada
    document.getElementById("btnCanada").addEventListener("click", e => btnCanada(e));
    const btnCanada = e => {
        var lat = '53.145743'; 
        var lon = '-95.424717';
        var mag = 4;
        map.setView([lat, lon], mag);
        var statscanRegion = 'Canada'
        createCharts(statscanRegion);
    };

    // btnBC
    document.getElementById("btnBC").addEventListener("click", e => btnBC(e));
    const btnBC = e => {
        var lat = '54.125813'; 
        var lon = '-123.335386';
        var mag = 5;
        map.setView([lat, lon], mag);
    };

    // btnPraries
    document.getElementById("btnPrairies").addEventListener("click", e => btnPrairies(e));
    const btnPrairies = e => {
        var lat = '54.125813'; 
        var lon = '-107.283329';
        var mag = 5;
        map.setView([lat, lon], mag);
    };

    // btnOntario
    document.getElementById("btnOntario").addEventListener("click", e => btnOntario(e));
    const btnOntario = e => {
        var lat = '45.348652';
        var lon = '-80.855413';
        var mag = 6;
        map.setView([lat, lon], mag);
    };

    // btnQuebec
    document.getElementById("btnQuebec").addEventListener("click", e => btnQuebec(e));
    const btnQuebec = e => { 
        var lat = '47.370079';  
        var lon = '-73.720318';
        var mag = 6;
        map.setView([lat, lon], mag);
    };

    // btnMaritimes
    document.getElementById("btnMaritimes").addEventListener("click", e => btnMaritimes(e));
    const btnMaritimes = e => {
        var lat = '47.002607';
        var lon = '-63.052471';
        var mag = 6;
        map.setView([lat, lon], mag);
    };
    
    // get color for legend and health region shape
    function getRegionCount(mapMetric,regionName,classBreaks,colorHex) {
        var regionColor;
        for(var i = 0; i < covidData.length; i++) {
            if (covidData[i]['statscan_arcgis_health_region'] === regionName) {
                regionColor = getColor(covidData[i][mapMetric],classBreaks,colorHex);
                break;
            }
        }
        return regionColor;
    }
    
    // get color based on map metric
    function getColor(n,classBreaks,colorHex) {
        var mapScale = chroma.scale(colorHex).classes(classBreaks);
        if (n === 0) {
            var regionColor = '#ffffff';
        } else { 
            var regionColor = mapScale(n).hex();
        }
        return regionColor
    }

    // action when user clicks on map boundary area
    function showRegionDetails(e) {
        if (e.target) { 
            var layer = e.target;
            // change region style when hover over
            layer.setStyle({
                color: 'black', //shape border color
                dashArray: '',
                weight: 2,
                opacity: 1
            });
            if (!L.Browser.ie && !L.Browser.opera) {
                layer.bringToFront();
            }
            var statscanRegion = layer.feature.properties.ENG_LABEL;
            createCharts(statscanRegion);
        }
    };

    // create charts
    function createCharts(statscanRegion) {
        // create region details and charts
        var regionCaseCount = getCaseCount(statscanRegion);
        var regionMortCount = getMortCount(statscanRegion);
        var regionProvince = getProvince(statscanRegion);
        var casePctCanada = parseFloat(regionCaseCount / caseTotalCanada * 100).toFixed(2)+"%";
        var mortPctCanada = parseFloat(regionMortCount / mortTotalCanada * 100).toFixed(2)+"%";
        
        // filter to case and mort data to selected region
        var caseSelectedRegion = caseWithStatscan.filter(function(d) { 
            if (statscanRegion === 'Canada') {
                return d.statscan_arcgis_health_region !== statscanRegion;
            } else {
                return d.statscan_arcgis_health_region === statscanRegion;
            }
        });
        var mortSelectedRegion = mortWithStatscan.filter(function(d) { 
            if (statscanRegion === 'Canada') {
                return d.statscan_arcgis_health_region !== statscanRegion;
            } else {
                return d.statscan_arcgis_health_region === statscanRegion;
            } 
        });

        // get min and max case and mort dates for selected region 
        caseDates = caseSelectedRegion.map(function(d) {
            return {"report_date": d.report_date};
        });
        minCaseDate = d3.min(caseDates.map(d=>d.report_date));
        maxCaseDate = d3.max(caseDates.map(d=>d.report_date));
        mortDates = mortSelectedRegion.map(function(d) {
            return {"report_date": d.report_date};
        });
        minMortDate = d3.min(mortDates.map(d=>d.report_date));
        maxMortDate = d3.max(mortDates.map(d=>d.report_date));
    
        // get new cases and morts for selected region
        var casesMaxDate = caseSelectedRegion.filter(function(d) { 
            return d.report_date === maxCaseDate; 
        });
        var mortsMaxDate = mortSelectedRegion.filter(function(d) { 
            return d.report_date === maxMortDate; 
        });
        var regionCaseNewCount = casesMaxDate.reduce((a, b) => +a + +b.cases, 0);
        var regionMortNewCount = mortsMaxDate.reduce((a, b) => +a + +b.deaths, 0);
        var caseNewPctCanada = parseFloat(regionCaseNewCount / caseNewCanada * 100).toFixed(2)+"%";
        var mortNewPctCanada = parseFloat(regionMortNewCount / mortNewCanada * 100).toFixed(2)+"%";

        // create count of days since last case for selected region
        if (maxCaseDate) {
            var caseTimeDiff = (new Date(lastUpdated)) - (new Date(maxCaseDate));
            var daysLastCase = parseInt(Math.round((caseTimeDiff / (1000 * 60 * 60 * 24)-1))).toString();
        } else {
            daysLastCase = null;
        }
        
        // create count of days since last mort for selected region
        if (maxMortDate) {
            var mortTimeDiff = (new Date(lastUpdated)) - (new Date(maxMortDate));
            var daysLastMort = parseInt(Math.round((mortTimeDiff / (1000 * 60 * 60 * 24)-1))).toString();
        } else {
            daysLastMort = null;
        }

        // create region details for left side region_details div
        document.getElementById('region_details').innerHTML = '<small><p><strong>' + regionProvince + '<br>' + statscanRegion + 
        '</strong><br>Total Cases: ' + regionCaseCount.toLocaleString() + ' (' + casePctCanada + ' Can)<br>New Cases: ' + regionCaseNewCount.toLocaleString() + ' (' + caseNewPctCanada + ' Can)' +
        '<br>Total Mortalities: ' + regionMortCount.toLocaleString() + ' (' + mortPctCanada + ' Can)<br>New Mortalities: ' + regionMortNewCount.toLocaleString() + ' (' + mortNewPctCanada + ' Can)' +  '<br>First: Case ' + checkNull(minCaseDate) + ' Mort ' + checkNull(minMortDate) + '<br>Last: Case ' + checkNull(maxCaseDate) + ' Mort ' + checkNull(maxMortDate) + '<br>Days since last: Case: ' + checkNull(daysLastCase) + ' Mort: ' + checkNull(daysLastMort) + '<br>Mort per case: ' + checkNull(getRatioMortCase(regionMortCount,regionCaseCount)) + '</p></small>';
        
        // group case counts by date to use in selected region chart
        var caseRegionByDate = d3.nest()
        .key(function(d) { return d.report_date; })
        .rollup(function(v) {
            return {
                case_count: d3.sum(v, function(d) { return d.cases; }),
                cum_case_count: d3.sum(v, function(d) { return d.cumulative_cases; }) 
            };
        })
        .entries(caseSelectedRegion)
        .map(function(group) {
            return {
                report_date: group.key,
                case_count: group.value.case_count,
                cum_case_count: group.value.cum_case_count
            }
        });
        
        // group mort counts by date to use in selected region chart
        var mortRegionByDate = d3.nest()
        .key(function(d) { return d.report_date; })
        .rollup(function(v) {
            return {
                mort_count: d3.sum(v, function(d) { return d.deaths; }),
                cum_mort_count: d3.sum(v, function(d) { return d.cumulative_deaths; }) 
            }; 
        })
        .entries(mortSelectedRegion)
        .map(function(group) {
            return {
                report_date: group.key,
                mort_count: group.value.mort_count,
                cum_mort_count: group.value.cum_mort_count
            }
        });

        //create daily cases chart
        // get max case count for region for y axis
        if(d3.max(caseRegionByDate.map(d=>d.case_count)) > 5) {
            var regionMaxDailyCaseCount = d3.max(caseRegionByDate.map(d=>d.case_count));
        } else {
            var regionMaxDailyCaseCount = 5;
        }
        
        if (regionCaseCount > 5) {
            var yAxis2RangeMaxCase = regionCaseCount;
        } else {
            var yAxis2RangeMaxCase = 5;
        }

        // not used - change y2 scale to log
        var yaxis2_type = 'linear';
        function changeY2scale() {
            var yaxis2_type = 'log';
            var yAxis2RangeMaxCase = log(regionCaseCount);
        }
        
        if(regionCaseCount > 0) {
            // create x and y axis data sets
            var xCases = [];
            var yCases = [];
            var xCasesCum = [];
            var yCasesCum = [];
            // create axes x and y arrays
            for (var i=0; i<caseRegionByDate.length; i++) {
                row = caseRegionByDate[i];
                xCases.push( row['report_date']);
                yCases.push( row['case_count']);
                xCasesCum.push( row['report_date']);
                yCasesCum.push( row['cum_case_count']);
            }
            // set up plotly chart
            var casesDaily = {
                name: 'Daily',
                //text: 'Daily',
                x: xCases,
                y: yCases,
                type: 'bar',
                width: 1000*3600*24,
                marker: {
                    color: 'rgb(169,169,169)',
                    line: {
                    color: 'rgb(169,169,169)',
                    width: 1
                    }
                }
            };
            var casesCum = {
                name: 'Cumulative',
                //text: 'Cumulative',
                x: xCasesCum,
                y: yCasesCum,
                yaxis: 'y2',
                type: 'scatter',
                mode: 'lines',
                line: {
                    shape: 'linear', 
                    color: 'rgb(64,64,64)',
                    width: 2
                },
                connectgaps: true
            };
            var casesMA = {
                name: '7D MA',
                //text: '7D MA',
                x: xCases,
                y: movingAverage(yCases, 7),
                yaxis: 'y',
                type: 'scatter',
                mode: 'lines',
                line: {
                    shape: 'linear', 
                    color: 'rgb(5,113,176)',
                    width: 2
                },
                connectgaps: true
            };
            var caseChartData = [casesDaily, casesCum, casesMA];
            var caseChartLayout = {
                title: {
                    text:'Cases',
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
                    y: 1,
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
                    //autotick: true,
                    //mirror: 'allticks',
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
                    range:[0, yAxis2RangeMaxCase],
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
        
        if(d3.max(mortRegionByDate.map(d=>d.mort_count)) > 5) {
            var regionMaxDailyMortCount = d3.max(mortRegionByDate.map(d=>d.mort_count));
        } else {
            var regionMaxDailyMortCount = 5;
        }
        
        if (regionMortCount > 5) {
            var yAxis2RangeMaxMort = regionMortCount;
        } else {
            var yAxis2RangeMaxMort = 5;
        }
        
        if(regionMortCount > 0) {
            // create x and y axis data sets
            var xMort = [];
            var yMort = [];
            var xMortCum = [];
            var yMortCum = [];

            for (var i=0; i<mortRegionByDate.length; i++) {
                row = mortRegionByDate[i];
                xMort.push( row['report_date'] );
                yMort.push( row['mort_count'] );
                xMortCum.push( row['report_date']);
                yMortCum.push( row['cum_mort_count']);
            }
            
            // set up plotly chart
            var mortsDaily = {
                name: 'Daily',
                //text: 'Daily',
                x: xMort,
                y: yMort,
                type: 'bar',
                width: 1000*3600*24,
                marker: {
                    color: 'rgb(169,169,169)',
                    line: {
                    color: 'rgb(169,169,169)',
                    width: 1
                    }
                }
            };
            var mortsCum = {
                name: 'Cumulative',
                //text: 'Cumulative',
                x: xMortCum,
                y: yMortCum,
                yaxis: 'y2',
                type: 'scatter',
                mode: 'lines',
                line: {
                    shape: 'linear',
                    color: 'rgb(64,64,64)',
                    width: 2
                },
                
                connectgaps: true
            };
            var mortsMA = {
                name: '7D MA',
                //text: '7D MA',
                x: xMort,
                y: movingAverage(yMort, 7),
                yaxis: 'y',
                type: 'scatter',
                mode: 'lines',
                line: {
                    shape: 'linear',
                    color: 'rgb(5,113,176)',
                    width: 2
                },
                connectgaps: true
            };
            var mortChartData = [mortsDaily, mortsCum, mortsMA];
            var mortChartLayout = {
                title: {
                    text:'Mortalities',
                    font: {
                        weight: "bold",
                        size: 12
                    },
                },
                showlegend: false,
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
                    //autotick: true,
                    //mirror: 'allticks',
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
                    range:[0, yAxis2RangeMaxMort],
                    overlaying: 'y',
                    side: 'right',
                    showgrid:false
                }
            };
            Plotly.newPlot('region_daily_morts_chart', mortChartData, mortChartLayout);
        } else {
            document.getElementById('region_daily_morts_chart').innerHTML = '';
        }
    }

    // left join function used to join datasets below
    function equijoinWithDefault(xs, ys, primary, foreign, sel, def) {
        const iy = ys.reduce((iy, row) => iy.set(row[foreign], row), new Map);
        return xs.map(row => typeof iy.get(row[primary]) !== 'undefined' ? sel(row, iy.get(row[primary])): sel(row, def));
    };

    // reformat case and mortality dates
    // orig format dd-mm-yyyy, but better as yyyy-mm-dd
    function reformatDate(oldDate) {
        var d = oldDate.split("-")
        var newDate = d[2] + '-' + d[1] + '-' + d[0]
        return newDate
    }
    
    // check if region value has value else write 'na'
    function checkNull(variable) {
        if (variable == null){
            return 'na'
        } else {
            return variable
        }
    }

    // calculate mort to case ratio value
    function getRatioMortCase(numerator, denominator) {
        if (denominator === 0 || isNaN(denominator)) {
            return null;
        }
        else {
            return (numerator / denominator).toFixed(3);
        }
    }

    // not used by could be used to transform daily counts to log
    function log(x) {
        return Math.log(x) / Math.LN10;
    }
    
    // moving average function
    function movingAverage(values, N) {
        let i = 0;
        let sum = 0;
        const means = new Float64Array(values.length).fill(NaN);
        for (let n = Math.min(N - 1, values.length); i < n; ++i) {
            sum += values[i];
        }
        for (let n = values.length; i < n; ++i) {
            sum += values[i];
            means[i] = parseInt(sum / N);
            sum -= values[i - N + 1];
        }
        return means;
    }

    // action when user mouses over map
    function mouseOverActions(e) {
        var layer = e.target;
        // change region style when hover over
        layer.setStyle({
            color: 'black', //shape border color
            dashArray: '',
            weight: 2,
            opacity: 1
        });
        if (!L.Browser.ie && !L.Browser.opera) {
            layer.bringToFront();
        }
        var regionName = layer.feature.properties.ENG_LABEL;
        var regionCaseCount = getCaseCount(regionName);
        var regionMortCount = getMortCount(regionName);
        var regionCaseNewCount = getCaseNewCount(regionName);
        var regionMortNewCount = getMortNewCount(regionName);
        var regionProvince = getProvince(regionName);
        var casePctCanada = parseFloat(regionCaseCount / caseTotalCanada * 100).toFixed(2)+"%";
        var mortPctCanada = parseFloat(regionMortCount / mortTotalCanada * 100).toFixed(2)+"%";
        var caseNewPctCanada = parseFloat(regionCaseNewCount / caseNewCanada * 100).toFixed(2)+"%";
        var mortNewPctCanada = parseFloat(regionMortNewCount / mortNewCanada * 100).toFixed(2)+"%";

        document.getElementsByClassName('infobox')[0].innerHTML = '<p">' + regionProvince + ' <br>' + regionName + '<br>Total Cases: ' + regionCaseCount.toLocaleString() + ' (' + casePctCanada + ' Can)<br>New Cases: ' + regionCaseNewCount.toLocaleString() + ' (' + caseNewPctCanada + ' Can)' +
        '<br>Total Mortalities: ' + regionMortCount.toLocaleString() + ' (' + mortPctCanada + ' Can)<br>New Mortalities: ' + regionMortNewCount.toLocaleString() + ' (' + mortNewPctCanada + ' Can)</p><p><strong>Click map region to show detail on left.</strong></p>';
    };

    // calculate mort to case ratio
    function getRatioMortCase(numerator, denominator) {
        if (denominator === 0 || isNaN(denominator)) {
            return '0.000';
        }
        else {
            return (numerator / denominator).toFixed(3);
        }
    }
    
    // get case counts from working group data
    function getCaseCount(regionName) {
        var regionCaseCount = 0;
        if (regionName === 'Canada') {
            regionCaseCount = caseTotalCanada;
        } else {
            for(var i = 0; i < covidData.length; i++) {
                var obj = covidData[i];
                if (obj.statscan_arcgis_health_region === regionName) {
                    regionCaseCount = obj.case_count;
                    break;
                }
            }
        }
        if (regionCaseCount == null) {
            regionCaseCount = 0; 
    }
    return regionCaseCount;
    }

    // get new case counts from working group data
    function getCaseNewCount(regionName) {
        var regionCaseNewCount = 0;
        if (regionName === 'Canada') {
            regionCaseNewCount = caseTotalCanada;
        } else {
            for(var i = 0; i < covidData.length; i++) {
                var obj = covidData[i];
                if (obj.statscan_arcgis_health_region === regionName) {
                    regionCaseNewCount = obj.case_new_count;
                    break;
                }
            }
        }
        if (regionCaseNewCount == null) {
            regionCaseNewCount = 0; 
    }
    return regionCaseNewCount;
    }

    // get new mort counts from working group data
    function getMortNewCount(regionName) {
        var regionMortNewCount = 0;
        if (regionName === 'Canada') {
            regionMortNewCount = mortTotalCanada;
        } else {
            for(var i = 0; i < covidData.length; i++) {
                var obj = covidData[i];
                if (obj.statscan_arcgis_health_region === regionName) {
                    regionMortNewCount = obj.mort_new_count;
                    break;
                }
            }
        }
        if (regionMortNewCount == null) {
            regionMortNewCount = 0; 
    }
    return regionMortNewCount;
    }

    // get mortality counts from working group data
    function getMortCount(regionName) {
        var regionMortCount = 0;
        if (regionName === 'Canada') {
            regionMortCount = mortTotalCanada;
        } else {
            for(var i = 0; i < covidData.length; i++) {
                var obj = covidData[i];
                if (obj.statscan_arcgis_health_region === regionName) {
                    regionMortCount = obj.mort_count;
                    break;
                }
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
        if (regionName === 'Canada') {
            regionProvince = '<em>Click map to see region</em>';
        } else {
            for(var i = 0; i < covidData.length; i++) {
                var obj = covidData[i];
                if (obj.statscan_arcgis_health_region === regionName) {
                    regionProvince = obj.province;
                    break;
                }
            }
        }
    return regionProvince;
    }

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
        thead_tr.append("<th style='text-align: right';>New Case Count</th>");
        thead_tr.append("<th style='text-align: right';>New Mort Count</th>");thead_tr.append("<th style='text-align: right';>New Case % Canada</th>");
        thead_tr.append("<th style='text-align: right';>New Mort % Canada</th>");
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
            tbody_tr.append("<td style='text-align: right';>" + obj.case_new_count + "</td>");
            tbody_tr.append("<td style='text-align: right';>" + obj.mort_new_count + "</td>");
            tbody_tr.append("<td style='text-align: right';>" + parseFloat(obj.case_new_count / caseNewCanada * 100).toFixed(2) + "</td>");
            tbody_tr.append("<td style='text-align: right';>" + parseFloat(obj.mort_new_count / mortNewCanada * 100).toFixed(2) + "</td>");
        }
    });

    // add tablesorter js to allow user to sort table by column headers
    $(document).ready(function($){ 
        $("#covid_tabular").tablesorter();
    }); 

});
