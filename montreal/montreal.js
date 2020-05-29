
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
            click: showRegionDetails
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
    var mortCount = getMortCount(geojsonName);
    var websiteName = getWebSiteName(geojsonName);
    var casePct = ((parseFloat(cleanSiteValue(caseCount)) / parseFloat(case_total)) * 100).toFixed(2)
    var mortPct = ((parseFloat(cleanSiteValue(mortCount)) / parseFloat(mort_total)) * 100).toFixed(2)
    var casePer100k = getCasePer100k(geojsonName);
    var mortPer100k = getMortPer100k(geojsonName);
    
    document.getElementsByClassName('infobox')[0].innerHTML = 
    '<p>Montreal Region: ' + websiteName + 
    '<br>Confirmed cases: ' + caseCount + ' (' + casePct + '% Montreal)' + '<br>Mortalities: ' + mortCount + ' (' + mortPct + '% Montreal)' + 
    '<br>Mort per case: ' + getRatioMortCase(mortCount, caseCount) + 
    '<br>Case per 100k: ' + casePer100k + 
    '<br>Mort per 100k: ' + mortPer100k + 
    '</p>';
};

function getInfoText() {
    return '<p>Hover over map region to see details here. Click map region to see details in right side panel. Scroll to zoom.</p>';
}

function mouseOutActions(e) {
    geojson.resetStyle(e.target);
    document.getElementsByClassName('infobox')[0].innerHTML = getInfoText();
}

function zoomToFeature(e) {
    map.fitBounds(e.target.getBounds());
}

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
    var geojsonName = layer.feature.properties.district;
    var caseCount = getCaseCount(geojsonName);
    var mortCount = getMortCount(geojsonName);
    var websiteName = getWebSiteName(geojsonName);
    var casePct = ((parseFloat(cleanSiteValue(caseCount)) / parseFloat(case_total)) * 100).toFixed(2)
    var mortPct = ((parseFloat(cleanSiteValue(mortCount)) / parseFloat(mort_total)) * 100).toFixed(2)
    var casePer100k = getCasePer100k(geojsonName);
    var mortPer100k = getMortPer100k(geojsonName);

    document.getElementById('region_details').innerHTML = 
    '<small><p>Montreal Region: ' + websiteName + 
    '<br>Confirmed cases: ' + caseCount + ' (' + casePct + '% Montreal)' + '<br>Mortalities: ' + mortCount + ' (' + mortPct + '% Montreal)' + 
    '<br>Mort per case: ' + getRatioMortCase(mortCount, caseCount) + 
    '<br>Case per 100k: ' + cleanSiteValue(casePer100k) + 
    '<br>Mort per 100k: ' + cleanSiteValue(mortPer100k) + 
    '</p></small>';
};

function getRatioMortCase(numerator, denominator) {
    if (denominator === 0 || isNaN(denominator)) {
            return null;
    }
    else {
            return (numerator / denominator).toFixed(3);
    }
}

// case per 100k by health region 
function getCasePer100k(geojsonName) {
    var casePer100k = 0;
    for(var i = 0; i < covid_data.length; i++) {
        var obj = covid_data[i];
        if (obj.geojson_name === geojsonName) {
            casePer100k = cleanSiteValue(obj.case_per_100k);
            break;
         }
    }
    if (casePer100k == null || casePer100k === '') {
        casePer100k = 0; 
   }
   return casePer100k;
}

// mort per 100k by health region 
function getMortPer100k(geojsonName) {
    var mortPer100k = 0;
    for(var i = 0; i < covid_data.length; i++) {
        var obj = covid_data[i];
        if (obj.geojson_name === geojsonName) {
            mortPer100k = cleanSiteValue(obj.mort_per_100k);
            break;
         }
    }
    if (mortPer100k == null || mortPer100k === 'NaN') {
        mortPer100k = 0; 
   }
   return mortPer100k;
}


// count cases by health region 
function getCaseCount(geojsonName) {
    var caseCount = 0;
    for(var i = 0; i < covid_data.length; i++) {
        var obj = covid_data[i];
        if (obj.geojson_name === geojsonName) {
            caseCount = cleanSiteValue(obj.case_count);
            break;
         }
    }
    if (caseCount == null) {
        caseCount = 0; 
   }
   return caseCount;
}

// count mort count by health region 
function getMortCount(geojsonName) {
    var mortCount = 0;
    for(var i = 0; i < covid_data.length; i++) {
        var obj = covid_data[i];
        if (obj.geojson_name === geojsonName) {
            mortCount = cleanSiteValue(obj.mort_count);
            break;
         }
    }
    if (mortCount == null) {
        mortCount = 0; 
   }
   return mortCount;
}

