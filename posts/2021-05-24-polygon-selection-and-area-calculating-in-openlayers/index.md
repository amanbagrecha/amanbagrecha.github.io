---
title: Polygon Selection and  Area Calculation in Openlayers
date: 2021-05-24
slug: polygon-selection-and-area-calculation-in-openlayers
categories: [OpenLayers]
tags: []
subtitle: ''
description: 'Select multiple polygons (parcels) and calculate area on the fly in openlayers'
---

## **Overview**
In this small demo-blog we look into how to make polygon selections on the map and calculate the area of that polygon on-the-fly. We use openlayers v6 for client side and geoserver to save our vector layers for this exercise.  
I assume readers to have familiarity with setting up geoserver and basics of openlayers.

## **Step 1: Setup openlayers** 
Openlayers requires you to add these cdns to add their functionality into our application.
### link necessary cdns
```html

 <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/openlayers/openlayers.github.io@master/en/v6.5.0/css/ol.css" type="text/css">
 <script src="https://cdn.jsdelivr.net/gh/openlayers/openlayers.github.io@master/en/v6.5.0/build/ol.js"></script>
 
```


We are using openlayers to render the request response. since the output of the WFS request is json, we create a new layer with vector source and format as geojson. 
The `strategy:ol.loadingstrategy.bbox` tells openlayers to only load features within the bbox. Simply put, if we move to different location, only features within that bbox will appear.

```javascript

// setup geoserver port
var geoserver_ip = 'http://120.0.0.1'
var geoserver_port = '8080'

// define vector source
var myFlSource = new ol.source.Vector({
	format: new ol.format.GeoJSON(),
		url: function (extent){
			return ( geoserver_ip +':' + geoserver_port + '/geoserver/dronnav/ows?service=WFS&version=1.1.0&request=GetFeature&typeName=dronnav%3Aflorida_bp&maxFeatures=10000&outputFormat=application/json&srsname=EPSG:4326&' + 'bbox=' + extent.join(',') + ',EPSG:4326' );
		},
		strategy:ol.loadingstrategy.bbox,
	});
```


We perform WFS request from geoserver to get our layer `florida_bp` in this case. The parameters are as explained as follows

- `service=WFS` : web feature service to perform interaction

- `typename=workspace:florida_bp` : specify the workspace and layer name

- `version=1.1.0` : version number

- `maxFeatures = 10000` : since WFS request is computationaly expensive, we restrict to only load 10000 features.

- `request=GetFeature` : request type. There are several other which can be found here

-  `outputFormat=application/json` : the output format as response

- `srsname=EPSG:4326` : coordinate reference system to display on the map

- `bbox=` : bounding box


```javascript
// define vector layer
var floridaLayer = new ol.layer.Vector({
	source: myFlSource,
	style: new ol.style.Style({
		fill: new ol.style.Fill({
			color: 'rgba(1, 1, 255, .2)',
			}),
		stroke: new ol.style.Stroke({
			color: 'rgba(1, 1, 255, .5)',
			width: 2,
		}),
		}),
		minZoom: 16, // this will allows us to send request only when the zoom is atleast 16
});
```

Once the layer is defined, we need to add this layer to the map. We can either use `map.addLayer(layername)` or add to array in the map (`Fig.1`)
```javascript
// add ESRI basemap
var project_maplayer =    new ol.layer.Tile({
	source: new ol.source.XYZ({
		attributions: ['Powered by Esri',
										'Source: Esri, DigitalGlobe, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN, and the GIS User Community'],
		attributionsCollapsible: false,
		url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
		maxZoom: 23
	}),
	zIndex: 0
});

// add view with projection set to EPSG 4326 for the map
var project_view = new ol.View({
	projection: 'EPSG:4326',
	center: [-81.80808208706726, 27.285095000261222],
	zoom: 7,
});

// define the map with all the layers created previously
var Projectmap = new ol.Map({
	layers: [project_maplayer, floridaLayer],
	overlays: [overlay],
	target: 'project_map', // the div element `id` in html page
	view: project_view,
});
```

