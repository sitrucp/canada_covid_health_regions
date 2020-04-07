
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
    var regionProvince = getProvince(regionName);
    document.getElementsByClassName('infobox')[0].innerHTML = '<p>Province:' + regionProvince + ': <br>' + 'Health Region: ' + regionName + '<br>' + 'Confirmed cases: ' + caseCount + '</p>';
};

function mouseOutActions(e) {
    geojson.resetStyle(e.target);
    document.getElementsByClassName('infobox')[0].innerHTML = '<p>Hover over health region to see name and counts.</p>';
}

function zoomToFeature(e) {
    map.fitBounds(e.target.getBounds());
}

// count cases in covid_data.json file by health region 
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


