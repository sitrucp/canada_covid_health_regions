
var map = L.map('map',{ zoomControl: false }).setView(['45.504613', '-73.634624'], 10);
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

// add montreal  regions to map
var geojson = L.geoJson(montreal_regions, {
    style: function (feature) {
        return {
            color: 'grey', //shape border color
            dashArray: '3',
            weight: 1,
            opacity: 1,
            fillColor: getRegionColor(feature.properties.district),
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
    var geojsonName = layer.feature.properties.district;
    var caseCount = getCaseCount(geojsonName);
    var websiteName = getWebSiteName(geojsonName);
    document.getElementsByClassName('infobox')[0].innerHTML = '<p>Province: Quebec <br>' + 'Montreal Region: ' + websiteName + '<br>' + 'Confirmed cases: ' + caseCount + '</p>';
};

function mouseOutActions(e) {
    geojson.resetStyle(e.target);
    document.getElementsByClassName('infobox')[0].innerHTML = '<p>Hover over region to see name and counts. Scroll to zoom.</p>';
}

function zoomToFeature(e) {
    map.fitBounds(e.target.getBounds());
}

// count cases in covid_data.json file by health region 
function getCaseCount(geojsonName) {
    var caseCount = 0;
    for(var i = 0; i < covid_data.length; i++) {
        var obj = covid_data[i];
        if (obj.geojson_name === geojsonName) {
            caseCount = cleanCaseCount(obj.case_count);
            break;
         }
    }
    if (caseCount == null) {
        caseCount = 0; 
   }
   return caseCount;
}

// case color for legend and health region shape
function getRegionColor(geojsonName) {
    var regionColor;
    for(var i = 0; i < covid_data.length; i++) {
        var obj = covid_data[i];
        //console.log('obj.geojson_name ' + obj.geojson_name + ' geojsonName ' + geojsonName);
        if (obj.geojson_name === geojsonName) {
            regionColor = getColor(cleanCaseCount(obj.case_count));
            break;
        }
    }
    return regionColor;
}

// get health region province bc it isn't in Statscan boundary file 
function getWebSiteName(geojsonName) {
    var webSiteName;
    for(var i = 0; i < covid_data.length; i++) {
        var obj = covid_data[i];
        if (obj.geojson_name === geojsonName) {
            webSiteName = obj.website_name;
            break;
        }
    }
    return webSiteName;
    }

function getColor(n) {
    return n > 500 ? '#b10026'
        : n > 400 ? '#e31a1c' 
        : n > 300 ? '#fc4e2a' 
        : n > 200 ? '#fd8d3c'
        : n > 100  ? '#feb24c'
        : n > 50  ? '#fed976'
        : n > 25  ? '#ffeda0'
        : n > 0  ? '#ffffcc'
        : '#ffffff';
}

// add legend with color gradients by case count
var legend = L.control({position: 'topright'});
legend.onAdd = function (map) {
    var div = L.DomUtil.create('div', 'infobox legend'),
        grades = [0, 25, 50, 100, 200, 300, 400, 500],
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
    div.innerHTML = '<p>Hover over region to see name and counts. Scroll to zoom.</p>';
    return div;
};
infobox.addTo(map);

 // summarize cases counts overall and add to header
var case_total = 0;
for(var i = 0; i < covid_data.length; i++) {
    var obj = covid_data[i];
    if( obj.website_name.includes("Total") ) {
        case_total += cleanCaseCount(obj.case_count);
    }
}

function cleanCaseCount(case_count) {
    case_count_clean = parseInt(case_count.toString().replace(/\s/g, '').replace('<', ''));
    return case_count_clean;
}

case_count_clean = obj.case_count.toString().replace(/\s/g, '').replace('<', '');

const now = new Date();
const offsetMs = now.getTimezoneOffset() * 60 * 1000;
const dateLocal = new Date(now.getTime() - offsetMs);
const last_updated = dateLocal.toISOString().slice(0, 19).replace("T", " ");

 var div = document.getElementById('header');
 div.innerHTML += 'Montreal total cases: ' + case_total.toLocaleString() + ' Date data updated: ' + last_updated.toLocaleString();

 //CREATE TABLE=================================
    
 $(document).ready(function () {
        
    var thead;
    var thead_tr;
    thead = $("<thead>");
    thead_tr = $("<tr/>");
    thead_tr.append("<th>Region Name</th>");
    thead_tr.append("<th style='text-align: right';>Case Count</th>");
    thead_tr.append("</tr>");
    thead.append(thead_tr);
    $('table').append(thead);

    var tbody;
    var tbody_tr;
    tbody = $("<tbody>");
    $('table').append(tbody);
    for(var i = 0; i < covid_data.length; i++) {
        var obj = covid_data[i];
        tbody_tr = $('<tr/>');
        tbody_tr.append("<td>" + obj.website_name + "</td>");
        tbody_tr.append("<td style='text-align: right';>" + obj.case_count + "</td>");
        tbody.append(tbody_tr);
    }
});

$(document).ready(function($){ 
    $("#covid_tabular").tablesorter();
}); 
