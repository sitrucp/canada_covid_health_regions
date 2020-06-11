
//GET DATA=================================
// get case, mortality csv files from working group github repository
// get health region lookup csv from my github repository
var file_cases = "https://raw.githubusercontent.com/ishaberry/Covid19Canada/master/cases.csv";
var file_mortality = "https://raw.githubusercontent.com/ishaberry/Covid19Canada/master/mortality.csv";
var file_update_time = "https://raw.githubusercontent.com/ishaberry/Covid19Canada/master/update_time.txt";
var file_hr_lookup = "https://raw.githubusercontent.com/sitrucp/canada_covid_health_regions/master/health_regions_lookup.csv";
//var file_case_days = "https://canada-covid-data.s3.amazonaws.com/case_last_dates.csv";

Promise.all([
    d3.csv(file_cases),
    d3.csv(file_mortality),
    d3.csv(file_update_time),
    d3.csv(file_hr_lookup),
    //d3.csv(file_case_days)
]).then(function(data) {
    //everthing else below is in d3 promise scope
    // get data sets from promise
    var cases = data[0];
    var mortalities = data[1];
    var updateTime = data[2];
    var regionLookup = data[3];
    //var caseDays = data[4];

    // create reformatted case and mortality dates
    // case date orig format dd-mm-yyyy, but better as yyyy-mm-dd
    function reformatDate(oldDate) {
        var d = oldDate.split("-")
        var newDate = d[2] + '-' + d[1] + '-' + d[0]
        return newDate
    }

    // get update time from working group repository
    lastUpdated = updateTime.columns[0];
    
    // summarize cases and mortalities counts overall for header
    var caseTotalCanada = cases.length;
    var mortTotalCanada = mortalities.length;
    var div = document.getElementById('header');
    div.innerHTML += 'Total cases: ' + caseTotalCanada.toLocaleString() + ' Total mortalities: ' + mortTotalCanada.toLocaleString() + ' Date data updated: ' + lastUpdated;

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
    //var caseFiltered = caseWithStatscan.filter(function(row) { 
    //    return row.province === 'Quebec'; 
    //});

    caseWithStatscan.sort(function (a, b) {
        return d3.ascending(a.province, b.province) || d3.ascending(a.report_date, b.report_date) ;
    });
    
    // group case counts by date to use in selected region chart
    var caseProvByDate = d3.nest()
    .key(function(d) { return d.province; })
    .key(function(d) { return d.report_date; })
    .rollup(function(v) { return v.length; })
    .entries(caseWithStatscan)

    // create chart data
    var minCaseDate = d3.min(caseWithStatscan, d=>d.report_date);
    var maxCaseDate = d3.max(caseWithStatscan, d=>d.report_date);
    var maxDailyCases = d3.max(caseWithStatscan, d=>d.case_count);
    var rowCount = (caseProvByDate.length).toFixed();
    var chartVars = [];
    var chartColorRatios = [];
    var barColors = [];

    for (var i=1; i<caseProvByDate.length; i++) {
        var x = [];
        var y = [];
        var yRoll = [];
        // create new column last_date and copy report date where cases has value
        // fill forward from last date has value
        var totalProvinceCases = null;
        for (var j=0; j<caseProvByDate[i]['values'].length; j++) {
            x.push(caseProvByDate[i]['values'][j]['key']);
            y.push(caseProvByDate[i]['values'][j]['value']);
            totalProvinceCases += caseProvByDate[i]['values'][j]['value']
        }
        var yRoll = movingAverage(y, 7);
        var provRegion = caseProvByDate[i]['key'];
        var province = provRegion.split('|')[0];
        var region = provRegion.split('|')[1];
        var maxRegionCases = d3.max(y);
        var maxRegionCaseDate = d3.max(x);
        var minRegionCaseDate = d3.min(x);
        var timeDiff = (new Date(lastUpdated)) - (new Date(maxRegionCaseDate));
        var daysLastCase = parseInt(Math.round((timeDiff / (1000 * 60 * 60 * 24)-1)));
        //var regionColor = fillColor(daysLastCase);
        var maxCaseRecord = caseProvByDate[i]['values'].reduce((prev, current) => (+prev.value > +current.value) ? prev : current);
        var yMaxRatio = yRoll.map(getMaxRatio);
        
        function getMaxRatio(num) {
            return (Math.round((num / d3.max(yRoll)) * 10) / 10).toFixed(1);
        }

        var obj = { 
            x: x,
            y: y,
            yRoll: yRoll,
            yMaxRatio: yMaxRatio,
            totalProvinceCases: totalProvinceCases,
            provRegion: provRegion,
            province: province,
            region: region,
            maxRegionCases: maxRegionCases,
            maxRegionCaseDate: maxRegionCaseDate,
            minRegionCaseDate: minRegionCaseDate,
            daysLastCase: daysLastCase,
            maxCaseValueDate: maxCaseRecord['key']
        };
        chartVars.push(obj);
    }
    
    // sort chartvar regions by date of max case value
    chartVars.sort(function (a, b) {
        return d3.descending(a.maxCaseValueDate, b.maxCaseValueDate) ;
    });

    ///loop through chartVars array and create charts
    for (var i=1; i<chartVars.length; i++) {
        var data = {};
        var layout = {};
        var chartColorRatios = Object.values(chartVars[i]['yMaxRatio']);
        var barColors = chartColorRatios.map(getColor);
       
        // create trace i
        var data = {
            x: chartVars[i]['x'],
            y: chartVars[i]['yRoll'],
            type:'bar',
            //mode: 'markers',
            //line: {
           //     color: fillColor(chartVars[i]['daysLastCase'])
            // },
            //fill:'tozeroy',
            //fillcolor: fillColor(chartVars[i]['daysLastCase']),
            marker: {
               color: barColors
              },
        };
        
        var layout = {
            //title: {
            //    text: ''
            //    font: {
            //        size: 10,
            //      },
            //      xref: 'paper',
            //      x: 0.01,
            //      y: 1
            //},
            hovermode: false,
            autosize: true,
            width: 600,
            height: 50,
            margin: {
                l: 5,
                r: 5,
                b: 13,
                t: 10,
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
                range: [0, chartVars[i]['maxDailyCases']]
            }
        };
        var config = {
            responsive: true,
            displayModeBar: false
        };
        
        chartText = '<p class="chart-text"><strong><span class="province">' + chartVars[i]['province'] + '</span><span class="region"></span></strong><br><strong>F:</strong><span class="minRegionCaseDate">' + chartVars[i]['minRegionCaseDate'] + '</span> <strong>L:</strong><span class="maxRegionCaseDate">' + chartVars[i]['maxRegionCaseDate'] + '</span> <strong>T:</strong><span class="totalProvinceCases">' + chartVars[i]['totalProvinceCases'] + '</span> <strong>MDV:</strong><span class="maxRegionCases">' + chartVars[i]['maxRegionCases'] + '</span> <strong>MDD:</strong><span class="maxRegionCases">' + chartVars[i]['maxCaseValueDate'] + '</span> <strong> <strong>DL:</strong><span class="daysLastCase">' + chartVars[i]['daysLastCase'] + '</span></p>'
        
        //for loop to create 3 div float right 
        //for (var j=1; j<3; i++) {
            // create div and append chart to it iteratively
            let parent = document.getElementById('charts');
            let newChartDiv = document.createElement('div');
            newChartDiv.className = 'grid-item';
            newChartDiv.className += ' ' + chartVars[i]['province'].replace(' ', '-');
            //newChartDiv.className += ' ' + chartVars[i]['province'].replace(' ', '-');
            parent.append(newChartDiv);
            let newTextDiv = document.createElement('div');
            newTextDiv.className = 'stackedtext-div';
            newChartDiv.append(newTextDiv);
            newTextDiv.innerHTML += chartText;
        //}
        
        Plotly.newPlot(newChartDiv, [data], layout, config);
    }
});

    // get color based on map metric
    function getColor(d) {
        var colorScale = chroma.scale(['#ffeda0', '#de2d26'])
            .classes([0,0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9,1]);
        return colorScale(d).hex();
    }

    function formatDate(date) {
        var d = new Date(date),
            month = '' + (d.getMonth() + 1),
            day = '' + d.getDate(),
            year = d.getFullYear();
        if (month.length < 2) 
            month = '0' + month;
        if (day.length < 2) 
            day = '0' + day;
        return [year, month, day].join('-');
    }

    // get chart color
    function fillColor(days) {
        var daysColor = '';
        var colorWord = '';
        if (days === 0) {
            var daysColor = '#ff6666'; // red
            var colorWord = 'red';
        } else if (days > 0 && days < 7) {
            var daysColor = '#ef9000'; // orange
            var colorWord = 'orange';
        } else {
            var daysColor = '#259625'; // green
            var colorWord = 'green';
        }
        return daysColor
    }

    function movingAverage(values, N) {
        let i = 0;
        let sum = 0;
        const means = new Float64Array(values.length).fill(0);
        for (let n = Math.min(N - 1, values.length); i < n; ++i) {
            sum += values[i];
        }
        for (let n = values.length; i < n; ++i) {
            sum += values[i];
            means[i] = Math.ceil(sum / N);
            sum -= values[i - N + 1];
        }
        return means;
    }