<figure>

![](https://i.imgur.com/jodNbPQ.jpg)

<figcaption align = "center"><b><i>Fig.1 -The Map layer with building footprints (<code>floridaLayer</code>) added to the map with the style we specified</code> for each feature</i></b></figcaption>

</figure>



## **Get feature info on click**

After adding basemap and our layer to the map served via geoserver, we are now ready to get information `on-click`. We use  `forEachFeatureAtPixel` method on our layer to send a WFS request to our geoserver and recive a response in json format. We change the style of the building on click (`Fig.2`). The area is calculated using formatArea function which utilises `ol.sphere.getArea` and `transform` method to calculate area and change CRS.

```javascript

  /*  select ploygon the feature and get area and store the features */
  var selected = []; // contains all features
  var selected_area = []; // contains area of feature, one-to-one
  
  Projectmap.on('singleclick', function (e) {
  Projectmap.forEachFeatureAtPixel(e.pixel, function (f, l) {
  	var mycoordinate = e.coordinate
  	storef = f  // feature
  	/* if click is on polygon, then select the feature */
  if ( f.getGeometry()   instanceof  ol.geom.MultiPolygon ) {
		  
		var selIndex = selected.indexOf(f);
			// console.log(selIndex)
		if (selIndex < 0) {
			selected.push(f);
			selected_area.push( formatArea(f) ); // formatArea function returns the area in ft2
			f.setStyle(highlightStyle); // change style on click
		} else {
			selected.splice(selIndex, 1);
			selected_area.splice( selIndex, 1);
			f.setStyle(undefined);
		}
 	 }

	  })

	  /* update the tags with no of selected feature and total area combined */
	  document.getElementById('status-selected').innerHTML = '&nbsp;' + selected.length + ' selected features';
	  document.getElementById('status-selected_area').innerHTML = '&nbsp;' + selected_area.reduce(getSum, 0) + ' ft<sup>2</sup>';
	  
	});
	

	
  /* style for selected feature on click  */
  var highlightStyle = new ol.style.Style({
  	fill: new ol.style.Fill({
  	color: '#f0b88b',
  	}),
  	stroke: new ol.style.Stroke({
  	color: '#f0b88b',
  	width: 3,
  	}),
  });


  /*  function for calculating area of the polygon (feature) selected */
  function formatArea (polygon){
   var area = ol.sphere.getArea(polygon.getGeometry().transform('EPSG:4326', 'EPSG:3857')); // transform to projected coordinate system.
   var output;
   output = Math.round(area * 100*10.7639) / 100  ; //in ft2
   polygon.getGeometry().transform('EPSG:3857', 'EPSG:4326' ) //convert back to geographic crc
   return output;
  }
  
  /*  function for array sum */
  function getSum(total, num) {
  return total + Math.round(num);
  }

```

<figure>

![](https://i.imgur.com/TCicCHu.jpg)

<figcaption align = "center"><b><i>Fig.2 -The <code>floridaLayer</code> building footprints selected  with the style we specified</code> for each feature</i></b></figcaption>

</figure>


## **Final comments**
This post demonstrates the use of `strategy:ol.loadingstrategy.bbox` to load only the features that cover the bounding box. We use this strategy since WFS service is resouce intensive and our server cannot handle millions of HTTP request at once.

We also see the use of `forEachFeatureAtPixel` method to select our building footprints. On click of the feature we change the style using `setStyle` method.

Additionally, we saw how to change projection on-the-fly using `ol.sphere.getArea` method. A word of caution while using `EPSG:3857`. My AOI was on the equator and thus calculating area does not result in significant error. But if the AOI is in temperate zone then adopt suitable projection CRS.


Layer Credit: Microsoft buidling footprints https://github.com/microsoft/USBuildingFootprints
