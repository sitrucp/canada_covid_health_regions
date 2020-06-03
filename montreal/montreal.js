    var mapMetric = 'case_count';
    var colorHex = ['#deebf7','#08306b'];
    var classBreaks = [1,100,300,500,800,1000,1500,2000];
    var zoomCenter = ['45.504613', '-73.634624'];
    var zoomMag = 10;
   
   // create and populate map
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

    function updateMap(mapMetric,classBreaks,colorHex) {
        // add montreal  regions to map
        var layer_city = L.geoJson(montreal_regions, {
            style: function (feature) {
                return {
                    color: 'grey', //shape border color
                    dashArray: '3',
                    weight: 1,
                    opacity: 1,
                    fillColor: getRegionColor(mapMetric,feature.properties.district,classBreaks,colorHex),
                    fillOpacity: 1
                };
            },
            onEachFeature: function (feature, layer) {
                layer.on({
                    mouseover: mouseOverActions,
                    mouseout: function (e) {layer_city.resetStyle(e.target);
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

/////////////////

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
            opacity: 1
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
    function getRegionColor(mapMetric,geojsonName,classBreaks,colorHex) {
        var regionColor;
        for(var i = 0; i < covid_data.length; i++) {
            var obj = covid_data[i];
            if (obj.geojson_name === geojsonName) {
                regionColor = getColor(cleanSiteValue(covid_data[i][mapMetric]),classBreaks,colorHex);
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

    // buttons to select map metrics
    // btnCase
    document.getElementById("btnCase").addEventListener("click", e => mapCaseTotal(e));
    const mapCaseTotal = e => {
       btnCase();
    };
    function btnCase() {
       var mapMetric = 'case_count';
       var classBreaks = [1,100,300,500,800,1000,1500,2000];
       var colorHex = ['#deebf7','#08306b']; // blue
       updateMap(mapMetric,classBreaks,colorHex);
    }

    // btnMort
    document.getElementById("btnMort").addEventListener("click", e => mapMortTotal(e));
    const mapMortTotal = e => {
        var mapMetric = 'mort_count';
        var classBreaks = [1,10,20,50,100,200,300,400];
        var colorHex = ['#fee0d2','#a50f15']; // red
        updateMap(mapMetric,classBreaks,colorHex);
    };

    // btnCase100k
    document.getElementById("btnCase100k").addEventListener("click", e => mapCase100k(e));
    const mapCase100k = e => {
        btnCase100k();
    };
    function btnCase100k() {
       var mapMetric = 'case_per_100k';
       var classBreaks = [1,100,300,500,800,1000,1500,2000];
       var colorHex = ['#efedf5','#3f007d']; // purple
       updateMap(mapMetric,classBreaks,colorHex);
    }

    // btnMort100k
    document.getElementById("btnMort100k").addEventListener("click", e => mapMort100k(e));
    const mapMort100k = e => {
        btnMort100k();
    };
    function btnMort100k() {
       var mapMetric = 'mort_per_100k';
       var classBreaks = [1,10,20,50,100,200,300,400];
       var colorHex = ['#d4b9da','#67001f']; // pink
       updateMap(mapMetric,classBreaks,colorHex);
    }

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
