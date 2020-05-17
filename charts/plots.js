
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
        ({report_date}, {province, authority_report_health_region, province_health_region}, ) => 
        ({report_date, province, authority_report_health_region,  province_health_region}), 
        {province_health_region:null});

    // filter to case data to selected region
    var caseFiltered = caseWithStatscan.filter(function(row) { 
        return row.province === 'Quebec'; 
    });

    caseWithStatscan.sort(function (a, b) {
        return d3.ascending(a.province_health_region, b.province_health_region) || d3.ascending(a.report_date, b.report_date) ;
    });

    // group case counts by date to use in selected region chart
    var caseRegionByDate = d3.nest()
    .key(function(d) { return d.province_health_region; })
    .key(function(d) { return d.report_date; })
    .rollup(function(v) { return v.length; })
    .entries(caseWithStatscan)
    
    // create chart data
    var chartDiv = document.getElementById('charts');
    var minCaseDate = d3.min(caseWithStatscan, d=>d.report_date);
    var maxCaseDate = d3.max(caseWithStatscan, d=>d.report_date);
    var maxDailyCases = d3.max(caseWithStatscan, d=>d.case_count);
    var rowCount = (caseRegionByDate.length / 3).toFixed();
    var colCount = 3;

    for (var i=1; i<caseRegionByDate.length; i++) {
        var x = [];
        var y = [];
        data = {};
        layout = {};
        for (var j=0; j<caseRegionByDate[i]['values'].length; j++) {
            x.push(caseRegionByDate[i]['values'][j]['key']);
            y.push(caseRegionByDate[i]['values'][j]['value']);
        }
        var maxDailyCases = d3.max(y);
        
        //console.log(caseRegionByDate[i]['key'] + "| " + JSON.stringify(x));
        // create trace i
        var data = {
            x:x,
            y:y,
            type:'scatter',
            mode: 'lines',
            line: {
                color: '#ab63fa'
              },
            fill:'tozeroy',
            fillcolor: '#ab63fa',
        };
        var layout = {
            title: {
                text: caseRegionByDate[i]['key'],
                font: {
                    size: 12,
                  },
                  xref: 'paper',
                  x: 0.01,
                  y: .7
            },
            autosize: true,
            width: 500,
            height: 40,
            margin: {
                l: 30,
                r: 10,
                b: 15,
                t: 5,
                pad: 0
            },
            xaxis: {
                autotick: true,
                mirror: 'allticks',
                type: "date",
                tickformat: "%b-%d",
                tickfont: {
                    size: 10
                },
                range:[
                    new Date(minCaseDate).getTime(), 
                    new Date(maxCaseDate).getTime()
                ],
                showgrid: false
            },
            yaxis: {
                showticklabels: false,
                tickmode: 'auto',
                nticks: 3,
                showgrid: false,
                tickfont: {
                    size: 10
                },
                tickformat: ',d',
                range: [0, maxDailyCases]
            }
        };
        var config = {
            responsive: true,
            displayModeBar: false
        };

        // create div and append chart to it iteratively
        var newDiv = document.createElement('div');
        chartDiv.appendChild(newDiv); 
        //document.getElementsByClassName('newDiv').innerHTML = '<p>'+ + '</p>';
        Plotly.newPlot(newDiv, [data], layout, config);
    }

});
