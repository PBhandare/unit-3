(function(){

var chartTitles = {"entropy_norm": 'Standard Occupational Classification Variability'};

//chart frame dimensions
var chartWidth = window.innerWidth * 0.4,
    chartHeight = window.innerHeight * 0.6,
    leftPadding = 25,
    rightPadding = 2,
    topBottomPadding = 5,
    chartInnerWidth = chartWidth - leftPadding - rightPadding,
    chartInnerHeight = chartHeight - topBottomPadding * 2,
    translate = "translate(" + leftPadding + "," + topBottomPadding + ")";

//create a scale to size bars proportionally to frame and for axis
var yScale = d3.scaleLinear()
    .range([chartInnerHeight, 0])
    .domain([0, 100]);

//begin script when window loads
window.onload = setMap;

//set up choropleth map
function setMap(){
    
    var container = d3.select("#map-container").node();
    var width = container.clientWidth;
    var height = container.clientHeight * 0.95;

    var map = d3.select("#map-container")
        .append("svg")
        .attr("class", "map")
        .attr("width", width)
        .attr("height", height);

    var projection = d3.geoAlbers()
        .scale(750)
        .translate([width / 2, height / 2]);

    var path = d3.geoPath()
        .projection(projection);

    //load data
    var promises = [];    
    promises.push(d3.json("data/project/cb_2018_us_state_500k.json"));
    promises.push(d3.csv("data/project/HSOC.csv"));
    promises.push(d3.csv("data/project/Q12025.csv"));
    promises.push(d3.csv("data/project/Q12025H1BDep.csv"));
    promises.push(d3.csv("data/project/SOCp.csv"));
    Promise.all(promises).then(callback);    

    function callback(data){    

        var america = data[0];
        var entropy = data[1];
        var full = data[2];
        var trunc = data[3];
        var fullProp = data[4];

        //place graticule
        setGraticule(map, path);

        //translate topojson
        var states = topojson.feature(america, america.objects.cb_2018_us_state_500k);

        //add American states
        map.append("path")
            .datum(states)
            .attr("class", "states")
            .attr("d", path);

        //join data
        entropyView = joinData(states.features, entropy, ['WORKSITE_STATE', 'entropy_norm']);

        //create the color scale
        var entropyColorScale = makeColorScale(entropy, 'entropy_norm');

        //add regions
        setEnumerationUnits(states.features, map, path, entropyColorScale, 'entropy_norm');

        //add coordinated visualization to the map
        setChart(entropy, entropyColorScale, 'entropy_norm');

        //createDropdown(csvData);
    };
};

//GRATICULE FUNCTION
function setGraticule(map, path){

    var graticule = d3.geoGraticule()
        .step([5, 5]);

    //background
    map.append("path")
        .datum(graticule.outline())
        .attr("class", "gratBackground")
        .attr("d", path);

    //lines
    map.selectAll(".gratLines")
        .data(graticule.lines())
        .enter()
        .append("path")
        .attr("class", "gratLines")
        .attr("d", path);
};

function joinData(regions, data, attrArray){

    for (var i = 0; i < data.length; i++){
        var dataState = data[i];
        var dataKey = dataState.WORKSITE_STATE;

        for (var a = 0; a < regions.length; a++){
            var geoProps = regions[a].properties;
            var geoKey = geoProps.STUSPS;

            if (geoKey == dataKey){
                attrArray.forEach(function(attr){
                    var val = parseFloat(dataState[attr]);
                    geoProps[attr] = val;
                });
            };
        };
    };

    return regions;
};

function makeColorScale(data, measure){
    var colorClasses = [
        "#D4B9DA",
        "#C994C7",
        "#DF65B0",
        "#DD1C77",
        "#980043"
    ];

    //create color scale generator
    var colorScale = d3.scaleQuantile()
        .range(colorClasses);

    //build two-value array of minimum and maximum expressed attribute values
    var minmax = [
        d3.min(data, function(d) { return parseFloat(d[measure]); }),
        d3.max(data, function(d) { return parseFloat(d[measure]); })
    ];

    //assign two-value array as scale domain
    colorScale.domain(minmax);

    return colorScale;
};

function setEnumerationUnits(regions, map, path, colorScale, measure){

    var regions = map.selectAll(".regions")
        .data(regions)
        .enter()
        .append("path")
        .attr("class", function(d){
            return "regions " + d.properties.STUSPS;
        })
        .attr("d", path)
        .style("fill", function(d){
            var value = d.properties[measure];
            if (value) {
                return colorScale(value);
            } else {
                return "#ccc";
            }
        });
};

//function to create coordinated bar chart
function setChart(csvData, colorScale, measure){
    //create a second svg element to hold the bar chart
    var chart = d3.select(".chart-block[data-attr='" + measure + "']")
        .append("svg")
        .attr("width", chartWidth)
        .attr("height", chartHeight)
        .attr("class", "chart");

    //create a rectangle for chart background fill
    var chartBackground = chart.append("rect")
        .attr("class", "chartBackground")
        .attr("width", chartInnerWidth)
        .attr("height", chartInnerHeight)
        .attr("transform", translate);

    var yScale = d3.scaleLinear()
        .range([chartInnerHeight, 0])
        .domain([
            0,
            d3.max(csvData, d => parseFloat(d[measure])) * 1.1
        ]);

    //set bars for each province
    var bars = chart.selectAll(".bar")
        .data(csvData)
        .enter()
        .append("rect")
        .sort(function(a, b){
            return b[measure]-a[measure]
        })
        .attr("class", function(d){
            return "bar " + d.WORKSITE_STATE;
        })
        .attr("width", chartInnerWidth / csvData.length - 1)
        .attr("x", function(d, i){
            return i * (chartInnerWidth / csvData.length) + leftPadding;
        })
        .attr("height", function(d, i){
            return chartInnerHeight - yScale(parseFloat(d[measure]));
        })
        .attr("y", function(d, i){
            return yScale(parseFloat(d[measure])) + topBottomPadding;
        })
        .style("fill", function(d){
            return colorScale(d[measure]);
        });

    var barWidth = chartInnerWidth / csvData.length;

    //annotate bars with attribute value text
    numbers = chart.selectAll(".numbers")
        .data(csvData)
        .enter()
        .append("text")
        .sort(function(a, b){
            return b[measure] - a[measure];
        })
        .attr("class", function(d){
            return "numbers " + d.WORKSITE_STATE;
        })
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("transform", function(d, i){

            var x = leftPadding + i * barWidth + barWidth / 2;
            var y = topBottomPadding + yScale(parseFloat(d[measure])) + 10;

            return "translate(" + x + "," + y + ") rotate(-90)";
        })
        .style("font-size", function(){
            return Math.max(6, barWidth * 0.6) + "px";
        })
        .text(function(d){
            var val = parseFloat(d[measure]);
            return isNaN(val) ? "" : val.toFixed(2);
        });

    //create a text element for the chart title
    var chartTitle = chart.append("text")
        .attr("x", 40)
        .attr("y", 30)
        .attr("class", "chartTitle")
        .text(chartTitles[measure] + " by State");

    //create vertical axis generator
    var yAxis = d3.axisLeft()
        .scale(yScale);

    //place axis
    var axis = chart.append("g")
        .attr("class", "axis")
        .attr("transform", translate)
        .call(yAxis);

    //create frame for chart border
    var chartFrame = chart.append("rect")
        .attr("class", "chartFrame")
        .attr("width", chartInnerWidth)
        .attr("height", chartInnerHeight)
        .attr("transform", translate);
};

})();