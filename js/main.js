(function(){

var chartTitles = {"entropy_norm": 'Standard Occupational Classification Variability'};

var labelUnits = {"entropy_norm": 'variance'};

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
        .attr("class", "regions")
        .attr("data-state", function(d){
            return d.properties.STUSPS;
        })
        .attr("d", path)
        .style("fill", function(d){
            var value = d.properties[measure];
            if (value) {
                return colorScale(value);
            } else {
                return "#ccc";
            }
        })
        .on("mouseover", function(event, d){
            highlight(d.properties, measure);
        })
        .on("mouseout", function(event, d){
            dehighlight(d.properties);
        })
        .on("mousemove", moveLabel);

        var desc = regions.append("desc")
            .text('{"stroke": "#000", "stroke-width": "0.5px"}');
};

//function to create coordinated bar chart
function setChart(csvData, colorScale, measure){
    var startIndex = 0;
    var visibleCount = 20;

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
        .attr("class", "bar")
        .attr("data-state", function(d){
            return d.WORKSITE_STATE;
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
        })
        .on("mouseover", function(event, d){
            highlight(d, measure);
        })
        .on("mouseout", function(event, d){
            dehighlight(d);
        })
        .on("mousemove", moveLabel);

    var desc = bars.append("desc")
        .text('{"stroke": "none", "stroke-width": "0px"}');

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

//function to highlight enumeration units and bars
function highlight(d, measure){
    var key = d.WORKSITE_STATE || d.STUSPS;

    //change stroke
    d3.selectAll("[data-state='" + key + "']")
        .style("stroke", "blue")
        .style("stroke-width", "2");

    setLabel(d, measure);
};

//function to reset the element style on mouseout
function dehighlight(d){
    var key = d.WORKSITE_STATE || d.STUSPS;

    var selected = d3.selectAll("[data-state='" + key + "']")
        .style("stroke", function(){
            return getStyle(this, "stroke");
        })
        .style("stroke-width", function(){
            return getStyle(this, "stroke-width");
        });

    function getStyle(element, styleName){
        var styleText = d3.select(element)
            .select("desc")
            .text();

        var styleObject = JSON.parse(styleText);

        return styleObject[styleName];
    };

    d3.select(".infolabel")
        .remove();
};

//function to create dynamic label
function setLabel(props, measure){
    //label content
    var labelAttribute = "<h1>" + parseFloat(props[measure]).toFixed(2) +
        "</h1><b>" + labelUnits[measure] + "</b>";

    //create info label div
    var infolabel = d3.select(".container")
        .append("div")
        .attr("class", "infolabel")
        .attr("id", props.WORKSITE_STATE || props.STUSPS + "_label")
        .html(labelAttribute);

    var regionName = infolabel.append("div")
        .attr("class", "labelname")
        .html(props.WORKSITE_STATE || props.STUSPS);
};

//Example 2.8 line 1...function to move info label with mouse
function moveLabel(){
    //get width of label
    var labelWidth = d3.select(".infolabel")
        .node()
        .getBoundingClientRect()
        .width;

    //use coordinates of mousemove event to set label coordinates
    var x1 = event.clientX + 10,
        y1 = event.clientY - 75,
        x2 = event.clientX - labelWidth - 10,
        y2 = event.clientY + 25;

    //horizontal label coordinate, testing for overflow
    var x = event.clientX > window.innerWidth - labelWidth - 20 ? x2 : x1; 
    //vertical label coordinate, testing for overflow
    var y = event.clientY < 75 ? y2 : y1; 

    d3.select(".infolabel")
        .style("left", x + "px")
        .style("top", y + "px");
};

})();