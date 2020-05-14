regions = [{
    "x":[1, 2, 3],
    "y":[4, 5, 6],
    "xaxis":"x1",
    "yaxis":"y1",
    "type":"scatter"
},
{
    "x":[20, 30, 40],
    "y":[50, 60, 70],
    "xaxis":"x2",
    "yaxis":"y2",
    "type":"scatter"
},
{
    "x":[300, 400, 500],
    "y":[600, 700, 800],
    "xaxis":"x3",
    "yaxis":"y3",
    "type":"scatter"
},
{
    "x":[4000, 5000, 6000],
    "y":[7000, 8000, 9000],
    "xaxis":"x4",
    "yaxis":"y4",
    "type":"scatter"
}]

traces = [];

for (var i=0; i<regions.length; i++) {
    traces.push(regions[i]);
}
console.log(JSON.stringify(traces)); 

var layout = {
grid: {rows: 2, columns: 2, pattern: 'independent'},
};

Plotly.newPlot('multiple_charts', traces, layout);