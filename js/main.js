(function(){

//begin script when window loads
window.onload = setMap;

//set up choropleth map
function setMap(){
    
    var container = d3.select("#map-container").node();
    var width = container.clientWidth;
    var height = container.clientHeight;

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
    promises.push(d3.json("data/cb_2018_us_state_500k.json"));  
    Promise.all(promises).then(callback);    

    function callback(data){    

        var america = data[0];

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
        //franceRegions = joinData(franceRegions, csvData);

        //create the color scale
        //var colorScale = makeColorScale(csvData);

        //add regions
        //setEnumerationUnits(franceRegions, map, path, colorScale);

        //add coordinated visualization to the map
        //setChart(csvData, colorScale);

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

})();