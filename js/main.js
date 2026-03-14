var numbersArray = [1, 2, 3];

var stringsArray = ["one", "two", "three"];

var colorsArray = ["#F00", "#0F0", "#00F"];

var objectsArray = [
    { 
        city: 'Madison',
        population: 233209
    },
    {
        city: 'Milwaukee',
        population: 594833
    },
    {
        city: 'Green Bay',
        population: 104057
    }
];

var cityPop = [
    { 
        city: 'Madison',
        population: 233209
    },
    {
        city: 'Milwaukee',
        population: 594833
    },
    {
        city: 'Green Bay',
        population: 104057
    },
    {
        city: 'Superior',
        population: 27244
    }
];

var arraysArray = [
    ['Madison', 23209],
    ['Milwaukee', 593833],
    ['Green Bay', 104057]
];

//execute script when window is loaded
window.onload = function(){
    //SVG dimension variables
    var w = 900, h = 500;

    //Example 1.5 line 1...container block
    var container = d3.select("body") //get the <body> element from the DOM
        .append("svg") //put a new svg in the body
        .attr("width", w) //assign the width
        .attr("height", h) //assign the height
        .attr("class", "container") //assign a class name
        .style("background-color", "rgba(0,0,0,0.2)"); //svg background color

    //Example 1.8 line 1...innerRect block
    var innerRect = container.append("rect")
        .datum(400) //a single value is a DATUM
        .attr("width", function(d){ //rectangle width
            return d * 2; //400 * 2 = 800
        })
        .attr("height", function(d){ //rectangle height
            return d; //400
        })
        .attr("class", "innerRect") //class name
        .attr("x", 50) //position from left on the x (horizontal) axis
        .attr("y", 50) //position from top on the y (vertical) axis
        .style("fill", "#FFFFFF"); //fill color

    //Example 2.5 line 1
    var dataArray = [10, 20, 30, 40, 50];

    /*
    var circles = container.selectAll(".circles") //but wait--there are no circles yet!
        .data(dataArray) //here we feed in an array
        .enter() //one of the great mysteries of the universe
        .append("circle") //add a circle for each datum
        .attr("class", "circles") //apply a class name to all circles
        .attr("r", function(d, i){ //circle radius
            console.log("d:", d, "i:", i); //let's take a look at d and i
            return d;
        })
        .attr("cx", function(d, i){ //x coordinate
            return 70 + (i * 180);
        })
        .attr("cy", function(d){ //y coordinate
            return 450 - (d * 5);
        });
    */

        //Example 2.6 line 3
    var circles = container.selectAll(".circles") //create an empty selection
        .data(cityPop) //here we feed in an array
        .enter() //one of the great mysteries of the universe
        .append("circle") //inspect the HTML--holy crap, there's some circles there
        .attr("class", "circles")
        .attr("id", function(d){
            return d.city;
        })
        .attr("r", function(d){
            //calculate the radius based on population value as circle area
            var area = d.population * 0.01;
            return Math.sqrt(area/Math.PI);
        })
        .attr("cx", function(d, i){
            //use the index to place each circle horizontally
            return 90 + (i * 180);
        })
        .attr("cy", function(d){
            //subtract value from 450 to "grow" circles up from the bottom instead of down from the top of the SVG
            return 450 - (d.population * 0.0005);
        });
};