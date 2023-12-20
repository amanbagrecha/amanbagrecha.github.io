---
title: Geocoding using Mapbox API with Zoom-in map functionality
date: 05-04-2021
slug: geocode-using-mapbox-api-with-zoom-functionality
categories: [OpenLayers, Mapbox]
tags: []
subtitle: ''
description: 'How to bulid geocoding web-app using openlayers'
---

## Overview
The big picture of this post can be related to google maps, wherein you type the address and it zooms in to the location of interest. We replicate this exact functionality with mapbox API for geocoding and openlayers for client side zoom to the address of interest.

## Main steps
This blog demonstrates how to geocode an address using mapbox api implemented in openlayers v6. Additionally zoom in to the search location as text provided on the search bar.
This one page appication demostrates only key elements, rest of the customisation is at discretion of the viewer.

### Setup the project
We first create basic single html file to include all elements (javascript, css and html). Ideally, when the application scales, you would create a seperate file for each component.
1. Create `html` file and add basic elements
```html
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
 <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/openlayers/openlayers.github.io@master/en/v6.5.0/css/ol.css" type="text/css">
 <style type="text/css">
.autocomplete {
  position: relative;
  display: inline-block;
}
input {
  border: 1px solid transparent;
  background-color: #f1f1f1;
  padding: 10px;
  font-size: 16px;
}
input[type=text] {
  background-color: #f1f1f1;
  width: 100%;
}
input[type=submit] {
  background-color: DodgerBlue;
  color: #fff;
  cursor: pointer;
}
 </style>
 </head>
 <body>
<!--create search bar for geocoding and style it -->
<h2>Autocomplete</h2>
<br>
<form  method="post" >
  <div class="autocomplete" style="width:300px;">
	<input id="myInput" type="text" name="myCountry" placeholder="Country">
  </div>
  <input type="submit" id = "geocodingSubmit">
</form>
<div id='project_map', class="map"></div>
</body>
<script src="https://cdn.jsdelivr.net/gh/openlayers/openlayers.github.io@master/en/v6.5.0/build/ol.js"></script>
<!-- <script src="https://cdnjs.cloudflare.com/ajax/libs/proj4js/2.5.0/proj4.js"></script> -->
<script type="text/javascript">
	 
	 // create basemap layer
	 var project_maplayer = new ol.layer.Tile({
	// source: new ol.source.OSM(),
	source: new ol.source.XYZ({
		attributions: ['Powered by Esri',
									 'Source: Esri, DigitalGlobe, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN, and the GIS User Community'],
		attributionsCollapsible: false,
		url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
		maxZoom: 23
	}),
	zIndex: 0
});

// create view for the layer
var project_view = new ol.View({
	projection: 'EPSG:4326',
	center: [-81.80808208706726, 27.285095000261222],
	zoom: 7,
});

// add the basemap to the map
var Projectmap = new ol.Map({
	layers: [project_maplayer,],
	target: 'project_map',
	view: project_view,
    constrainOnlyCenter: true,
});
</script>
```
We added the following elements,
1. Search bar: we setup the search function to input values as address and wrap it within a form with post request.
2. Map : the div element with `id="project_map"` holds the map element and the script does the following. First, create layer with ESRI basemap. Second, add the layer to the Map object.

At this stage the application looks like the following image

