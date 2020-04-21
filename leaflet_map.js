
//GET DATA=================================
// get case, mortality csv files from working group github repository
// get health region lookup csv from my github repository

d3.queue()
.defer(d3.csv, "https://raw.githubusercontent.com/ishaberry/Covid19Canada/master/cases.csv")
.defer(d3.csv, "https://raw.githubusercontent.com/ishaberry/Covid19Canada/master/mortality.csv")
.defer(d3.csv, "https://raw.githubusercontent.com/ishaberry/Covid19Canada/master/update_time.txt")
.defer(d3.csv, "https://raw.githubusercontent.com/sitrucp/canada_covid_health_regions/master/health_regions_lookup.csv")
.await(function(error, cases, mortalities, update_time, hr_lookup) {
    //everthing else below is in d3.queue scope

    // create new province + health_region concat field
    // counts by province and health_region
    cases.forEach(function(d) {
        d.prov_health_region_case = d.province + '|' + d.health_region
    });
    mortalities.forEach(function(d) {
        d.prov_health_region_mort = d.province + '|' + d.health_region
    });

    // get update time 
    last_updated = update_time.columns[0];

    // summarize cases and mortalities counts overall
    var case_total = cases.length;
    var mort_total = mortalities.length;
    var div = document.getElementById('header');
    div.innerHTML += 'Canada total: cases: ' + case_total.toLocaleString() + ' mortalities: ' + mort_total.toLocaleString() + ' Date data updated: ' + last_updated;

    // summarize cases and mortalities counts 
    // by province and health_region
    var case_by_region = d3.nest()
        .key(function(d) { return d.prov_health_region_case; })
        .rollup(function(v) { return v.length; })
        .entries(cases)
        .map(function(group) {
            return {
            case_prov_health_region: group.key,
            case_count: group.value
            }
        });

    var mort_by_region = d3.nest()
        .key(function(d) { return d.prov_health_region_mort; })
        .rollup(function(v) { return v.length; })
        .entries(mortalities)
        .map(function(group) {
            return {
            mort_prov_health_region: group.key,
            mort_count: group.value
            }
        });

    // left join function
    const equijoinWithDefault = (xs, ys, primary, foreign, sel, def) => {
        const iy = ys.reduce((iy, row) => iy.set(row[foreign], row), new Map);
        return xs.map(row => typeof iy.get(row[primary]) !== 'undefined' ? sel(row, iy.get(row[primary])): sel(row, def));
    };

    // left join summarized case records to lookup
    const case_by_region_lookup = equijoinWithDefault(
        hr_lookup, case_by_region, 
        "province_health_region", "case_prov_health_region", 
        ({province, authority_report_health_region, statscan_arcgis_health_region}, {case_prov_health_region, case_count}) => 
        ({province, authority_report_health_region, statscan_arcgis_health_region, case_prov_health_region, case_count}), 
        {case_count:0, case_prov_health_region: "ProvinceName|Not Reported"});

    // left join summarized mort records to lookup
    const mort_by_region_lookup = equijoinWithDefault(
        hr_lookup, mort_by_region, 
        "province_health_region", "mort_prov_health_region", 
        ({province, authority_report_health_region, statscan_arcgis_health_region}, {mort_prov_health_region, mort_count}) => 
        ({province, authority_report_health_region, statscan_arcgis_health_region, mort_prov_health_region, mort_count}), 
        {mort_count:0, case_prov_health_region: "ProvinceName|Not Reported"});
    
    // add mortalities count value to cases array
    const case_mort_by_region = equijoinWithDefault(case_by_region_lookup, mort_by_region_lookup, "case_prov_health_region", "mort_prov_health_region", ({case_prov_health_region, case_count}, {mort_count}) => ({case_prov_health_region, case_count, mort_count}), {mort_count:0});
    

    // join hr_lookup to cases & mortalities
    // on the new province + health_region concat field
    //const case_mort_by_region_final = equijoinWithDefault(case_mort_by_region, hr_lookup, "case_prov_health_region", "province_health_region", ({mort_count, case_count}, {province, authority_report_health_region, statscan_arcgis_health_region}) => ({province, authority_report_health_region, statscan_arcgis_health_region, case_count, mort_count}), {mort_count:0});

    const case_mort_by_region_final = equijoinWithDefault(
        hr_lookup, case_mort_by_region, 
        "province_health_region", "case_prov_health_region", 
        ({province, authority_report_health_region, statscan_arcgis_health_region}, {mort_count, case_count}) => 
        ({province, authority_report_health_region, statscan_arcgis_health_region, case_count, mort_count}), 
        {province_health_region:null,case_count:0, mort_count:0});

    //declare final covid dataset to put on map
    var covid_data = case_mort_by_region_final;

//CREATE MAP=================================
    // now use covid_data obtained to populate map
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
                click: zoomToFeature
            });
        }
    }).addTo(map);

    /*
    // add statscan health region boundaries to map
    var geojsonUS = L.geoJson(us_counties, {
        style: function (feature) {
            return {
                color: 'grey', //shape border color
                dashArray: '3',
                weight: 1,
                opacity: 1,
                fillColor: getRegionColor(feature.properties.NAME),
                fillOpacity: .7
            };
        },
        onEachFeature: function (feature, layer) {
            layer.on({
                mouseover: mouseOverActions,
                mouseout: mouseOutActions,
                click: zoomToFeature
            });
        }
    }).addTo(map);
    */

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
        document.getElementsByClassName('infobox')[0].innerHTML = '<p>Province:' + regionProvince + ': <br>' + 'Health Region: ' + regionName + '<br>' + 'Confirmed cases: ' + caseCount + '<br>' + 'Mortalities: ' + mortCount + '</p>';
    };

    function mouseOutActions(e) {
        geojson.resetStyle(e.target);
        //geojsonUS.resetStyle(e.target);
        document.getElementsByClassName('infobox')[0].innerHTML = '<p>Hover over health region to see name and counts. Scroll to zoom.</p>';
    }

    function zoomToFeature(e) {
        map.fitBounds(e.target.getBounds());
    }

    // get case counts from covid_data.json file by health region 
    function getCaseCount(regionName) {
        var caseCount = 0;
        for(var i = 0; i < covid_data.length; i++) {
            var obj = covid_data[i];
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

    getMortCount
    // get mortality counts from covid_data.json file by health region 
    function getMortCount(regionName) {
        var mortCount = 0;
        for(var i = 0; i < covid_data.length; i++) {
            var obj = covid_data[i];
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

    // get health region province bc it isn't in Statscan boundary file 
    function getProvince(regionName) {
        var regionProvince;
        for(var i = 0; i < covid_data.length; i++) {
            var obj = covid_data[i];
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
        for(var i = 0; i < covid_data.length; i++) {
            var obj = covid_data[i];
            if (obj.statscan_arcgis_health_region === regionName) {
                regionColor = getColor(obj.case_count);
                break;
            }
        }
        return regionColor;
    }

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

//CREATE TABLE=================================
    // generate data table below map
    // sort table first
    covid_data.sort((a,b) => a.province.localeCompare(b.province) || a.authority_report_health_region.localeCompare(b.authority_report_health_region));

    //let table_data = covid_data;
    let table_data = covid_data.map(x => ({ 
        "Province": x.province,
        "Health Authority Region Name": x.authority_report_health_region,
        "Statscan Region Name": x.statscan_arcgis_health_region,
        "Case Count": x.case_count,
        "Mortality Count": x.mort_count
    }));
    function generateTableHead(table, data) {
        let thead = table.createTHead();
        let row = thead.insertRow();
        for (let key of data) {
            let th = document.createElement("th");
            let text = document.createTextNode(key);
            th.appendChild(text);
            row.appendChild(th);
        }
    }
        function generateTable(table, data) {
        for (let element of data) {
            let row = table.insertRow();
            for (key in element) {
                let cell = row.insertCell();
                let text = document.createTextNode(element[key]);
                cell.appendChild(text);
            }
        }
    }
    let table = document.querySelector("table");
    let data = Object.keys(table_data[0]);
    generateTableHead(table, data);
    generateTable(table, table_data);

});