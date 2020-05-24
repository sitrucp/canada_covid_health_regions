
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
    var colCount = 3;

    for (var i=1; i<caseRegionByDate.length; i++) {
        var x = [];
        var y = [];
        var totalRegionCases = null;
        for (var j=0; j<caseRegionByDate[i]['values'].length; j++) {
            x.push(caseRegionByDate[i]['values'][j]['key']);
            y.push(caseRegionByDate[i]['values'][j]['value']);
            totalRegionCases += caseRegionByDate[i]['values'][j]['value']
        }
        var data = {};
        var layout = {};
        var provRegion = caseRegionByDate[i]['key'];
        var province = caseRegionByDate[i]['key'].split('|')[0];
        var region = caseRegionByDate[i]['key'].split('|')[1];
        var maxRegionCases = d3.max(y);
        var maxRegionCaseDate = d3.max(x);
        var minRegionCaseDate = d3.min(x);
        var timeDiff = (new Date(lastUpdated)) - (new Date(maxRegionCaseDate));
        var daysLastCase = parseInt(Math.round((timeDiff / (1000 * 60 * 60 * 24)-1)));

        function fillColor(days) {
            var daysColor = '';
            var colorWord = '';
            if (days === 0) {
                var daysColor = '#ff6666'; // red
                var colorWord = 'red';
            } else if (days < 8) {
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
        yRoll = movingAverage(y, 5);
        
        // create trace i
        var data = {
            x:x,
            y:yRoll,
            type:'scatter',
            mode: 'lines',
            line: {
                color: fillColor(daysLastCase)
              },
            fill:'tozeroy',
            fillcolor: fillColor(daysLastCase),
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
                range: [0, maxDailyCases]
            }
        };
        var config = {
            responsive: true,
            displayModeBar: false
        };
        
        chartText = '<p class="chart-text"><strong><span class="province">' + province + '</span><span class="region"> - ' + region + '</span></strong><br><strong>F:</strong><span class="minRegionCaseDate">' + minRegionCaseDate + '</span> <strong>L:</strong><span class="maxRegionCaseDate">' + maxRegionCaseDate + '</span> <strong>T:</strong><span class="totalRegionCases">' + totalRegionCases + '</span> <strong>MD:</strong><span class="maxRegionCases">' + maxRegionCases + '</span> <strong>DL:</strong><span class="daysLastCase">' + daysLastCase + '</span></p>'

        // create div and append chart to it iteratively
        let parent = document.getElementById('charts');
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
    labelFilterLI.innerHTML = 'Filters:';
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
    for (i in provinces) {
        newFilterLI = document.createElement('li');
        newFilterLI.className = 'list-inline-item';
        newFilterLI.className += ' btn btn-primary';
        newFilterLI.className += ' btn-sm';
        newFilterLI.className += ' filter-btn';
        newFilterLI.setAttribute('data-filter', '.' + provinces[i].replace(' ', '-'));
        newFilterLI.innerHTML = provinces[i].replace(' ', '-');
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
    
});



