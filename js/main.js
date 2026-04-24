(function(){

var chartTitles = {
    "entropy_norm": 'Standard Occupational Classification Variability',
    "13": "Computer & Mathematical",
    "15": "Information Technology",
    "17": "Engineering & Architecture",
    "19": "Science & Research",
    "25": "Education",
    "11": "Management",
    "21": "Social Services",
    "29": "Healthcare",
    "27": "Arts & Media",
    "41": "Sales",
    "43": "Office/Admin",
    "23": "Legal",
    "31": "Healthcare Support",
    "35": "Service (Food)",
    "39": "Service (Personal)",
    "49": "Maintenance",
    "53": "Transport",
    "12": "Business & Financial Operations",
    "47": "Construction"
};

var labelUnits = {
    "entropy_norm": 'variance',
    "13": "proportion",
    "15": "proportion",
    "17": "proportion",
    "19": "proportion",
    "25": "proportion",
    "11": "proportion",
    "21": "proportion",
    "29": "proportion",
    "27": "proportion",
    "41": "proportion",
    "43": "proportion",
    "23": "proportion",
    "31": "proportion",
    "35": "proportion",
    "39": "proportion",
    "49": "proportion",
    "53": "proportion",
    "12": "proportion",
    "47": "proportion"
};

var SOCLookup = {
    "11": "Management",
    "12": "Business & Financial Operations",
    "13": "Computer & Mathematical",
    "15": "Information Technology",
    "17": "Engineering & Architecture",
    "19": "Science & Research",
    "21": "Social Services",
    "23": "Legal",
    "25": "Education",
    "27": "Arts & Media",
    "29": "Healthcare",
    "31": "Healthcare Support",
    "35": "Service (Food)",
    "39": "Service (Personal)",
    "41": "Sales",
    "43": "Office/Admin",
    "47": "Construction",
    "49": "Maintenance",
    "53": "Transport"
};

// SOC codes in the order they appear in SOCp.csv
var SOCcodes = ["13","15","17","19","25","11","21","29","27","41","43","23","31","35","39","49","53","12","47"];

//chart frame dimensions
var chartWidth = window.innerWidth * 0.4,
    chartHeight = window.innerHeight * 0.6,
    leftPadding = 40,
    rightPadding = 2,
    topBottomPadding = 5,
    chartInnerWidth = chartWidth - leftPadding - rightPadding,
    chartInnerHeight = chartHeight - topBottomPadding * 2,
    translate = "translate(" + leftPadding + "," + topBottomPadding + ")";

//  Shared state 
var currentSection = "entropy_norm";   // active section key
var currentSOC     = SOCcodes[0];      // active SOC code for proportions view

// Long-format section state: SOC code + column selected per section
var longState = {
    full:  { soc: SOCcodes[0], col: "avg_wage" },
    trunc: { soc: SOCcodes[0], col: "avg_wage" }
};

// Human-readable labels for long-format columns
var longColLabels = {
    "total_positions":  "Total Positions",
    "avg_wage":         "Average Wage ($)",
    "avg_pw":           "Average Prevailing Wage ($)",
    "wage_gap":         "Wage Gap ($)",
    "avg_pw_level":     "Avg Prevailing Wage Level",
    "sec_entity_rate":  "Secondary Entity Rate",
    "h1b_dep_rate":     "H-1B Dependent Rate",
    "out_of_state_rate":"Out-of-State Rate",
    "new_emp_prop":     "New Employment Proportion",
    "cont_emp_prop":    "Continued Employment Proportion",
    "change_prev_prop": "Change Previous Proportion",
    "concurrent_prop":  "Concurrent Proportion",
    "change_emp_prop":  "Change Employment Proportion",
    "amend_pet_prop":   "Amended Petition Proportion"
};

var longCols = Object.keys(longColLabels);

// Data references filled after load
var gEntropyData, gPropData, gFullData, gTruncData;
var gStatesFeatures, gMap, gPath;
var gEntropyColorScale, gPropColorScales = {};

//begin script when window loads
window.onload = setMap;

//  MAP SETUP 
function setMap(){
    var container = d3.select("#map-container").node();
    var width  = container.clientWidth  * 0.9;
    var height = container.clientHeight * 0.925;

    var map = d3.select("#map-container")
        .append("svg")
        .attr("class", "map")
        .attr("width",  width)
        .attr("height", height);

    var projection = d3.geoAlbers()
        .scale(750)
        .translate([width / 2, height / 2]);

    var path = d3.geoPath().projection(projection);

    //load data
    var promises = [];
    promises.push(d3.json("data/project/cb_2018_us_state_500k.json"));
    promises.push(d3.csv("data/project/HSOC.csv"));
    promises.push(d3.csv("data/project/Q12025.csv"));
    promises.push(d3.csv("data/project/Q12025H1BDep.csv"));
    promises.push(d3.csv("data/project/SOCp.csv"));
    Promise.all(promises).then(callback);

    function callback(data){
        var america  = data[0];
        var entropy  = data[1];
        var full     = data[2];
        var trunc    = data[3];
        var fullProp = data[4];

        // stash globally
        gEntropyData    = entropy;
        gPropData       = fullProp;
        gFullData       = full;
        gTruncData      = trunc;
        gMap            = map;
        gPath           = path;

        //place graticule
        setGraticule(map, path);

        //translate topojson
        var states = topojson.feature(america, america.objects.cb_2018_us_state_500k);
        gStatesFeatures = states.features;

        //draw base state outlines
        map.append("path")
            .datum(states)
            .attr("class", "states")
            .attr("d", path);

        // join entropy data & build its color scale
        joinData(gStatesFeatures, entropy, ['WORKSITE_STATE', 'entropy_norm']);
        gEntropyColorScale = makeColorScale(entropy, 'entropy_norm');

        // pre-build color scales for every SOC code and join proportion data
        var allSOCattrs = ['WORKSITE_STATE'].concat(SOCcodes);
        joinData(gStatesFeatures, fullProp, allSOCattrs);
        SOCcodes.forEach(function(code){
            gPropColorScales[code] = makeColorScale(fullProp, code);
        });

        // initial render: entropy map + entropy chart
        setEnumerationUnits(gStatesFeatures, map, path, gEntropyColorScale, 'entropy_norm');
        setChart(entropy, gEntropyColorScale, 'entropy_norm');

        // build proportion chart + its dropdown (hidden until that section is active)
        buildProportionSection(fullProp);

        // build full and H-1B dependent sections
        buildLongSection("full",  full);
        buildLongSection("trunc", trunc);

        // Start observing sections only now that all data and globals are ready
        setupSectionObserver();
    };
};

//  PROPORTION SECTION SETUP 
function buildProportionSection(propData){

    // Insert dropdown into the proportions section prose area
    var dropdownContainer = d3.select(".chart-block[data-attr='proportions']")
        .insert("div", ":first-child")
        .attr("id", "soc-dropdown-wrap")
        .style("margin-bottom", "12px");

    dropdownContainer.append("label")
        .attr("for", "soc-select")
        .style("font-family", "sans-serif")
        .style("font-size", "0.9em")
        .style("font-weight", "bold")
        .style("margin-right", "8px")
        .text("SOC Category:");

    var select = dropdownContainer.append("select")
        .attr("id", "soc-select")
        .attr("class", "dropdown")
        .style("position", "relative")
        .style("top", "auto")
        .style("left", "auto")
        .style("display", "inline-block");

    SOCcodes.forEach(function(code){
        select.append("option")
            .attr("value", code)
            .text(code + " – " + (SOCLookup[code] || code));
    });

    select.on("change", function(){
        currentSOC = this.value;
        // update both chart and map
        updateProportionChart(currentSOC);
        updateMap("proportions");
    });

    // Draw the initial proportion chart
    setProportionChart(propData, gPropColorScales[currentSOC], currentSOC);
}

//  MAP UPDATE (called by section observer + dropdown) 
function updateMap(measure){
    if (!gMap || !gStatesFeatures) return;
    currentSection = measure;

    var getFill;

    if (measure === "proportions"){
        getFill = function(d){
            var value = d.properties[currentSOC];
            return (value !== undefined && !isNaN(value))
                ? gPropColorScales[currentSOC](value) : "#ccc";
        };
        rewireRegionEvents(measure);
    } else if (measure === "entropy_norm"){
        getFill = function(d){
            var value = d.properties["entropy_norm"];
            return (value !== undefined && !isNaN(value))
                ? gEntropyColorScale(value) : "#ccc";
        };
        rewireRegionEvents(measure);
    } else if (measure === "full" || measure === "trunc"){
        updateLongMap(measure);
        return; // updateLongMap handles its own transition
    }

    if (getFill){
        gMap.selectAll(".regions")
            .transition().duration(600).ease(d3.easeCubicInOut)
            .style("fill", getFill);
    }
}

// Re-bind mouseover/mouseout after a section switch so tooltips stay correct
function rewireRegionEvents(measure){
    gMap.selectAll(".regions")
        .on("mouseover", function(event, d){ highlight(d.properties, measure); })
        .on("mouseout",  function(event, d){ dehighlight(d.properties); });
}

//  PROPORTION CHART UPDATE (redraw bars for new SOC code) 
function updateProportionChart(socCode){
    var chartBlock = d3.select(".chart-block[data-attr='proportions']");

    // Remove existing SVG chart but keep the dropdown wrapper
    chartBlock.select("svg.chart").remove();

    setProportionChart(gPropData, gPropColorScales[socCode], socCode);
}

//  GRATICULE 
function setGraticule(map, path){
    var graticule = d3.geoGraticule().step([5, 5]);

    map.append("path")
        .datum(graticule.outline())
        .attr("class", "gratBackground")
        .attr("d", path);

    map.selectAll(".gratLines")
        .data(graticule.lines())
        .enter()
        .append("path")
        .attr("class", "gratLines")
        .attr("d", path);
};

//  DATA JOIN 
function joinData(regions, data, attrArray){
    for (var i = 0; i < data.length; i++){
        var dataState = data[i];
        var dataKey   = dataState.WORKSITE_STATE;

        for (var a = 0; a < regions.length; a++){
            var geoProps = regions[a].properties;
            var geoKey   = geoProps.STUSPS;

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

//  COLOR SCALE 
function makeColorScale(data, measure){
    var colorClasses = [
        "#D4B9DA",
        "#C994C7",
        "#DF65B0",
        "#DD1C77",
        "#980043"
    ];

    var colorScale = d3.scaleQuantile().range(colorClasses);

    var minmax = [
        d3.min(data, function(d){ return parseFloat(d[measure]); }),
        d3.max(data, function(d){ return parseFloat(d[measure]); })
    ];

    colorScale.domain(minmax);
    return colorScale;
};

//  ENUMERATION UNITS 
function setEnumerationUnits(regions, map, path, colorScale, measure){
    var regionPaths = map.selectAll(".regions")
        .data(regions)
        .enter()
        .append("path")
        .attr("class", "regions")
        .attr("data-state", function(d){ return d.properties.STUSPS; })
        .attr("d", path)
        .style("fill", function(d){
            var value = d.properties[measure];
            return (value !== undefined && !isNaN(value)) ? colorScale(value) : "#ccc";
        })
        .on("mouseover", function(event, d){
            highlight(d.properties, measure);
        })
        .on("mouseout", function(event, d){
            dehighlight(d.properties);
        })
        .on("mousemove", moveLabel);

    regionPaths.append("desc")
        .text('{"stroke": "#000", "stroke-width": "0.5px"}');
};

//  ENTROPY BAR CHART (original, untouched) 
function setChart(csvData, colorScale, measure){
    var chart = d3.select(".chart-block[data-attr='" + measure + "']")
        .append("svg")
        .attr("width",  chartWidth)
        .attr("height", chartHeight)
        .attr("class",  "chart");

    chart.append("rect")
        .attr("class",  "chartBackground")
        .attr("width",  chartInnerWidth)
        .attr("height", chartInnerHeight)
        .attr("transform", translate);

    var yScale = d3.scaleLinear()
        .range([chartInnerHeight, 0])
        .domain([0, d3.max(csvData, d => parseFloat(d[measure])) * 1.1]);

    var bars = chart.selectAll(".bar")
        .data(csvData)
        .enter()
        .append("rect")
        .sort(function(a, b){ return b[measure] - a[measure]; })
        .attr("class", "bar")
        .attr("data-state", function(d){ return d.WORKSITE_STATE; })
        .attr("width",  chartInnerWidth / csvData.length - 1)
        .attr("x",      function(d, i){ return i * (chartInnerWidth / csvData.length) + leftPadding; })
        .attr("height", function(d){ return chartInnerHeight - yScale(parseFloat(d[measure])); })
        .attr("y",      function(d){ return yScale(parseFloat(d[measure])) + topBottomPadding; })
        .style("fill",  function(d){ return colorScale(d[measure]); })
        .on("mouseover", function(event, d){ highlight(d, measure); })
        .on("mouseout",  function(event, d){ dehighlight(d); })
        .on("mousemove", moveLabel);

    bars.append("desc").text('{"stroke": "none", "stroke-width": "0px"}');

    var barWidth = chartInnerWidth / csvData.length;

    chart.selectAll(".numbers")
        .data(csvData)
        .enter()
        .append("text")
        .sort(function(a, b){ return b[measure] - a[measure]; })
        .attr("class", function(d){ return "numbers " + d.WORKSITE_STATE; })
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("transform", function(d, i){
            var x = leftPadding + i * barWidth + barWidth / 2;
            var y = topBottomPadding + yScale(parseFloat(d[measure])) + 10;
            return "translate(" + x + "," + y + ") rotate(-90)";
        })
        .style("font-size", function(){ return Math.max(6, barWidth * 0.6) + "px"; })
        .text(function(d){
            var val = parseFloat(d[measure]);
            return isNaN(val) ? "" : val.toFixed(2);
        });

    chart.append("text")
        .attr("x", 40).attr("y", 30)
        .attr("class", "chartTitle")
        .text(chartTitles[measure] + " by State");

    chart.append("g")
        .attr("class", "axis")
        .attr("transform", translate)
        .call(d3.axisLeft().scale(yScale));

    chart.append("rect")
        .attr("class",  "chartFrame")
        .attr("width",  chartInnerWidth)
        .attr("height", chartInnerHeight)
        .attr("transform", translate);
};

//  PROPORTION BAR CHART 
function setProportionChart(csvData, colorScale, measure){

    var chart = d3.select(".chart-block[data-attr='proportions']")
        .append("svg")
        .attr("width",  chartWidth)
        .attr("height", chartHeight)
        .attr("class",  "chart");

    chart.append("rect")
        .attr("class",  "chartBackground")
        .attr("width",  chartInnerWidth)
        .attr("height", chartInnerHeight)
        .attr("transform", translate);

    var yScale = d3.scaleLinear()
        .range([chartInnerHeight, 0])
        .domain([0, d3.max(csvData, d => parseFloat(d[measure])) * 1.1]);

    var sorted = csvData.slice().sort(function(a, b){
        return parseFloat(b[measure]) - parseFloat(a[measure]);
    });

    var bars = chart.selectAll(".bar")
        .data(sorted)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("data-state", function(d){ return d.WORKSITE_STATE; })
        .attr("width",  chartInnerWidth / sorted.length - 1)
        .attr("x",      function(d, i){ return i * (chartInnerWidth / sorted.length) + leftPadding; })
        .attr("height", function(d){ return chartInnerHeight - yScale(parseFloat(d[measure])); })
        .attr("y",      function(d){ return yScale(parseFloat(d[measure])) + topBottomPadding; })
        .style("fill",  function(d){
            var val = parseFloat(d[measure]);
            return (isNaN(val) || val === 0) ? "#ccc" : colorScale(val);
        })
        .on("mouseover", function(event, d){ highlight(d, measure); })
        .on("mouseout",  function(event, d){ dehighlight(d); })
        .on("mousemove", moveLabel);

    bars.append("desc").text('{"stroke": "none", "stroke-width": "0px"}');

    var barWidth = chartInnerWidth / sorted.length;

    chart.selectAll(".numbers")
        .data(sorted)
        .enter()
        .append("text")
        .attr("class", function(d){ return "numbers " + d.WORKSITE_STATE; })
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("transform", function(d, i){
            var x = leftPadding + i * barWidth + barWidth / 2;
            var y = topBottomPadding + yScale(parseFloat(d[measure])) + 10;
            return "translate(" + x + "," + y + ") rotate(-90)";
        })
        .style("font-size", function(){ return Math.max(6, barWidth * 0.6) + "px"; })
        .text(function(d){
            var val = parseFloat(d[measure]);
            return isNaN(val) ? "" : val.toFixed(3);
        });

    // Chart title shows SOC name
    var titleText = (SOCLookup[measure] || measure) + " (SOC " + measure + ") Proportion by State";
    chart.append("text")
        .attr("x", 40).attr("y", 30)
        .attr("class", "chartTitle")
        .text(titleText);

    chart.append("g")
        .attr("class", "axis")
        .attr("transform", translate)
        .call(d3.axisLeft().scale(yScale).tickFormat(d3.format(".0%")));

    chart.append("rect")
        .attr("class",  "chartFrame")
        .attr("width",  chartInnerWidth)
        .attr("height", chartInnerHeight)
        .attr("transform", translate);
};

//  LONG-FORMAT SECTIONS (full / trunc) 

// Filter long CSV to rows matching a SOC code, keyed by state
function filterLongBySoc(data, socCode){
    var byState = {};
    data.forEach(function(row){
        if (row.SOC2 === socCode){
            byState[row.WORKSITE_STATE] = row;
        }
    });
    return byState;
}

// Build color scale from a state-keyed object for a given column
function makeLongColorScale(byState, col){
    var vals = Object.values(byState)
        .map(function(r){ return parseFloat(r[col]); })
        .filter(function(v){ return !isNaN(v); });

    var colorClasses = ["#D4B9DA","#C994C7","#DF65B0","#DD1C77","#980043"];
    var colorScale = d3.scaleQuantile().range(colorClasses);
    colorScale.domain([d3.min(vals), d3.max(vals)]);
    return colorScale;
}

// Redraw map regions coloured by a long-format slice
function updateLongMap(sectionId){
    var st         = longState[sectionId];
    var data       = sectionId === "full" ? gFullData : gTruncData;
    var byState    = filterLongBySoc(data, st.soc);
    var colorScale = makeLongColorScale(byState, st.col);

    gStatesFeatures.forEach(function(f){
        var row = byState[f.properties.STUSPS];
        f.properties["__long"] = row ? parseFloat(row[st.col]) : NaN;
    });

    // Transition fill on existing paths; create them on first call
    var existing = gMap.selectAll(".regions");

    if (existing.empty()){
        var regionPaths = gMap.selectAll(".regions")
            .data(gStatesFeatures)
            .enter()
            .append("path")
            .attr("class", "regions")
            .attr("data-state", function(d){ return d.properties.STUSPS; })
            .attr("d", gPath)
            .style("fill", "#ccc");

        regionPaths.append("desc")
            .text('{"stroke": "#000", "stroke-width": "0.5px"}');
    }

    gMap.selectAll(".regions")
        .transition().duration(600).ease(d3.easeCubicInOut)
        .style("fill", function(d){
            var v = d.properties["__long"];
            return (!isNaN(v) && v !== null) ? colorScale(v) : "#ccc";
        });

    // Always rewire events so tooltip reflects current sectionId/col
    gMap.selectAll(".regions")
        .on("mouseover", function(event, d){
            var row = byState[d.properties.STUSPS] || {};
            var props = Object.assign({}, row, { STUSPS: d.properties.STUSPS });
            highlightLong(props, st.col, sectionId);
        })
        .on("mouseout", function(event, d){
            var props = { STUSPS: d.properties.STUSPS, WORKSITE_STATE: d.properties.STUSPS };
            dehighlight(props);
        })
        .on("mousemove", moveLabel);
}

function highlightLong(props, col, sectionId){
    var key = props.WORKSITE_STATE || props.STUSPS;
    d3.selectAll("[data-state='" + key + "']")
        .style("stroke", "blue")
        .style("stroke-width", "2");

    var val = parseFloat(props[col]);
    var displayVal = isNaN(val) ? "N/A" : val.toLocaleString(undefined, {maximumFractionDigits: 2});
    var unit = longColLabels[col] || col;
    var labelAttribute = "<h1>" + displayVal + "</h1><b>" + unit + "</b>";

    d3.select(".infolabel").remove();
    var infolabel = d3.select(".container")
        .append("div")
        .attr("class", "infolabel")
        .attr("id", key + "_label")
        .html(labelAttribute);
    infolabel.append("div").attr("class", "labelname").html(key);
}

// Build the dropdown UI and initial chart for a long-format section
function buildLongSection(sectionId, data){
    var block = d3.select(".chart-block[data-attr='" + sectionId + "']");

    var wrap = block.insert("div", ":first-child")
        .attr("id", sectionId + "-dropdown-wrap")
        .style("margin-bottom", "12px")
        .style("display", "flex")
        .style("gap", "20px")
        .style("align-items", "center")
        .style("flex-wrap", "wrap");

    // SOC dropdown
    var socWrap = wrap.append("div");
    socWrap.append("label")
        .attr("for", sectionId + "-soc-select")
        .style("font-family", "sans-serif")
        .style("font-size", "0.9em")
        .style("font-weight", "bold")
        .style("margin-right", "6px")
        .text("SOC Category:");

    var socSelect = socWrap.append("select")
        .attr("id", sectionId + "-soc-select")
        .attr("class", "dropdown")
        .style("position", "relative")
        .style("top", "auto")
        .style("left", "auto")
        .style("display", "inline-block");

    SOCcodes.forEach(function(code){
        socSelect.append("option")
            .attr("value", code)
            .text(code + " – " + (SOCLookup[code] || code));
    });

    // Column dropdown
    var colWrap = wrap.append("div");
    colWrap.append("label")
        .attr("for", sectionId + "-col-select")
        .style("font-family", "sans-serif")
        .style("font-size", "0.9em")
        .style("font-weight", "bold")
        .style("margin-right", "6px")
        .text("Measure:");

    var colSelect = colWrap.append("select")
        .attr("id", sectionId + "-col-select")
        .attr("class", "dropdown")
        .style("position", "relative")
        .style("top", "auto")
        .style("left", "auto")
        .style("display", "inline-block");

    longCols.forEach(function(col){
        colSelect.append("option")
            .attr("value", col)
            .property("selected", col === longState[sectionId].col)
            .text(longColLabels[col]);
    });

    function redraw(){
        block.select("svg.chart").remove();
        var st = longState[sectionId];
        var byState = filterLongBySoc(data, st.soc);
        setLongChart(sectionId, byState, st.col);
        if (currentSection === sectionId){ updateLongMap(sectionId); }
    }

    socSelect.on("change", function(){
        longState[sectionId].soc = this.value;
        redraw();
    });

    colSelect.on("change", function(){
        longState[sectionId].col = this.value;
        redraw();
    });

    // Initial chart
    var st = longState[sectionId];
    var byState = filterLongBySoc(data, st.soc);
    setLongChart(sectionId, byState, st.col);
}

// Draw bar chart for a long-format section given a state-keyed data slice
function setLongChart(sectionId, byState, col){
    var rows = Object.values(byState)
        .filter(function(r){ return !isNaN(parseFloat(r[col])); })
        .sort(function(a, b){ return parseFloat(b[col]) - parseFloat(a[col]); });

    var colorScale = makeLongColorScale(byState, col);

    var chart = d3.select(".chart-block[data-attr='" + sectionId + "']")
        .append("svg")
        .attr("width",  chartWidth)
        .attr("height", chartHeight)
        .attr("class",  "chart");

    chart.append("rect")
        .attr("class",  "chartBackground")
        .attr("width",  chartInnerWidth)
        .attr("height", chartInnerHeight)
        .attr("transform", translate);

    var yScale = d3.scaleLinear()
        .range([chartInnerHeight, 0])
        .domain([0, d3.max(rows, function(r){ return parseFloat(r[col]); }) * 1.1]);

    var barW = chartInnerWidth / rows.length;

    var bars = chart.selectAll(".bar")
        .data(rows)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("data-state", function(d){ return d.WORKSITE_STATE; })
        .attr("width",  barW - 1)
        .attr("x",      function(d, i){ return i * barW + leftPadding; })
        .attr("height", function(d){ return chartInnerHeight - yScale(parseFloat(d[col])); })
        .attr("y",      function(d){ return yScale(parseFloat(d[col])) + topBottomPadding; })
        .style("fill",  function(d){ return colorScale(parseFloat(d[col])); })
        .on("mouseover", function(event, d){ highlightLong(d, col, sectionId); })
        .on("mouseout",  function(event, d){ dehighlight(d); })
        .on("mousemove", moveLabel);

    bars.append("desc").text('{"stroke": "none", "stroke-width": "0px"}');

    chart.selectAll(".numbers")
        .data(rows)
        .enter()
        .append("text")
        .attr("class", function(d){ return "numbers " + d.WORKSITE_STATE; })
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("transform", function(d, i){
            var x = leftPadding + i * barW + barW / 2;
            var y = topBottomPadding + yScale(parseFloat(d[col])) + 10;
            return "translate(" + x + "," + y + ") rotate(-90)";
        })
        .style("font-size", function(){ return Math.max(6, barW * 0.6) + "px"; })
        .text(function(d){
            var v = parseFloat(d[col]);
            return isNaN(v) ? "" : v.toLocaleString(undefined, {maximumFractionDigits: 1});
        });

    var st = longState[sectionId];
    var titleText = (SOCLookup[st.soc] || st.soc) + " – " + (longColLabels[col] || col) + " by State";
    chart.append("text")
        .attr("x", 40).attr("y", 30)
        .attr("class", "chartTitle")
        .text(titleText);

    // Y-axis: use dollar format for wage columns, plain otherwise
    var wagecols = ["avg_wage","avg_pw","wage_gap"];
    var fmt = wagecols.indexOf(col) >= 0 ? d3.format("$,.0f") : d3.format(",.2f");

    chart.append("g")
        .attr("class", "axis")
        .attr("transform", translate)
        .call(d3.axisLeft().scale(yScale).tickFormat(fmt));

    chart.append("rect")
        .attr("class",  "chartFrame")
        .attr("width",  chartInnerWidth)
        .attr("height", chartInnerHeight)
        .attr("transform", translate);
}

//  HIGHLIGHT / DEHIGHLIGHT / LABEL 
function highlight(d, measure){
    var key = d.WORKSITE_STATE || d.STUSPS;
    d3.selectAll("[data-state='" + key + "']")
        .style("stroke", "blue")
        .style("stroke-width", "2");
    setLabel(d, measure);
};

function dehighlight(d){
    var key = d.WORKSITE_STATE || d.STUSPS;
    d3.selectAll("[data-state='" + key + "']")
        .style("stroke", function(){
            var styleText = d3.select(this).select("desc").text();
            try { return JSON.parse(styleText)["stroke"]; } catch(e){ return "#000"; }
        })
        .style("stroke-width", function(){
            var styleText = d3.select(this).select("desc").text();
            try { return JSON.parse(styleText)["stroke-width"]; } catch(e){ return "0.5px"; }
        });
    d3.select(".infolabel").remove();
};

function setLabel(props, measure){
    var val = parseFloat(props[measure]);
    var displayVal = isNaN(val) ? "N/A"
        : (measure === "entropy_norm" ? val.toFixed(2) : (val * 100).toFixed(1) + "%");

    var unit = labelUnits[measure] || measure;
    var labelAttribute = "<h1>" + displayVal + "</h1><b>" + unit + "</b>";

    var infolabel = d3.select(".container")
        .append("div")
        .attr("class", "infolabel")
        .attr("id", (props.WORKSITE_STATE || props.STUSPS) + "_label")
        .html(labelAttribute);

    infolabel.append("div")
        .attr("class", "labelname")
        .html(props.WORKSITE_STATE || props.STUSPS);
};

function moveLabel(){
    var labelWidth = d3.select(".infolabel").node().getBoundingClientRect().width;
    var x1 = event.clientX + 10,  y1 = event.clientY - 75,
        x2 = event.clientX - labelWidth - 10, y2 = event.clientY + 25;
    var x = event.clientX > window.innerWidth  - labelWidth - 20 ? x2 : x1;
    var y = event.clientY < 75 ? y2 : y1;
    d3.select(".infolabel").style("left", x + "px").style("top", y + "px");
};

//  SECTION OBSERVER 
function setupSectionObserver(){
    const panel = document.querySelector("#panel");
    const sections = document.querySelectorAll("#slides .section");

    const observer = new IntersectionObserver(function(entries){
        // Pick the entry most visible within #panel
        var best = null;
        entries.forEach(function(entry){
            if (!best || entry.intersectionRatio > best.intersectionRatio){
                best = entry;
            }
        });

        if (best && best.intersectionRatio >= 0.5) {
            sections.forEach(function(s){ s.classList.remove("active"); });
            best.target.classList.add("active");

            // data-attr is on the .chart-block child, not the .section itself
            var chartBlock = best.target.querySelector(".chart-block[data-attr]");
            var measure = chartBlock ? chartBlock.dataset.attr : null;
            console.log("switching to:", measure, "ratio:", best.intersectionRatio);
            if (measure){ updateMap(measure); }
        }
    }, {
        root: panel,
        threshold: [0, 0.25, 0.5, 0.75, 1.0]
    });

    sections.forEach(function(section){ observer.observe(section); });
};

})();