![](https://i.imgur.com/joNvjw7.jpg)

## Add autocomplete functionality
We fetch from the api and populate our top results in a list format on key press. Also, we style the search bar using css.
```html
<style>
.autocomplete-items {
  position: absolute;
  border: 1px solid #d4d4d4;
  border-bottom: none;
  border-top: none;
  z-index: 99;
  /*position the autocomplete items to be the same width as the container:*/
  top: 100%;
  left: 0;
  right: 0;
}

.autocomplete-items div {
  padding: 10px;
  cursor: pointer;
  background-color: #fff; 
  border-bottom: 1px solid #d4d4d4; 
}

/*when hovering an item:*/
.autocomplete-items div:hover {
  background-color: #e9e9e9; 
}

/*when navigating through the items using the arrow keys:*/
.autocomplete-active {
  background-color: DodgerBlue !important; 
  color: #ffffff; 
}
</style>

<script>
myHeaders =  {'Content-Type': 'application/json', 'Access-Control-Allow-Credentials' : true,
					'Access-Control-Allow-Origin':'*',
					'Accept': 'application/json'}

function autocomplete(inp) {
  /*the autocomplete function takes one argument,
  the text field element*/
  var currentFocus;
  /*execute a function when someone writes in the text field:*/
  inp.addEventListener("input", function(e) {
	  var a, b, i, val = this.value;
	  var ACCESS_TOKEN_KEY = 'your_token_here'
	  /*close any already open lists of autocompleted values*/
	  var URL = `https://api.mapbox.com/geocoding/v5/mapbox.places/${val}.json?access_token=${ACCESS_TOKEN_KEY}&types=address,region,poi,country,district,locality,neighborhood,postcode&country=us`
	 
	  fetch(URL,{
		method: 'GET',
		headers: myHeaders,
	  }).then(response => response.json())
	  .then(data => {
		geocode_data = data;
		// console.log(data) 
	  
	  closeAllLists();
	  if (!val) { return false;}
	  currentFocus = -1;
	  /*create a DIV element that will contain the items (values):*/
	  a = document.createElement("DIV");
	  a.setAttribute("id", this.id + "autocomplete-list");
	  a.setAttribute("class", "autocomplete-items");
	  /*append the DIV element as a child of the autocomplete container:*/
	  this.parentNode.appendChild(a);
	  /*for each item in the array...*/
	  for (i = 0; i < geocode_data.features.length; i++) {

		  b = document.createElement("DIV");
		  /*insert a input field that will hold the current array item's value:*/
		  b.innerHTML += geocode_data.features[i].place_name;
		  b.innerHTML += `<input type='hidden' style="display: none;" id=${i}-center-cc  
		  coordinates='${geocode_data.features[i].center}' value='${geocode_data.features[i].place_name}'>`;
		  
		  /*execute a function when someone clicks on the item value (DIV element):*/
		  b.addEventListener("click", function(e) {
			  /*insert the value for the autocomplete text field:*/
			  var input_tag = this.getElementsByTagName("input")[0]
			  inp.value = input_tag.value;
			  inp.setAttribute("coordinates", input_tag.getAttribute('coordinates'));

			  /*close the list of autocompleted values,
			  (or any other open lists of autocompleted values:*/
			  closeAllLists();
		  });
		  a.appendChild(b);
		}

	  })
	  .catch(error => {
	console.error('There has been a problem with your fetch operation:', error);
	});


	  });
  // });
  /*execute a function presses a key on the keyboard:*/
  inp.addEventListener("keydown", function(e) {
	  var x = document.getElementById(this.id + "autocomplete-list");
	  if (x) x = x.getElementsByTagName("div");
	  if (e.keyCode == 40) {
		/*If the arrow DOWN key is pressed,
		increase the currentFocus variable:*/
		currentFocus++;
		/*and and make the current item more visible:*/
		addActive(x);
	  } else if (e.keyCode == 38) { //up
		/*If the arrow UP key is pressed,
		decrease the currentFocus variable:*/
		currentFocus--;
		/*and and make the current item more visible:*/
		addActive(x);
	  } else if (e.keyCode == 13) {
		/*If the ENTER key is pressed, prevent the form from being submitted,*/
		e.preventDefault();
		if (currentFocus > -1) {
		  /*and simulate a click on the "active" item:*/
		  if (x) x[currentFocus].click();
		}
	  }
  });
  function addActive(x) {
	/*a function to classify an item as "active":*/
	if (!x) return false;
	/*start by removing the "active" class on all items:*/
	removeActive(x);
	if (currentFocus >= x.length) currentFocus = 0;
	if (currentFocus < 0) currentFocus = (x.length - 1);
	/*add class "autocomplete-active":*/
	x[currentFocus].classList.add("autocomplete-active");
  }
  function removeActive(x) {
	/*a function to remove the "active" class from all autocomplete items:*/
	for (var i = 0; i < x.length; i++) {
	  x[i].classList.remove("autocomplete-active");
	}
  }
  function closeAllLists(elmnt) {
	/*close all autocomplete lists in the document,
	except the one passed as an argument:*/
	var x = document.getElementsByClassName("autocomplete-items");
	for (var i = 0; i < x.length; i++) {
	  if (elmnt != x[i] && elmnt != inp) {
		x[i].parentNode.removeChild(x[i]);
	  }
	}
  }
  /*execute a function when someone clicks in the document:*/
  document.addEventListener("click", function (e) {
	  closeAllLists(e.target);
  });
}

/*initiate the autocomplete function on the "myInput" element */
autocomplete(document.getElementById("myInput"));

</script>
```

The following is the explanation of the code

1. autocomplete function: The function takes an element as input which needs to be populated. Then we add an event listner which on change in input field, triggers. A GET request is sent across for the input typed and the result is populated in a form of dropdown. We add some styling on key-down so as to select the search.


At this point, with correct mapbox api access key, we have built the autocomplete functionality.

![](https://i.imgur.com/ES8bnSO.gif)


## Last steps

We now only need to implement the submit functionality. On click of submit button, the address is located on the map and zoomed in. This is done using a function we call centerMap
```javascript
function CenterMap() {
	var [long, lat] = document.getElementById("myInput").getAttribute("coordinates").split(",").map(Number)
    console.log("Long: " + long + " Lat: " + lat);
    Projectmap.getView().setCenter(ol.proj.transform([long, lat], 'EPSG:4326', 'EPSG:4326'));
    Projectmap.getView().setZoom(5);
}
```
Now we add the centerMap function on click of submit
```javascript
document.getElementById("geocodingSubmit").addEventListener('click', function(e){

	e.preventDefault();
	CenterMap()
})
```

The associated running application can be found [here](https://amanbagrecha.github.io/mapbox-search-functionality/)
