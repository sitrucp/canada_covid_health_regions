
//=================================
// get case, mortality data from working group github files
// get health region lookup to map case, mortality data to map geojson boundary names

d3.queue()
.defer(d3.csv, "https://raw.githubusercontent.com/ishaberry/Covid19Canada/master/cases.csv")
.defer(d3.csv, "https://raw.githubusercontent.com/ishaberry/Covid19Canada/master/mortality.csv")
.defer(d3.csv, "https://raw.githubusercontent.com/sitrucp/canada_covid_health_regions/master/health_region_lookup.csv")
.await(function(error, cases, mortalities, hr_lookup) {

    // 1st step is to create new province + health_region concat field
    // counts by province and health_region
    cases.forEach(function(d) {
        d.prov_health_region_case = d.province + '|' + d.health_region
    });
    mortalities.forEach(function(d) {
        d.prov_health_region_mort = d.province + '|' + d.health_region
    });

    // 2nd step is to summarize cases and mortalities counts 
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

    // 3rd step is to add mortalities count value to cases array
    const equijoinWithDefault = (xs, ys, primary, foreign, sel, def) => {
        const iy = ys.reduce((iy, row) => iy.set(row[foreign], row), new Map);
        return xs.map(row => typeof iy.get(row[primary]) !== 'undefined' ? sel(row, iy.get(row[primary])): sel(row, def));
    };
    const case_mort_by_region = equijoinWithDefault(case_by_region, mort_by_region, "case_prov_health_region", "mort_prov_health_region", ({case_prov_health_region, case_count}, {mort_count}) => ({case_prov_health_region, case_count, mort_count}), {mort_count:0});

    // 4th step is to join cases & mortalities to hr_lookup
    // on the new province + health_region concat field
    const case_mort_by_region_final = equijoinWithDefault(case_mort_by_region, hr_lookup, "case_prov_health_region", "province_health_region", ({mort_count, case_count}, {province, authority_report_health_region, statscan_arcgis_health_region}) => ({province, authority_report_health_region, statscan_arcgis_health_region, case_count, mort_count}), {mort_count:0});
 
    var covid_data = case_mort_by_region_final;

    //=================================
    // now use covid_data obtained to populate map
    var map = L.map('map',{ zoomControl: false }).setView(['53.145743', '-102.283131'], 4);
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

    // add statscan health regions to map
    var geojson = L.geoJson(health_region_json, {
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
        return n > 2000 ? '#b10026'
            : n > 1500 ? '#e31a1c' 
            : n > 1000 ? '#fc4e2a' 
            : n > 500 ? '#fd8d3c'
            : n > 250  ? '#feb24c'
            : n > 100  ? '#fed976'
            : n > 50  ? '#ffeda0'
            : n > 0  ? '#ffffcc'
            : '#ffffff';
    }

    // add legend with color gradients by case count
    var legend = L.control({position: 'topright'});
    legend.onAdd = function (map) {
        var div = L.DomUtil.create('div', 'legend'),
            grades = [0, 50, 100, 250, 500, 1000, 1500, 2000],
            labels = [],
            from, to;
        for (var i = 0; i < grades.length; i++) {
            from = grades[i];
            if (i === 0) {
                var_from_to = grades[i];
                var_color = getColor(from);
            } else {
                var_from_to =  from + (grades[i + 1] ? '&ndash;' + grades[i + 1] : '+') ;
                var_color = getColor(from + 1);
            }
            labels.push(
                '<i style="background:' + var_color + '"></i> ' +
                var_from_to);
        }
        div.innerHTML = labels.join('<br>');
        return div;
    };
    legend.addTo(map);

    // control that shows state info on hover
    var infobox = L.control({position: 'topleft'});
    infobox.onAdd = function (map) {
        var div = L.DomUtil.create('div', 'infobox');
        var infobox = document.getElementsByClassName('infobox')[0];
        div.innerHTML = '<p>Hover over health region to see name and counts.</p>';
        return div;
    };
    infobox.addTo(map);

    //=================================
    // generate data table below map
    
    covid_data.sort((a,b) => a.province.localeCompare(b.province) || b.authority_report_health_region.localeCompare(b.authority_report_health_region));
    
    let table_data = covid_data;
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