// case color for legend and health region shape
function getRegionColor(geojsonName) {
    var regionColor;
    for(var i = 0; i < covid_data.length; i++) {
        var obj = covid_data[i];
        if (obj.geojson_name === geojsonName) {
            regionColor = getColor(cleanSiteValue(obj.case_count));
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

    /*
    // get color based on case count
    function getColor(n) {
        return n > 1500 ? '#023858'
            : n > 1300 ? '#045a8d' 
            : n > 1100 ? '#0570b0' 
            : n > 900 ? '#3690c0'
            : n > 700  ? '#74a9cf'
            : n > 500  ? '#a6bddb'
            : n > 300  ? '#d0d1e6'
            : n > 100  ? '#ece7f2'
            : n > 0  ? '#fff7fb'
            : '#ffffff';
    }
    */

    // get color based on case count
    function getColor(n) {
        var scaleClasses = [0,100,300,500,800,1000,1500,2000];
        var hex = ['deebf7','08306b'];
        var mapScale = chroma.scale(hex).classes(scaleClasses);
        var regionColor = mapScale(n);
        return regionColor
    }

// add legend with color gradients by case count
var legend = L.control({position: 'topright'});
legend.onAdd = function (map) {
    var div = L.DomUtil.create('div', 'infobox legend')
    var scaleClasses = [0,100,300,500,800,1000,1500,2000];
        labels = [];
    // loop through our density intervals and generate a label with a colored square for each interval
    for (var i = 0; i < scaleClasses.length; i++) {
        div.innerHTML +=
            '<i style="background:' + getColor(scaleClasses[i] + 1) + '"></i> ' +
            scaleClasses[i] + (scaleClasses[i + 1] ? '&ndash;' + scaleClasses[i + 1] + '<br>' : '+');
    }
    return div;
};
legend.addTo(map);

// control that shows state info on hover
var infobox = L.control({position: 'topleft'});
infobox.onAdd = function (map) {
    var div = L.DomUtil.create('div', 'infobox');
    var infobox = document.getElementsByClassName('infobox')[0];
    div.innerHTML = getInfoText();
    return div;
};
infobox.addTo(map);

 // summarize cases counts overall and add to header
var case_total = 0;
for(var i = 0; i < covid_data.length; i++) {
    var obj = covid_data[i];
    if( obj.website_name.includes("Total") ) {
        //console.log(obj.case_total);
        case_total += cleanSiteValue(obj.case_count);
    }
}


 // summarize mort counts overall and add to header
 var mort_total = 0;
 for(var i = 0; i < covid_data.length; i++) {
     var obj = covid_data[i];
     if( obj.website_name.includes("Total") ) {
        mort_total += cleanSiteValue(obj.mort_count);
     }
 }

function cleanSiteValue(site_value) {
    if (site_value !== undefined) {
        clean_count = parseInt((site_value).toString().replace('NaN', '0').replace('-', '0').replace(' ', '').replace(/\s/g, '').replace('<', '').replace(/\*/g, '').replace('n.p.', '0'));
        return clean_count;
    }
}

const now = new Date();
const offsetMs = now.getTimezoneOffset() * 60 * 1000;
const dateLocal = new Date(now.getTime() - offsetMs);
const last_updated = dateLocal.toISOString().slice(0, 19).replace("T", " ");

 var div = document.getElementById('header');
 div.innerHTML += '<p>Montreal totals: Confirmed cases: ' + case_total.toLocaleString() + ' Mortalities: ' + mort_total.toLocaleString() + ' Date data retrieved: ' + last_update_date + '</p>';

 //CREATE TABLE=================================
    
 $(document).ready(function () {
        
    var thead;
    var thead_tr;
    thead = $("<thead>");
    thead_tr = $("<tr/>");
    thead_tr.append("<th>Region Name</th>");
    thead_tr.append("<th style='text-align: right';>Case Count</th>");
    thead_tr.append("<th style='text-align: right';>Mortality Count</th>");
    thead_tr.append("<th style='text-align: right';>Case % Montreal</th>");
    thead_tr.append("<th style='text-align: right';>Mort % Montreal</th>");
    thead_tr.append("<th style='text-align: right';>Mort per Case</th>");
    thead_tr.append("<th style='text-align: right';>Case per 100k</th>");
    thead_tr.append("<th style='text-align: right';>Mort per 100k</th>");
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
        tbody_tr.append("<td style='text-align: right';>" + cleanSiteValue(obj.case_count) + "</td>");
        tbody_tr.append("<td style='text-align: right';>" + cleanSiteValue(obj.mort_count) + "</td>");
        tbody_tr.append("<td style='text-align: right';>" + ((parseFloat(cleanSiteValue(obj.case_count)) / parseFloat(case_total)) * 100).toFixed(2) + "</td>");
        tbody_tr.append("<td style='text-align: right';>" + ((parseFloat(cleanSiteValue(obj.mort_count)) / parseFloat(mort_total)) * 100).toFixed(2) + "</td>");
        tbody_tr.append("<td style='text-align: right';>" + getRatioMortCase(parseFloat(cleanSiteValue(obj.mort_count)), parseFloat(cleanSiteValue(obj.case_count))) + "</td>");
        tbody_tr.append("<td style='text-align: right';>" + cleanSiteValue(obj.case_per_100k) + "</td>");
        tbody_tr.append("<td style='text-align: right';>" + cleanSiteValue(obj.mort_per_100k) + "</td>");
        tbody.append(tbody_tr);
    }
});

$(document).ready(function($){ 
    $("#covid_tabular").tablesorter();
}); 
