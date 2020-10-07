
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
    var div = document.getElementById('countSummary');
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
    var minCaseDate = d3.min(caseWithStatscan, d=>d.report_date);
    var maxCaseDate = d3.max(caseWithStatscan, d=>d.report_date);
    var maxDailyCases = d3.max(caseWithStatscan, d=>d.case_count);
    var rowCount = (caseRegionByDate.length / 3).toFixed();
    var arrColorWord = [];
   
    for (var i=1; i<caseRegionByDate.length; i++) {
        var x = [];
        var y = [];
        // create new column last_date and copy report date where cases has value
        // fill forward from last date has value
        var totalRegionCases = null;
        for (var j=0; j<caseRegionByDate[i]['values'].length; j++) {
            x.push(caseRegionByDate[i]['values'][j]['key']);
            y.push(caseRegionByDate[i]['values'][j]['value']);
            totalRegionCases += caseRegionByDate[i]['values'][j]['value']
        }

        var data = {};
        var layout = {};
        var provRegion = caseRegionByDate[i]['key'];
        var province = provRegion.split('|')[0];
        var region = provRegion.split('|')[1];
        var maxRegionCases = d3.max(y);
        var maxRegionCaseDate = d3.max(x);
        var minRegionCaseDate = d3.min(x);
        var timeDiff = (new Date(lastUpdated)) - (new Date(maxRegionCaseDate));
        var daysLastCase = parseInt(Math.round((timeDiff / (1000 * 60 * 60 * 24)-1)));
        var regionColor = fillColor(daysLastCase).colorWord;
        arrColorWord.push(regionColor);
        var zero_day_color = '#DC143C';
        var zero_7_days_color = '#FF9526';
        var grtr_7_days_color = '#228B22';
        
        function fillColor(days) {
            var daysColor = '';
            var colorWord = '';
            if (days === 0) {
                var daysColor = zero_day_color; // red
                var colorWord = 'red';
            } else if (days > 0 && days < 7) {
                var daysColor = zero_7_days_color; // orange
                var colorWord = 'orange';
            } else {
                var daysColor = grtr_7_days_color; // green
                var colorWord = 'green';
            }
            return { daysColor, colorWord }
        }

        function movingAverage(values, N) {
            let i = 0;
            let sum = 0;
            const means = new Float64Array(values.length).fill(NaN);
            for (let n = Math.min(N - 1, values.length); i < n; ++i) {
                sum += values[i];
            }
            for (let n = values.length; i < n; ++i) {
                sum += values[i];
                means[i] = sum / N;
                sum -= values[i - N + 1];
            }
            return means;
        }
        yRoll = movingAverage(y, 7);
        
        // create trace i
        var data = {
            x:x,
            y:yRoll,
            type:'scatter',
            mode: 'lines',
            line: {
                color: fillColor(daysLastCase).daysColor,
                width: 5
              },
            fill:'tozeroy',
            fillcolor: fillColor(daysLastCase).daysColor,
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
            width: 210,
            height: 40,
            margin: {
                l: 8,
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
                range: [0, maxDailyCases]
            }
        };
        var config = {
            responsive: true,
            displayModeBar: false
        };
        
        chartText = '<p class="chart-text"><strong><span class="province">' + province + '</span><span class="region"> - ' + region + '</span></strong><br><strong>F:</strong><span class="minRegionCaseDate">' + minRegionCaseDate + '</span> <strong>L:</strong><span class="maxRegionCaseDate">' + maxRegionCaseDate + '</span> <strong>T:</strong><span class="totalRegionCases">' + totalRegionCases + '</span> <strong>MD:</strong><span class="maxRegionCases">' + maxRegionCases + '</span> <strong>DL:</strong><span class="daysLastCase">' + daysLastCase + '</span></p>'

        // create div and append chart to it iteratively
        let parent = document.getElementById('small-charts');
        let newChartDiv = document.createElement('div');
        newChartDiv.className = 'grid-item';
        newChartDiv.className += ' ' + province.replace(' ', '-');
        newChartDiv.className += ' ' + region.replace(' ', '-');
        parent.append(newChartDiv);
        let newTextDiv = document.createElement('div');
        newTextDiv.className = 'text-div';
        newChartDiv.append(newTextDiv);
        newTextDiv.innerHTML += chartText;
        Plotly.newPlot(newChartDiv, [data], layout, config);
    }

    var countColorWord = arrColorWord.reduce((p, c) => {
        var color = c;
        if (!p.hasOwnProperty(color)) {
          p[color] = 0;
        }
        p[color]++;
        return p;
      }, {});

    var divDesc = document.getElementById('daysDescription');
    divDesc.innerHTML += '<p>Days since last case (DL) grouped by: <span style="color:' + grtr_7_days_color + '"> > 7 days (' + countColorWord.green + ')</span> | <span style="color:' + zero_7_days_color + '"> 1-7 days (' + countColorWord.orange + ')</span> | <span style="color:' + zero_day_color + '"> 0 days (' + countColorWord.red + ')</span></p>';

    // isotope
    var $grid = $('.grid').isotope({
        // options
        itemSelector: '.grid-item',
        layoutMode: 'fitRows',
        getSortData: {
            province: '.province',
            region: '.region',
            maxRegionCaseDate: '.maxRegionCaseDate',
            minRegionCaseDate: '.minRegionCaseDate',
            maxRegionCases: '.maxRegionCases parseInt',
            totalRegionCases: '.totalRegionCases parseInt',
            daysLastCase: '.daysLastCase parseInt',
            colorWord: '.colorWord'
        }
    });
    
    // bind sort button click
    $('.sort-btn').on( 'click', function() {
        var sortByValue = $(this).attr('data-sort-by');
        if ($(this).hasClass('active')) {
            $(this).removeClass('active');
            varSortOrder = true;
        } else {
            $(this).addClass('active');
            varSortOrder = false;
        }
        $grid.isotope({ 
            sortBy: sortByValue,
            sortAscending: varSortOrder
        });
    });

    // bind filter button click
    $(document).on("click", ".filter-btn", function(){
        var filterValue = $(this).attr('data-filter');
        $grid.isotope({ filter: filterValue });
    });

    // create region and province arrays
    var regionsDupes = [];
    var provincesDupes = [];
    for (var i=1; i<caseRegionByDate.length; i++) {
        regionsDupes.push(caseRegionByDate[i]['key'].split('|')[1]);
        provincesDupes.push(caseRegionByDate[i]['key'].split('|')[0]);
    }
    let regions = [...new Set(regionsDupes)];
    let provinces = [...new Set(provincesDupes)];

    // create filter buttons and add to filter div
    var newFilterUL = document.createElement('ul');
    document.getElementById('filters').append(newFilterUL);
    newFilterUL.className = 'list-inline';
    // filter label
    labelFilterLI = document.createElement('li');
    labelFilterLI.className = 'list-inline-item';
    labelFilterLI.innerHTML = 'Region:';
    newFilterUL.append(labelFilterLI);
    // all button
    allFilterLI = document.createElement('li');
    allFilterLI.className = 'list-inline-item';
    allFilterLI.className += ' btn btn-secondary';
    allFilterLI.className += ' btn-sm';
    allFilterLI.className += ' filter-btn';
    allFilterLI.setAttribute('data-filter', '*');
    allFilterLI.innerHTML = 'All';
    newFilterUL.append(allFilterLI);

    // add button for each province
    var provAbbrev = {
        'Alberta':'AB',
        'BC':'BC',
        'Manitoba':'MB',
        'New Brunswick':'NB',
        'NL':'NF',
        'NWT':'NT',
        'Nova Scotia':'NS',
        'Nunavut':'NU',
        'Ontario':'ON',
        'PEI':'PE',
        'Repatriated': 'Repatriated',
        'Quebec':'QC',
        'Saskatchewan':'SK',
        'Yukon':'YT',
    };
    
    function getProvAbbrev(province) {
        return provAbbrev[province];
    }
    for (i in provinces) {
        newFilterLI = document.createElement('li');
        newFilterLI.className = 'list-inline-item';
        newFilterLI.className += ' btn btn-primary';
        newFilterLI.className += ' btn-sm';
        newFilterLI.className += ' filter-btn';
        newFilterLI.setAttribute('data-filter', '.' + provinces[i].replace(' ', '-'));
        //newFilterLI.innerHTML = provinces[i];
        newFilterLI.innerHTML = getProvAbbrev(provinces[i]);
        newFilterUL.append(newFilterLI);
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

    summaryChart(700, 150);

    function summaryChart(width, height) {
        
    // create case days normalized stacked area chart
    var areaX = [];
    var y0days = [];
    var y1to7days = [];
    var y7plusdays = [];
    var chartWidth = width;
    var chartHeight = height;
    
    // case_dates_data from json file
    for (var i=1; i < case_dates_data.length; i++) {
        areaX.push(case_dates_data[i]['report_date']);
        y0days.push(case_dates_data[i]['0 days']);
        y1to7days.push(case_dates_data[i]['1-7 days']);
        y7plusdays.push(case_dates_data[i]['7+ days']);
    }

    var areaTraces = [
        {x: areaX, y: y0days, name: '', stackgroup: 'one', groupnorm:'percent', line: {color: zero_day_color}, fillcolor: zero_day_color},
        {x: areaX, y: y1to7days, name: '', stackgroup: 'one', line: {color: zero_7_days_color}, fillcolor: zero_7_days_color},
        {x: areaX, y: y7plusdays, name: '', stackgroup: 'one', line: {color: grtr_7_days_color}, fillcolor: grtr_7_days_color}
    ];

    var areaLayout = {
        showlegend: false,
        //hovermode: false,
        //autosize: true,
        width: chartWidth,
        height: chartHeight,
        margin: {
            l: 5,
            r: 5,
            b: 25,
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
            showgrid: false,
            range: [0, maxDailyCases],
            hoverformat: '.0f'
        }
    };
    var areaConfig = {
        responsive: true,
        displayModeBar: false
    };
    Plotly.newPlot('summary_chart', areaTraces, areaLayout, areaConfig);
    //////////////////////

    }
    
});



