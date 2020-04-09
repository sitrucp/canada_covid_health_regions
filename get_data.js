

d3.queue()
.defer(d3.csv, "https://raw.githubusercontent.com/ishaberry/Covid19Canada/master/cases.csv")
.defer(d3.csv, "https://raw.githubusercontent.com/ishaberry/Covid19Canada/master/mortality.csv")
.defer(d3.csv, "https://raw.githubusercontent.com/sitrucp/canada_covid_health_regions/master/health_region_lookup.csv")
.await(function(error, cases, mortalities, hr_lookup) {

    //console.log(cases.length);
    //console.log(mortalities.length);
    //console.log(hr_lookup.length);

    // 1st step is to create new province + health_region concat field
    // counts by province and health_region
    cases.forEach(function(d) {
        d.prov_health_region_case = d.province + '|' + d.health_region
    });
    mortalities.forEach(function(d) {
        d.prov_health_region_mort = d.province + '|' + d.health_region
    });
   // console.log('hr_lookup ' + hr_lookup.length + ' ' + JSON.stringify(hr_lookup));
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
    //console.log('case_by_region ' + case_by_region.length + ' ' + JSON.stringify(case_by_region));

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
    //console.log('mort_by_region: ' + mort_by_region.length + ' ' + JSON.stringify(mort_by_region));

    // 3rd step is to add mortalities count value to cases array
    const equijoinWithDefault = (xs, ys, primary, foreign, sel, def) => {
        const iy = ys.reduce((iy, row) => iy.set(row[foreign], row), new Map);
        return xs.map(row => typeof iy.get(row[primary]) !== 'undefined' ? sel(row, iy.get(row[primary])): sel(row, def));
    };
    const case_mort_by_region = equijoinWithDefault(case_by_region, mort_by_region, "case_prov_health_region", "mort_prov_health_region", ({case_prov_health_region, case_count}, {mort_count}) => ({case_prov_health_region, case_count, mort_count}), {mort_count:0});
    //console.log('case_mort_by_region: ' + case_mort_by_region);

    // 4th step is to join cases & mortalities to hr_lookup
    // on the new province + health_region concat field
    const case_mort_by_region_final = equijoinWithDefault(case_mort_by_region, hr_lookup, "case_prov_health_region", "province_health_region", ({mort_count, case_count}, {province, authority_report_health_region, statscan_arcgis_health_region}) => ({province, authority_report_health_region, statscan_arcgis_health_region, case_count, mort_count}), {mort_count:0});
    
    var covid_data = JSON.stringify(case_mort_by_region_final);
    console.log('covid_data: ' + covid_data);

});


