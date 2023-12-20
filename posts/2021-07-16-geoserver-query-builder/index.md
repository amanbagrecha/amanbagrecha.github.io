---
title: Query Geoserver Layer using openlayers
date: 2021-07-16
slug: geoserver-query-builder
categories: [Geoserver, OpenLayers]
tags: [geoserver, openlayers]
subtitle: ''
description: 'This blog demonstrates how to display and query all geoserver layers or from a workspace using geoserver REST API. CQL (Common Query Language) filter provided by geoserver is used to query the layer.'
---



## Overview
This blog demonstrates how to display and query all geoserver layers or from a workspace using geoserver REST API. CQL (Common Query Language) filter provided by geoserver is used to query the layer.

We create a full stack application, setting up the backend using django and the frontend using vanilla js. The application will later be deployed on aws ec2 instance.



## Setting up the backend (Django)


### Create virtual environment and activate it

```shell
conda create --name djangoEnv
conda activate djangoEnv
```

### Start a new project and create app
```shell
django-admin startproject DOGP
python manage.py startapp gisapp
```

### Setup the database

We set up postgresql for this exercise. Create a new database and add a postgis extension from it. For more info on how to set up the extension, click here.

Once the database is set up on the localhost server, we make changes to the settings.py module in our application.


```python
# change database

DATABASES = {
	'default': {
		 'ENGINE': 'django.contrib.gis.db.backends.postgis',
		 'NAME': 'DOGP', # our new database name
		 'USER': 'postgres',
		'PASSWORD': '1234',
		'HOST': '127.0.0.1',
		'PORT': '5432',
	},
}

```

### Add installed apps
```

INSTALLED_APPS = [
    'gisapp.apps.GisappConfig',
    'django.contrib.gis',
]

```

There are other setups such as setting up login page and authentication, creating media url root and setting up the url which we are not going to deal with in this blog post.

Once the setup is done, we run migrations to reflect those changes in the admin page.

On running `python manage.py runserver` you should see this page.


<figure>

