(function(){

//pseudo-global variables
var attrArray = ["varA", "varB", "varC", "varD", "varE"];
var expressed = attrArray[0];

//begin script when window loads
window.onload = setMap();

//set up choropleth map
function setMap(){
    
    var width = 960,
        height = 460;

    var map = d3.select("body")
        .append("svg")
        .attr("class", "map")
        .attr("width", width)
        .attr("height", height);

    var projection = d3.geoAlbers()
        .center([0, 46.2])
        .rotate([-2, 0, 0])
        .parallels([43, 62])
        .scale(2500)
        .translate([width / 2, height / 2]);

    var path = d3.geoPath()
        .projection(projection);

    //load data
    var promises = [];    
    promises.push(d3.csv("data/unitsData.csv"));   
    promises.push(d3.json("data/EuropeCountries.topojson"));   
    promises.push(d3.json("data/FranceRegions.topojson"));   
    Promise.all(promises).then(callback);    

    function callback(data){    

        var csvData = data[0],
            europe = data[1],
            france = data[2];

        //place graticule
        setGraticule(map, path);

        //translate topojson
        var europeCountries = topojson.feature(europe, europe.objects.EuropeCountries),
            franceRegions = topojson.feature(france, france.objects.FranceRegions).features;

        //add Europe countries
        map.append("path")
            .datum(europeCountries)
            .attr("class", "countries")
            .attr("d", path);

        //join data
        franceRegions = joinData(franceRegions, csvData);

        //add regions
        setEnumerationUnits(franceRegions, map, path);
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

//JOIN DATA FUNCTION
function joinData(franceRegions, csvData){

    for (var i = 0; i < csvData.length; i++){
        var csvRegion = csvData[i];
        var csvKey = csvRegion.adm1_code;

        for (var a = 0; a < franceRegions.length; a++){
            var geojsonProps = franceRegions[a].properties;
            var geojsonKey = geojsonProps.adm1_code;

            if (geojsonKey == csvKey){

                attrArray.forEach(function(attr){
                    var val = parseFloat(csvRegion[attr]);
                    geojsonProps[attr] = val;
                });
            };
        };
    };

    return franceRegions;
};

//SET ENUMERATION UNITS FUNCTION
function setEnumerationUnits(franceRegions, map, path){

    map.selectAll(".regions")
        .data(franceRegions)
        .enter()
        .append("path")
        .attr("class", function(d){
            return "regions " + d.properties.adm1_code;
        })
        .attr("d", path);
};

})();