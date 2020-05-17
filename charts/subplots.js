
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
    
    cases.forEach(function(d) {
        d.prov_health_region_case = d.province + '|' + d.health_region
        d.report_date = reformatDate(d.date_report)
    });

    // left join function used to join datasets below
    const equijoinWithDefault = (xs, ys, primary, foreign, sel, def) => {
        const iy = ys.reduce((iy, row) => iy.set(row[foreign], row), new Map);
        return xs.map(row => typeof iy.get(row[primary]) !== 'undefined' ? sel(row, iy.get(row[primary])): sel(row, def));
    };

    // left join lookup to case to get statscan region name
    const caseWithStatscan = equijoinWithDefault(
        cases, regionLookup, 
        "prov_health_region_case", "province_health_region", 
        ({date_report, report_date}, {province, authority_report_health_region, statscan_arcgis_health_region,province_health_region}, ) => 
        ({date_report, report_date, province, authority_report_health_region, statscan_arcgis_health_region, province_health_region}), 
        {province_health_region:null});

    caseWithStatscan.sort(function(a,b) {
        return d3.ascending(a.province_health_region, b.province_health_region || a.report_date, b.report_date);
    });

    // filter to case data to selected region
    var caseFiltered = caseWithStatscan.filter(function(row) { 
        return row.province === 'Alberta'; 
    });

    // group case counts by date to use in selected region chart
    var caseRegionByDate = d3.nest()
    .key(function(d) { return d.province_health_region; })
    .key(function(d) { return d.report_date; })
    .rollup(function(v) { return v.length; })
    .entries(caseWithStatscan)
    
    // create chart data
    var traces = [];
    var subplots = [];
    var annotations = [];
    var rowCount = (caseRegionByDate.length / 3).toFixed();
    var colCount = 3;

    for (var i=1; i<caseRegionByDate.length; i++) {
        var trace = {};
        var subplot = [];
        var annotation = {};
        var x = [];
        var y = [];
        for (var j=0; j<caseRegionByDate[i]['values'].length; j++) {
            //x.push(new Date(caseRegionByDate[i]['values'][j]['key']));
            x.push(caseRegionByDate[i]['values'][j]['key']);
            y.push(caseRegionByDate[i]['values'][j]['value']);
        }
        // create trace i
        trace = {
        "x":x,
        "y":y,
        "xaxis":"x"+ i,
        "yaxis":"y"+ i,
        "type":"scatter",
        "name": caseRegionByDate[i]['key']
        };
        // push trace to traces
        traces.push(trace);
        subplot = ['x0y0', 'x0y0'];
        subplots.push(subplot);
        annotation = {
            text: caseRegionByDate[i]['key'],
            showarrow: false,
            //xref: "x"+ i,
            //yref: "y"+ i,
            xref: "paper",
            yref: "paper",
            x: (1200 / 3),
            y: (5000 / 94 / 3),
            //x: 0.5,
            //y: 0.5
            //xanchor: "left",
            //yanchor: "top",
        };
        annotations.push(annotation);
    }

    console.log(JSON.stringify(annotations));

   var layout = {
    title: 'Health Regions',
    showlegend: false,
    annotations,
    //yaxis: {rangemode: 'tozero'},
    height: rowCount * 75,
    width: colCount * 300,
    grid: {
        rows: rowCount, 
        columns: colCount, 
        //subplots: subplots,
        pattern: 'independent',
        //roworder: 'bottom to top'
    },

    };

    Plotly.newPlot('charts', traces, layout);
 
});