![](https://i.imgur.com/zSSpoqV.png)
<figcaption align = "center"><b><i>Fig.1 -Page indicating successful installation of Django</i></b></figcaption>

</figure>


--- 

Our focus will be on the frontend, but the full code can be accessed from [here](https://github.com/amanbagrecha/openlayers-geoserver-query). 

For querying and displaying layers from geoserver, we first need geoserver installed and running. For more info on how to do that can be found [here](https://docs.geoserver.org/master/en/user/installation/win_binary.html).

In the following steps we setup our basemap layer to be ESRI World Imagery and define an empty vector layer to store the result of query.

```javascript
// map setup
var maplayer = 	new ol.layer.Tile({
    source: new ol.source.XYZ({
	  attributions: ['Powered by Esri','Source: Esri, DigitalGlobe, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN, and the GIS User Community'],
	  attributionsCollapsible: false,
	  url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
	  maxZoom: 23
	}),
	zIndex: 0
  })

var view = new ol.View({
	projection: 'EPSG:4326',
	center: [-103.32989447589996, 44.18118547387081],
	zoom: 7,
  });
  
var map = new ol.Map({
	layers: [ maplayer],
	target: 'map',
	view: view,
  });

// define empty vector layer to store query result later
var SearchvectorLayerSource =  new ol.source.Vector({
	  
	})
var SearchvectorLayer = new ol.layer.Vector({
	source:SearchvectorLayerSource
  });
  map.addLayer(SearchvectorLayer);

// define headers for authentication and login
MyHeaders = {'Content-Type': 'application/json', 'Access-Control-Allow-Credentials' : true,
				'Access-Control-Allow-Origin':'*',
				'Accept': 'application/json',
				'Authorization': 'Basic ' + btoa('admin:geoserver')}
```

To access all layers from a particular workspace, the api end point to do that is as follows

```javascript
// https://docs.geoserver.org/latest/en/api/#1.0.0/layers.yaml
/workspaces/{workspaceName}/layers
```

To see this in action, we display all layers from the `sf` workspace, provided in geoserver by default.



<figure>

![](https://i.imgur.com/sSjlZkU.png)

<figcaption align = "center"><b><i>Fig.2 -Geoserver layers from sf workspace</i></b></figcaption>

</figure>

```javascript

var layerList = []; // array to store all the layer info
var loginInfo = ["admin", "geoserver"]; // username and password for geoserver
var geoserverURL = geoserver_ip + ":" + geoserver_port  

// make ajax call to access the sf layer
$.ajax({
    url: geoserverURL + '/geoserver/rest/workspaces/sf/layers/',
    type: 'GET',
    dataType: 'json',
    contentType: "application/json",
    beforeSend: function(xhr) {
         xhr.setRequestHeader ("Authorization", "Basic " + btoa(loginInfo[0] + ":" + loginInfo[1]));
    },
    success: function(data){
        for (var i = 0; i < data.layers.layer.length; i++) {
            layerList.push([data.layers.layer[i].name, data.layers.layer[i].href]);
        }

    },
    async: false
});
```
The output of this ajax call returns us a `layerList` array containing all the layer name and the url associated with it of size (:, 2)

This layer can then be displayed on the frontend by looping over the array and inserting into the div element.


<figure>

![](https://i.imgur.com/ZDctdje.jpg)
<figcaption align = "center"><b><i>Fig.3 -The layers of workspace `sf` displayed on the map with some styles applied to it
</i></b></figcaption>

</figure>


---


The next step after displaying all the layers of the workspace is to load the features of the layer on selecting a particular layer.

When the layer is ticked we send a request to geoserver to load the features of that layer and add to the map. If the layer is then unticked, we do the opposite and remove the layer from map.

```javascript
  function toggleLayer(input) {
	  if (input.checked) {
		  wmsLayer = new ol.layer.Image({
			source: new ol.source.ImageWMS({
			  url: geoserver_ip+ ':'+geoserver_port + "/geoserver/wms",
			  imageLoadFunction: tileLoader,
			  params: { LAYERS: input.value },
			  serverType: "geoserver",
			}),
			name: input.value,
		  });

		map.addLayer(wmsLayer);
					
	  } else {
		  map.getLayers().forEach(layer => {
			  if (layer.get('name') == input.value) {
				 map.removeLayer(layer);
			 }
		 });
	  }
  }
```

<figure>

![](https://i.imgur.com/Wgy2YV5.jpg)
<figcaption align = "center"><b><i>Fig.4 -Displaying layer on map</i></b></figcaption>

</figure>

### Query layer

We start with the querying the layer by their attributes. We load all the attributes (as columns) and display as dropdown. We use `wfs` service and `DescribeFeatureType` request to load the attributes.

```javascript
  function loadprops(layername) {
	  selectedLayer = layername;
	  fetch(
		geoserver_ip+ ':'+geoserver_port+"/geoserver/wfs?service=wfs&version=2.0.0&request=DescribeFeatureType&typeNames=" + 
		  layername +
		  "&outputFormat=application/json",
		{
		  method: "GET",
		  headers: MyHeaders,
		}
	  )
		.then(function (response) {
		  return response.json();
		})
		.then(function (json) {
			var allprops = json.featureTypes[0].properties;
		  var ColumnnamesSelect = document.getElementById("Columnnames");
			  ColumnnamesSelect.innerHTML = ''
			for (i = 0; i < allprops.length; i++){
				if (allprops[i].name != 'the_geom') {
					ColumnnamesSelect.innerHTML +=
					  '<option value="' +
					  allprops[i].name +
					  '"> ' +
					  allprops[i].name +
					  "</option>";
				}
  
			}
		});
  }
  ```

Upto this point we have the layer and its features we want to search for. To query the layer we make a fetch call to ows service protocol and pass in the values of feature and the layer we want to query for. 

```javascript
CQL_filter = column_name + " = '" + query_value + "'";
  query_url =geoserver_ip+ ':'+geoserver_port + "/geoserver/sf/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=" + selectedLayer +	"&CQL_FILTER=" +	CQL_filter +  "&outputFormat=application%2Fjson";
    		
  fetch_search_call(query_url).catch((error) => {
  CQL_filter = column_name + "%20" + "ILIKE" + "%20%27%25" + query_value + "%25%27";
	});
```

We define a fetch_search_call function which makes a request to ows service and returns a geojson. We can parse the geojson and display it on the map.

```javascript
  
function fetch_search_call(query_url){

	fetch_result = fetch(query_url, {
		method: "GET",
		headers: MyHeaders,
	  })
		.then(function (response) {
		  return response.json();
		})
		.then(function (json) {
		
				SearchvectorLayerSource.clear()
				SearchvectorLayerSource.addFeatures(
			  new ol.format.GeoJSON({
			  }).readFeatures(json)
			  );
			  if(json.features.length!=0){
			  $('#searchModal').modal('toggle');
			  }

			SearchvectorLayer.set('name','search_polygon_layer')
			map.getView().fit(SearchvectorLayerSource.getExtent(),  { duration: 1590, size: map.getSize(), padding: [10, 10, 13, 15], maxZoom:16});
			
		return fetch_result
  }
```


The above function queries a feature and adds it to the map as a new layer. If the search is successful, we are zoomed into that location and only the feature queried gets displayed.
If the fetch call could not find the match it returns an error which is caught by `catch` and displays the error to the client.


<figure>

![](https://i.imgur.com/syqvzq0.gif)
<figcaption align = "center"><b><i>Fig.5 -Displaying Queried layer by attribute value</i></b></figcaption>

</figure>

This completes the blog on how to query layer and display on the map. Visit the [github page](https://github.com/amanbagrecha/openlayers-geoserver-query) to find the working application.


